// Copyright (c) APT Casino. All rights reserved.
// Casino contract implementation

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;
mod games;

use casino::{CasinoAbi, CasinoOperation, CasinoResponse, GameType, PendingGame, GameOutcome};
use linera_sdk::{
    linera_base_types::{WithContractAbi, Amount},
    views::{RootView, View},
    Contract, ContractRuntime,
};
use sha3::{Digest, Sha3_256};

use self::state::CasinoState;
use self::games::{roulette, plinko, mines, wheel};

pub struct CasinoContract {
    state: CasinoState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(CasinoContract);

impl WithContractAbi for CasinoContract {
    type Abi = CasinoAbi;
}

impl Contract for CasinoContract {
    type Message = ();
    type InstantiationArgument = u64;  // Simple initialization value
    type Parameters = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = CasinoState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        CasinoContract { state, runtime }
    }

    async fn instantiate(&mut self, initial_funds: u64) {
        // Initialize the casino state
        self.state.next_game_id.set(1);
        self.state.total_funds.set(initial_funds);
    }

    async fn execute_operation(&mut self, operation: CasinoOperation) -> CasinoResponse {
        match operation {
            CasinoOperation::Deposit { amount } => {
                let player = self.runtime.authenticated_signer()
                    .expect("Deposit must be from authenticated user");

                let deposit_attos = amount.to_attos();

                // Get current player balance
                let current_balance = self.state.player_balances.get(&player)
                    .await
                    .expect("Failed to read balance")
                    .unwrap_or(0);

                // Update player balance
                let new_balance = current_balance.saturating_add(deposit_attos);
                self.state.player_balances.insert(&player, new_balance)
                    .expect("Failed to update balance");

                // Update total funds
                let current_funds = *self.state.total_funds.get();
                self.state.total_funds.set(current_funds.saturating_add(deposit_attos as u64));

                CasinoResponse::DepositSuccess {
                    new_balance: Amount::from_attos(new_balance)
                }
            }
            CasinoOperation::Withdraw { amount } => {
                let player = self.runtime.authenticated_signer()
                    .expect("Withdraw must be from authenticated user");

                let withdraw_attos = amount.to_attos();

                // Get current player balance
                let current_balance = self.state.player_balances.get(&player)
                    .await
                    .expect("Failed to read balance")
                    .unwrap_or(0);

                // Check sufficient balance
                assert!(current_balance >= withdraw_attos, "Insufficient balance");

                // Update player balance
                let new_balance = current_balance.saturating_sub(withdraw_attos);
                self.state.player_balances.insert(&player, new_balance)
                    .expect("Failed to update balance");

                // Update total funds
                let current_funds = *self.state.total_funds.get();
                self.state.total_funds.set(current_funds.saturating_sub(withdraw_attos as u64));

                CasinoResponse::WithdrawSuccess {
                    new_balance: Amount::from_attos(new_balance)
                }
            }
            CasinoOperation::PlaceBet {
                game_type,
                bet_amount,
                commit_hash,
                game_params,
            } => {
                let game_id = *self.state.next_game_id.get();
                let player = self.runtime.authenticated_signer()
                    .expect("Bet must be placed by authenticated user");
                let timestamp = self.runtime.system_time();

                let bet_attos = bet_amount.to_attos();

                // Check player has sufficient balance
                let current_balance = self.state.player_balances.get(&player)
                    .await
                    .expect("Failed to read balance")
                    .unwrap_or(0);
                assert!(current_balance >= bet_attos, "Insufficient balance to place bet");

                // Deduct bet from player balance
                let new_balance = current_balance.saturating_sub(bet_attos);
                self.state.player_balances.insert(&player, new_balance)
                    .expect("Failed to update balance");

                let pending_game = PendingGame {
                    player,
                    game_type,
                    bet_amount,
                    commit_hash,
                    game_params,
                    timestamp,
                };

                self.state.pending_games.insert(&game_id, pending_game)
                    .expect("Failed to insert pending game");
                self.state.next_game_id.set(game_id + 1);

                CasinoResponse::GamePlaced { game_id }
            }
            CasinoOperation::Reveal {
                game_id,
                reveal_value,
            } => {
                let player = self.runtime.authenticated_signer()
                    .expect("Reveal must be from authenticated user");

                let pending_game = self.state.pending_games.get(&game_id)
                    .await
                    .expect("Failed to read pending game")
                    .expect("Game not found");

                // Verify the player owns this game
                assert_eq!(pending_game.player, player, "Only game owner can reveal");

                // Verify the commit hash
                let mut hasher = Sha3_256::new();
                hasher.update(reveal_value);
                let calculated_hash: [u8; 32] = hasher.finalize().into();
                assert_eq!(calculated_hash, pending_game.commit_hash, "Invalid reveal value");

                // Calculate game outcome based on game type
                let (outcome, multiplier) = match pending_game.game_type {
                    GameType::Roulette => roulette::calculate_outcome(&reveal_value, &pending_game.game_params),
                    GameType::Plinko => plinko::calculate_outcome(&reveal_value, &pending_game.game_params),
                    GameType::Mines => mines::calculate_outcome(&reveal_value, &pending_game.game_params),
                    GameType::Wheel => wheel::calculate_outcome(&reveal_value, &pending_game.game_params),
                };

                // Calculate payout (multiplier is percentage, e.g., 200 = 2x)
                let bet_attos = pending_game.bet_amount.to_attos();
                let payout_attos = bet_attos * multiplier as u128 / 100;
                let payout = Amount::from_attos(payout_attos);

                // Credit payout to player balance
                let current_balance = self.state.player_balances.get(&player)
                    .await
                    .expect("Failed to read balance")
                    .unwrap_or(0);
                let new_balance = current_balance.saturating_add(payout_attos);
                self.state.player_balances.insert(&player, new_balance)
                    .expect("Failed to update balance");

                // Record game outcome
                let game_outcome = GameOutcome {
                    game_id,
                    game_type: format!("{:?}", pending_game.game_type),
                    bet_amount: pending_game.bet_amount.to_string(),
                    payout_amount: payout.to_string(),
                    outcome_details: outcome.clone(),
                    timestamp: pending_game.timestamp.micros(),
                };
                self.state.game_history.push(game_outcome);

                // Remove pending game
                self.state.pending_games.remove(&game_id)
                    .expect("Failed to remove pending game");

                CasinoResponse::GameCompleted {
                    game_id,
                    outcome,
                    payout,
                }
            }
        }
    }

    async fn execute_message(&mut self, _message: ()) {
        panic!("Casino application doesn't support cross-chain messages");
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}
