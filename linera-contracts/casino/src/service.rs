// Copyright (c) APT Casino. All rights reserved.
// Casino service implementation for GraphQL queries

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Request, Response, Schema};
use casino::{CasinoAbi, CasinoOperation, GameType};
use linera_sdk::{
    linera_base_types::{WithServiceAbi, Amount},
    views::View,
    Service, ServiceRuntime,
};

use self::state::CasinoState;

pub struct CasinoService {
    state: Arc<CasinoState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(CasinoService);

impl WithServiceAbi for CasinoService {
    type Abi = CasinoAbi;
}

impl Service for CasinoService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = CasinoState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        CasinoService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Request) -> Response {
        let schema = Schema::build(
            QueryRoot {
                state: self.state.clone(),
            },
            MutationRoot {
                runtime: self.runtime.clone(),
            },
            EmptySubscription,
        )
        .finish();
        schema.execute(request).await
    }
}

struct QueryRoot {
    state: Arc<CasinoState>,
}

#[Object]
impl QueryRoot {
    /// Get the next game ID that will be assigned
    async fn next_game_id(&self) -> u64 {
        *self.state.next_game_id.get()
    }

    /// Get total funds in the casino (in attos)
    async fn total_funds(&self) -> String {
        self.state.total_funds.get().to_string()
    }

    /// Get a player's balance (in attos)
    async fn player_balance(&self, owner: String) -> String {
        // Parse owner from string
        let owner: linera_sdk::linera_base_types::AccountOwner = match owner.parse() {
            Ok(o) => o,
            Err(_) => return "0".to_string(),
        };

        self.state.player_balances.get(&owner)
            .await
            .unwrap_or(Some(0))
            .unwrap_or(0)
            .to_string()
    }

    /// Get the game history
    async fn game_history(&self) -> Vec<casino::GameOutcome> {
        self.state.game_history.read(..)
            .await
            .unwrap_or_default()
    }

    /// Get a specific game outcome by ID
    async fn game_outcome(&self, game_id: u64) -> Option<casino::GameOutcome> {
        let history = self.state.game_history.read(..)
            .await
            .unwrap_or_default();
        history.into_iter().find(|g| g.game_id == game_id)
    }
}

struct MutationRoot {
    runtime: Arc<ServiceRuntime<CasinoService>>,
}

#[Object]
impl MutationRoot {
    /// Deposit funds into the casino
    async fn deposit(&self, amount: String) -> bool {
        let amount = match amount.parse::<u128>() {
            Ok(a) => Amount::from_attos(a),
            Err(_) => return false,
        };

        let operation = CasinoOperation::Deposit { amount };
        self.runtime.schedule_operation(&operation);
        true
    }

    /// Withdraw funds from the casino
    async fn withdraw(&self, amount: String) -> bool {
        let amount = match amount.parse::<u128>() {
            Ok(a) => Amount::from_attos(a),
            Err(_) => return false,
        };

        let operation = CasinoOperation::Withdraw { amount };
        self.runtime.schedule_operation(&operation);
        true
    }

    /// Schedule a bet operation
    async fn place_bet(
        &self,
        game_type: String,
        bet_amount: String,
        commit_hash: String,
        game_params: String,
    ) -> bool {
        let game_type = match game_type.to_lowercase().as_str() {
            "roulette" => GameType::Roulette,
            "plinko" => GameType::Plinko,
            "mines" => GameType::Mines,
            "wheel" => GameType::Wheel,
            _ => return false,
        };

        let bet_amount = match bet_amount.parse::<u128>() {
            Ok(amount) => Amount::from_attos(amount),
            Err(_) => return false,
        };

        let commit_hash: [u8; 32] = match hex::decode(&commit_hash) {
            Ok(bytes) if bytes.len() == 32 => {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                arr
            }
            _ => return false,
        };

        let operation = CasinoOperation::PlaceBet {
            game_type,
            bet_amount,
            commit_hash,
            game_params,
        };
        self.runtime.schedule_operation(&operation);
        true
    }

    /// Schedule a reveal operation
    async fn reveal(&self, game_id: u64, reveal_value: String) -> bool {
        let reveal_value: [u8; 32] = match hex::decode(&reveal_value) {
            Ok(bytes) if bytes.len() == 32 => {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                arr
            }
            _ => return false,
        };

        let operation = CasinoOperation::Reveal {
            game_id,
            reveal_value,
        };
        self.runtime.schedule_operation(&operation);
        true
    }
}
