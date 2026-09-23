#![no_std]

//! Campaign factory: opens one vault per campaign.
//!
//! Deployed once. Holds **no funds** — it only knows the vault's Wasm hash and
//! who is allowed to open a campaign. One instance per campaign is what gives
//! the funds ledger-level segregation: each vault is its own contract address
//! holding its own balance, instead of every campaign sharing one address with
//! its money tracked as an entry inside a map.
//!
//! The `deploy` call is the on-chain trace of the human approval: if there is no
//! vault address, there is no campaign.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN,
    ContractExecutable, Env,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The only address allowed to open campaigns.
    Owner,
    /// Wasm hash every new vault is deployed from.
    VaultWasm,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
}

#[contractevent]
pub struct CampaignOpened {
    #[topic]
    pub vault: Address,
    pub sme: Address,
    pub goal: i128,
    pub deadline: u64,
}

#[contract]
pub struct CampaignFactory;

#[contractimpl]
impl CampaignFactory {
    /// Runs once, at deploy time, and cannot run again.
    pub fn __constructor(env: Env, owner: Address, vault_wasm: BytesN<32>) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::VaultWasm, &vault_wasm);
    }

    /// Deploy one vault and return its address.
    ///
    /// Authorized by the owner: opening a campaign is the platform's decision,
    /// and this is where it becomes visible on-chain. Emits one event per
    /// deployment so the vaults can be indexed.
    pub fn deploy(
        env: Env,
        salt: BytesN<32>,
        sme: Address,
        token: Address,
        goal: i128,
        deadline: u64,
    ) -> Address {
        let owner = Self::owner(env.clone());
        owner.require_auth();

        let wasm = Self::vault_wasm(env.clone());

        // The vault's Wasm has to be uploaded to the ledger before this runs;
        // `scripts/deploy-local.sh` uploads it and passes the hash in.
        //
        // The argument order has to match `CampaignVault::__constructor`.
        let vault = env
            .deployer()
            .with_current_contract(salt)
            .deploy_contract(
                ContractExecutable::Wasm(wasm),
                (sme.clone(), token, goal, deadline),
            );

        CampaignOpened {
            vault: vault.clone(),
            sme,
            goal,
            deadline,
        }
        .publish(&env);

        vault
    }

    /// The address a vault with this salt *would* get, without deploying it.
    ///
    /// Deployed addresses are deterministic per `(deployer, salt)`, so the
    /// platform can show a campaign's address before it exists.
    pub fn predict(env: Env, salt: BytesN<32>) -> Address {
        env.deployer()
            .with_current_contract(salt)
            .deployed_address()
    }

    // --- reads -------------------------------------------------------------

    pub fn owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn vault_wasm(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&DataKey::VaultWasm)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, Error::NotInitialized))
    }
}

mod test;
