#![cfg(test)]

use super::*;
use soroban_sdk::Env;

#[test]
fn constructor_sets_the_goal() {
    let env = Env::default();
    let contract_id = env.register(CampaignVault, (1000i128,));
    let client = CampaignVaultClient::new(&env, &contract_id);

    assert_eq!(client.goal(), 1000);
}

#[test]
fn goal_is_per_contract_instance() {
    let env = Env::default();

    let first = env.register(CampaignVault, (1000i128,));
    let second = env.register(CampaignVault, (2500i128,));

    assert_eq!(CampaignVaultClient::new(&env, &first).goal(), 1000);
    assert_eq!(CampaignVaultClient::new(&env, &second).goal(), 2500);
}
