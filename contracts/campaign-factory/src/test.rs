#![cfg(test)]

//! Factory tests.
//!
//! `deploy` itself is verified on a real network: it uploads the vault's Wasm
//! and deploys a vault instance end to end, which is what the local-network
//! check exercises. Faking `deploy_v2` against a Wasm that was never uploaded
//! would prove nothing about the one call that actually matters.

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn setup(env: &Env) -> (Address, Address, BytesN<32>) {
    env.mock_all_auths();

    let owner = Address::generate(env);
    let wasm = BytesN::from_array(env, &[7u8; 32]);
    let contract = env.register(CampaignFactory, (owner.clone(), wasm.clone()));

    (contract, owner, wasm)
}

#[test]
fn constructor_records_the_owner_and_the_vault_wasm() {
    let env = Env::default();
    let (contract, owner, wasm) = setup(&env);
    let client = CampaignFactoryClient::new(&env, &contract);

    assert_eq!(client.owner(), owner);
    assert_eq!(client.vault_wasm(), wasm);
}

#[test]
fn predict_is_deterministic_per_salt() {
    let env = Env::default();
    let (contract, _, _) = setup(&env);
    let client = CampaignFactoryClient::new(&env, &contract);

    let salt = BytesN::from_array(&env, &[1u8; 32]);
    let other = BytesN::from_array(&env, &[2u8; 32]);

    let first = client.predict(&salt);
    assert_eq!(first, client.predict(&salt));
    assert_ne!(first, client.predict(&other));
}

#[test]
fn a_different_owner_gets_a_different_factory() {
    let env = Env::default();
    env.mock_all_auths();

    let wasm = BytesN::from_array(&env, &[7u8; 32]);
    let a = env.register(CampaignFactory, (Address::generate(&env), wasm.clone()));
    let b = env.register(CampaignFactory, (Address::generate(&env), wasm));

    let salt = BytesN::from_array(&env, &[1u8; 32]);
    assert_ne!(
        CampaignFactoryClient::new(&env, &a).predict(&salt),
        CampaignFactoryClient::new(&env, &b).predict(&salt),
    );
}
