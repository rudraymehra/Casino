// Copyright (c) APT Casino. All rights reserved.
// Casino state management

use linera_sdk::linera_base_types::AccountOwner;
use linera_sdk::views::{linera_views, RegisterView, MapView, LogView, RootView, ViewStorageContext};
use casino::{PendingGame, GameOutcome};

/// The casino application state
#[derive(RootView, async_graphql::SimpleObject)]
#[view(context = ViewStorageContext)]
pub struct CasinoState {
    /// Counter for generating unique game IDs
    pub next_game_id: RegisterView<u64>,
    /// Pending games awaiting reveal
    #[graphql(skip)]
    pub pending_games: MapView<u64, PendingGame>,
    /// History of completed games
    pub game_history: LogView<GameOutcome>,
    /// Total funds in the casino (in attos)
    #[graphql(skip)]
    pub total_funds: RegisterView<u64>,
    /// Player balances (owner -> balance in attos)
    #[graphql(skip)]
    pub player_balances: MapView<AccountOwner, u128>,
}
