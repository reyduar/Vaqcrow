#![no_std]

//! Campaign vault: custody of the contributions for one funding campaign.
//!
//! One instance per campaign, deployed by the factory at approval time. The
//! contract holds the money, decides the goal condition against the ledger, and
//! moves the funds. Nobody — not the platform, not the SME — can redirect them.
//!
//! State machine:
//!
//! ```text
//!   Funding ──(total >= goal)──> Settled    (paid out, contributions closed)
//!      │
//!      └──(deadline passed, goal not reached)──> Refunding  (permissionless refunds)
//! ```
//!
//! The goal check lives inside `contribute` on purpose: ledger ordering makes it
//! deterministic against a concurrent `withdraw`, and there is no window in which
//! the goal is reached and the funds are still available.
//!
//! IMPORTANT — off-chain precondition: the SME account must exist and be able to
//! receive before the campaign opens. A transfer to a non-existent account fails,
//! and because the payout is atomic with the contribution that crosses the goal,
//! a missing SME account would revert that contribution and stall the campaign.
//! `deploy` in the factory cannot verify it; the platform verifies it when it
//! opens the campaign. See `contracts/README.md`.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env, Vec,
};

/// Ledgers close roughly every five seconds.
const DAY_IN_LEDGERS: u32 = 17_280;
/// Extend the instance's TTL when it falls below this.
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
/// Extend it to this. The network caps an entry at roughly 180 days.
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

/// A bounded batch keeps `sweep` from becoming a resource-consumption vector.
pub const MAX_SWEEP_BATCH: u32 = 20;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum State {
    /// Open, below the goal. `contribute` and `withdraw` are allowed.
    Funding = 0,
    /// The goal was reached and the SME was paid. Nothing else is allowed.
    Settled = 1,
    /// The deadline passed without the goal. `refund` and `sweep` are allowed.
    Refunding = 2,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Sme,
    Token,
    Goal,
    Deadline,
    Total,
    State,
    /// Every address that ever contributed, in order of first contribution.
    Contributors,
    /// Per-investor contribution. Persistent: it must outlive the campaign.
    Contribution(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// The campaign is not in the state this operation needs.
    WrongState = 1,
    /// The campaign is still open, so it cannot be refunded yet.
    DeadlineNotPassed = 2,
    /// The deadline has passed, so no more contributions are accepted.
    DeadlinePassed = 3,
    InvalidAmount = 4,
    InvalidGoal = 5,
    InvalidDeadline = 6,
    /// There is no contribution to return for that address.
    NothingToRefund = 7,
    BatchTooLarge = 8,
    EmptyBatch = 9,
}

#[contractevent]
pub struct Contributed {
    #[topic]
    pub investor: Address,
    pub amount: i128,
    pub total: i128,
}

#[contractevent]
pub struct Settled {
    #[topic]
    pub sme: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Withdrawn {
    #[topic]
    pub investor: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub investor: Address,
    pub amount: i128,
}

#[contract]
pub struct CampaignVault;

#[contractimpl]
impl CampaignVault {
    /// Runs once, at deploy time, and cannot run again.
    pub fn __constructor(env: Env, sme: Address, token: Address, goal: i128, deadline: u64) {
        if goal <= 0 {
            panic_with_error!(&env, Error::InvalidGoal);
        }
        if deadline <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::InvalidDeadline);
        }

        let storage = env.storage().instance();
        storage.set(&DataKey::Sme, &sme);
        storage.set(&DataKey::Token, &token);
        storage.set(&DataKey::Goal, &goal);
        storage.set(&DataKey::Deadline, &deadline);
        storage.set(&DataKey::Total, &0i128);
        storage.set(&DataKey::State, &State::Funding);
        storage.set(&DataKey::Contributors, &Vec::<Address>::new(&env));
    }

    /// Contribute to the campaign. Authenticated by the contributor.
    ///
    /// When the total reaches the goal this settles the campaign and pays the
    /// SME **in the same transaction**, and returns `State::Settled` so the
    /// caller can see the transition.
    pub fn contribute(env: Env, investor: Address, amount: i128) -> Result<State, Error> {
        investor.require_auth();

        if Self::state(env.clone()) != State::Funding {
            return Err(Error::WrongState);
        }
        if env.ledger().timestamp() >= Self::deadline(env.clone()) {
            return Err(Error::DeadlinePassed);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Effects first, interactions after: the state the transfers depend on is
        // already written when they run.
        let total = Self::total(env.clone()) + amount;
        let key = DataKey::Contribution(investor.clone());
        let previous: i128 = env.storage().persistent().get(&key).unwrap_or(0);

        if previous == 0 {
            // Membership has to be checked, not inferred from the contribution
            // being zero: an investor who contributes, withdraws and contributes
            // again is back at zero the second time, and appending on that
            // condition alone would list them twice in the index.
            let mut contributors: Vec<Address> =
                env.storage().instance().get(&DataKey::Contributors).unwrap();
            if !contributors.contains(investor.clone()) {
                contributors.push_back(investor.clone());
                env.storage().instance().set(&DataKey::Contributors, &contributors);
            }
        }

        env.storage().instance().set(&DataKey::Total, &total);
        env.storage().persistent().set(&key, &(previous + amount));
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        let token = Self::token(env.clone());
        let client = token::TokenClient::new(&env, &token);
        client.transfer(&investor, &env.current_contract_address(), &amount);

        if total >= Self::goal(env.clone()) {
            env.storage().instance().set(&DataKey::State, &State::Settled);

            let sme = Self::sme(env.clone());
            client.transfer(&env.current_contract_address(), &sme, &total);
            Settled {
                sme,
                amount: total,
            }
            .publish(&env);

            Contributed {
                investor,
                amount,
                total,
            }
            .publish(&env);
            return Ok(State::Settled);
        }

        Contributed {
            investor,
            amount,
            total,
        }
        .publish(&env);
        Ok(State::Funding)
    }

    /// Withdraw a contribution while the campaign is still open. The investor
    /// can only ever get their own money back, to their own address.
    pub fn withdraw(env: Env, investor: Address) -> Result<i128, Error> {
        investor.require_auth();

        if Self::state(env.clone()) != State::Funding {
            return Err(Error::WrongState);
        }

        let key = DataKey::Contribution(investor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToRefund);
        }

        env.storage().persistent().set(&key, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::Total, &(Self::total(env.clone()) - amount));

        let token = Self::token(env.clone());
        token::TokenClient::new(&env, &token).transfer(
            &env.current_contract_address(),
            &investor,
            &amount,
        );

        Withdrawn {
            investor,
            amount,
        }
        .publish(&env);
        Ok(amount)
    }

    /// Refund one investor. **Permissionless**: the destination is fixed by the
    /// contract, so whoever triggers it cannot redirect a single stroop. This is
    /// what lets the platform close refunds for investors who never asked.
    ///
    /// Enters `Refunding` on the first call after the deadline, so no separate
    /// transition is needed.
    pub fn refund(env: Env, investor: Address) -> Result<i128, Error> {
        Self::ensure_refundable(&env)?;
        match Self::pay_refund(&env, &investor) {
            Some(amount) => Ok(amount),
            None => Err(Error::NothingToRefund),
        }
    }

    /// Refund a bounded batch. **Permissionless**, same reasoning as `refund`.
    /// Returns how many investors were actually paid; an address with nothing to
    /// return is skipped instead of aborting the batch.
    pub fn sweep(env: Env, investors: Vec<Address>) -> Result<u32, Error> {
        let len = investors.len();
        if len == 0 {
            return Err(Error::EmptyBatch);
        }
        if len > MAX_SWEEP_BATCH {
            return Err(Error::BatchTooLarge);
        }

        Self::ensure_refundable(&env)?;

        let mut paid = 0u32;
        for investor in investors.iter() {
            if Self::pay_refund(&env, &investor).is_some() {
                paid += 1;
            }
        }
        Ok(paid)
    }

    // --- reads -------------------------------------------------------------

    pub fn state(env: Env) -> State {
        env.storage().instance().get(&DataKey::State).unwrap()
    }

    pub fn total(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Total).unwrap()
    }

    pub fn goal(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Goal).unwrap()
    }

    pub fn deadline(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap()
    }

    pub fn sme(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Sme).unwrap()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn contribution_of(env: Env, investor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(investor))
            .unwrap_or(0)
    }

    pub fn contributors(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::Contributors).unwrap()
    }
}

/// Private helpers. Deliberately outside `#[contractimpl]` so they are not
/// exported as part of the contract's public surface.
impl CampaignVault {
    /// Move the campaign into `Refunding`, or confirm it already is.
    ///
    /// There is no scheduler on Stellar, so the deadline transition cannot fire
    /// on its own. Folding it into the refund path makes it permissionless by
    /// construction: the first refund after the deadline performs the transition.
    fn ensure_refundable(env: &Env) -> Result<(), Error> {
        match Self::state(env.clone()) {
            State::Refunding => Ok(()),
            State::Settled => Err(Error::WrongState),
            State::Funding => {
                if env.ledger().timestamp() < Self::deadline(env.clone()) {
                    return Err(Error::DeadlineNotPassed);
                }
                if Self::total(env.clone()) >= Self::goal(env.clone()) {
                    // Unreachable while the goal check lives in `contribute`, but
                    // the invariant is cheap to assert and would be a silent
                    // payout path if it ever stopped holding.
                    return Err(Error::WrongState);
                }
                env.storage().instance().set(&DataKey::State, &State::Refunding);
                Ok(())
            }
        }
    }

    /// Pay one investor back. `None` when there is nothing to return, so a sweep
    /// can skip it instead of failing the whole batch.
    fn pay_refund(env: &Env, investor: &Address) -> Option<i128> {
        let key = DataKey::Contribution(investor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return None;
        }

        env.storage().persistent().set(&key, &0i128);

        let token = Self::token(env.clone());
        token::TokenClient::new(env, &token).transfer(
            &env.current_contract_address(),
            investor,
            &amount,
        );

        Refunded {
            investor: investor.clone(),
            amount,
        }
        .publish(env);

        Some(amount)
    }
}

mod test;
