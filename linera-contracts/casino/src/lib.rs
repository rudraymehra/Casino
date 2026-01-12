// Copyright (c) APT Casino. All rights reserved.
// Casino ABI for Linera blockchain

/*! ABI of the Casino Application */

use async_graphql::{Request, Response};
use linera_sdk::linera_base_types::{ContractAbi, ServiceAbi, Amount, AccountOwner, Timestamp};
use serde::{Deserialize, Serialize};

pub struct CasinoAbi;

/// The types of games supported
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum GameType {
    Roulette,
    Plinko,
    Mines,
    Wheel,
}

/// Operations that can be performed on the casino contract
#[derive(Debug, Serialize, Deserialize)]
pub enum CasinoOperation {
    /// Place a bet with a commit hash for the reveal phase
    PlaceBet {
        game_type: GameType,
        bet_amount: Amount,
        commit_hash: [u8; 32],
        /// Game-specific parameters (serialized)
        game_params: String,
    },
    /// Reveal the random value to determine game outcome
    Reveal {
        game_id: u64,
        reveal_value: [u8; 32],
    },
}

/// Response from casino operations
#[derive(Debug, Serialize, Deserialize)]
pub enum CasinoResponse {
    /// Game was placed successfully
    GamePlaced { game_id: u64 },
    /// Game completed with outcome
    GameCompleted {
        game_id: u64,
        outcome: String,
        payout: Amount,
    },
}

impl ContractAbi for CasinoAbi {
    type Operation = CasinoOperation;
    type Response = CasinoResponse;
}

impl ServiceAbi for CasinoAbi {
    type Query = Request;
    type QueryResponse = Response;
}

/// A pending game awaiting reveal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingGame {
    pub player: AccountOwner,
    pub game_type: GameType,
    pub bet_amount: Amount,
    pub commit_hash: [u8; 32],
    pub game_params: String,
    pub timestamp: Timestamp,
}

/// A completed game outcome
#[derive(Debug, Clone, Serialize, Deserialize, async_graphql::SimpleObject)]
pub struct GameOutcome {
    pub game_id: u64,
    pub game_type: String,
    pub bet_amount: String,
    pub payout_amount: String,
    pub outcome_details: String,
    pub timestamp: u64,
}
