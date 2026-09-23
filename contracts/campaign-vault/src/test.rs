#![cfg(test)]

//! Core behaviour tests for the campaign vault.
//!
//! These prove the money paths work. The wider suite — every negative case,
//! authorization, TTL and events — is the sibling Task #246.
//!
//! The token is a real Stellar Asset Contract, not a double, so the transfers
//! exercised here are the same ones the contract will do on a network.

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

const START: u64 = 1_000;
const DEADLINE: u64 = 2_000;
const GOAL: i128 = 1_000;

struct Fixture {
    contract: Address,
    token: Address,
    sme: Address,
}

impl Fixture {
    fn client(&self, env: &Env) -> CampaignVaultClient<'_> {
        CampaignVaultClient::new(env, &self.contract)
    }
}

fn setup(env: &Env, goal: i128, deadline: u64) -> Fixture {
    env.ledger().set_timestamp(START);
    env.mock_all_auths();

    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();

    let sme = Address::generate(env);
    let contract = env.register(
        CampaignVault,
        (sme.clone(), token.clone(), goal, deadline),
    );

    Fixture {
        contract,
        token,
        sme,
    }
}

fn fund(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

fn balance(env: &Env, token: &Address, of: &Address) -> i128 {
    TokenClient::new(env, token).balance(of)
}

// --- constructor -----------------------------------------------------------

#[test]
fn constructor_records_the_campaign() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    assert_eq!(client.goal(), GOAL);
    assert_eq!(client.deadline(), DEADLINE);
    assert_eq!(client.sme(), f.sme);
    assert_eq!(client.token(), f.token);
    assert_eq!(client.total(), 0);
    assert_eq!(client.state(), State::Funding);
    assert_eq!(client.contributors().len(), 0);
}

#[test]
#[should_panic]
fn constructor_rejects_a_non_positive_goal() {
    let env = Env::default();
    let _ = setup(&env, 0, DEADLINE);
}

#[test]
#[should_panic]
fn constructor_rejects_a_deadline_in_the_past() {
    let env = Env::default();
    env.ledger().set_timestamp(START);
    let _ = setup(&env, GOAL, START);
}

// --- contributing ----------------------------------------------------------

#[test]
fn contributing_below_the_goal_accumulates() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    fund(&env, &f.token, &alice, 400);

    assert_eq!(client.contribute(&alice, &400), State::Funding);
    assert_eq!(client.total(), 400);
    assert_eq!(client.contribution_of(&alice), 400);
    assert_eq!(client.state(), State::Funding);

    // The money is held by the contract, not by the investor and not by the SME.
    assert_eq!(balance(&env, &f.token, &f.contract), 400);
    assert_eq!(balance(&env, &f.token, &alice), 0);
    assert_eq!(balance(&env, &f.token, &f.sme), 0);
}

#[test]
fn contributing_twice_adds_up_and_indexes_the_investor_once() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    fund(&env, &f.token, &alice, 400);

    client.contribute(&alice, &150);
    client.contribute(&alice, &250);

    assert_eq!(client.contribution_of(&alice), 400);
    assert_eq!(client.total(), 400);
    assert_eq!(client.contributors().len(), 1);
}

#[test]
fn reaching_the_goal_settles_and_pays_the_sme_in_the_same_call() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    fund(&env, &f.token, &alice, GOAL);

    let state = client.contribute(&alice, &GOAL);

    // The transition and the payout are one operation.
    assert_eq!(state, State::Settled);
    assert_eq!(client.state(), State::Settled);
    assert_eq!(balance(&env, &f.token, &f.sme), GOAL);
    // Nothing is left in the vault.
    assert_eq!(balance(&env, &f.token, &f.contract), 0);
}

#[test]
fn the_contribution_that_crosses_the_goal_pays_the_whole_total() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    fund(&env, &f.token, &alice, 600);
    fund(&env, &f.token, &bob, 500);

    client.contribute(&alice, &600);
    assert_eq!(client.state(), State::Funding);

    // 600 + 500 > 1000: the campaign settles and the SME receives everything.
    client.contribute(&bob, &500);

    assert_eq!(client.state(), State::Settled);
    assert_eq!(client.total(), 1_100);
    assert_eq!(balance(&env, &f.token, &f.sme), 1_100);
    assert_eq!(balance(&env, &f.token, &f.contract), 0);
}

// --- withdrawing -----------------------------------------------------------

#[test]
fn withdrawing_before_the_goal_returns_the_contribution() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    fund(&env, &f.token, &alice, 300);
    fund(&env, &f.token, &bob, 200);

    client.contribute(&alice, &300);
    client.contribute(&bob, &200);

    assert_eq!(client.withdraw(&alice), 300);
    assert_eq!(balance(&env, &f.token, &alice), 300);
    assert_eq!(client.contribution_of(&alice), 0);
    assert_eq!(client.total(), 200);
    assert_eq!(client.state(), State::Funding);

    // Bob's money is untouched.
    assert_eq!(client.contribution_of(&bob), 200);
}

// --- refunding -------------------------------------------------------------

#[test]
fn after_the_deadline_a_refund_returns_the_contribution() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    fund(&env, &f.token, &alice, 400);
    client.contribute(&alice, &400);

    // Before the deadline there is nothing to refund.
    assert_eq!(
        client.try_refund(&alice),
        Err(Ok(Error::DeadlineNotPassed))
    );

    env.ledger().set_timestamp(DEADLINE);

    assert_eq!(client.refund(&alice), 400);
    assert_eq!(client.state(), State::Refunding);
    assert_eq!(balance(&env, &f.token, &alice), 400);
    assert_eq!(balance(&env, &f.token, &f.contract), 0);
}

#[test]
fn refund_is_permissionless_and_reaches_the_registered_address() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    let stranger = Address::generate(&env);
    fund(&env, &f.token, &alice, 250);
    client.contribute(&alice, &250);

    env.ledger().set_timestamp(DEADLINE);

    // Somebody other than the investor triggers it. The money still goes to Alice.
    client.refund(&alice);

    assert_eq!(balance(&env, &f.token, &alice), 250);
    assert_eq!(balance(&env, &f.token, &stranger), 0);
}

#[test]
fn sweep_pays_a_batch_and_skips_addresses_with_nothing_to_return() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    let nobody = Address::generate(&env);
    fund(&env, &f.token, &alice, 100);
    fund(&env, &f.token, &bob, 200);
    fund(&env, &f.token, &carol, 300);

    client.contribute(&alice, &100);
    client.contribute(&bob, &200);
    client.contribute(&carol, &300);

    env.ledger().set_timestamp(DEADLINE);

    let batch = soroban_sdk::vec![&env, alice.clone(), nobody, bob.clone()];
    assert_eq!(client.sweep(&batch), 2);

    assert_eq!(balance(&env, &f.token, &alice), 100);
    assert_eq!(balance(&env, &f.token, &bob), 200);
    // Carol was not in the batch, so hers is still held by the contract.
    assert_eq!(balance(&env, &f.token, &carol), 0);
    assert_eq!(balance(&env, &f.token, &f.contract), 300);

    // Sweeping Alice again pays nothing: the contribution is already consumed.
    assert_eq!(client.sweep(&soroban_sdk::vec![&env, alice]), 0);
}

#[test]
fn a_refund_batch_over_the_cap_is_rejected() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let mut batch = soroban_sdk::vec![&env];
    for _ in 0..(MAX_SWEEP_BATCH + 1) {
        batch.push_back(Address::generate(&env));
    }

    assert_eq!(client.try_sweep(&batch), Err(Ok(Error::BatchTooLarge)));
}

// --- closed campaigns ------------------------------------------------------

#[test]
fn a_settled_campaign_accepts_nothing_more() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    fund(&env, &f.token, &alice, GOAL);
    fund(&env, &f.token, &bob, 100);

    client.contribute(&alice, &GOAL);
    assert_eq!(client.state(), State::Settled);

    assert_eq!(
        client.try_contribute(&bob, &100),
        Err(Ok(Error::WrongState))
    );
    assert_eq!(client.try_withdraw(&alice), Err(Ok(Error::WrongState)));
    // The money already left: a refund cannot resurrect it.
    assert_eq!(client.try_refund(&alice), Err(Ok(Error::WrongState)));
    assert_eq!(balance(&env, &f.token, &f.contract), 0);
}

#[test]
fn a_contribution_after_the_deadline_is_rejected() {
    let env = Env::default();
    let f = setup(&env, GOAL, DEADLINE);
    let client = f.client(&env);

    let alice = Address::generate(&env);
    fund(&env, &f.token, &alice, 100);

    env.ledger().set_timestamp(DEADLINE);

    assert_eq!(
        client.try_contribute(&alice, &100),
        Err(Ok(Error::DeadlinePassed))
    );
}
