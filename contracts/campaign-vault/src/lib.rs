#![no_std]

//! Placeholder for the campaign vault.
//!
//! This crate exists so that the workspace, the build, the tests, the local
//! network deploy and the CI job can be proven end to end. It is **not** the
//! campaign vault: the real state machine (custody of the contributions, atomic
//! payout on reaching the goal, voluntary withdrawal, permissionless refunds and
//! the bounded sweep) is implemented in #244.
//!
//! What this placeholder does prove, and what #244 should keep:
//!   * the workspace compiles for `wasm32v1-none` against `soroban-sdk` 28;
//!   * the `__constructor` path works and cannot be re-run;
//!   * the contract deploys and is invocable on the local network.

use soroban_sdk::{contract, contractimpl, contracttype, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Goal,
}

#[contract]
pub struct CampaignVault;

#[contractimpl]
impl CampaignVault {
    /// Runs once, at deploy time. `#244` replaces this with the real campaign
    /// parameters (SME address, asset, goal, deadline).
    pub fn __constructor(env: Env, goal: i128) {
        env.storage().instance().set(&DataKey::Goal, &goal);
    }

    pub fn goal(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Goal).unwrap()
    }
}

mod test;
