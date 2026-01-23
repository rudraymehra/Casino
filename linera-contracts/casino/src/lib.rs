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
    /// Deposit funds into the casino
    Deposit { amount: Amount },
    /// Withdraw funds from the casino
    Withdraw { amount: Amount },
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
    /// Deposit successful
    DepositSuccess { new_balance: Amount },
    /// Withdrawal successful
    WithdrawSuccess { new_balance: Amount },
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

// ============================================
// UNIT TESTS
// ============================================
#[cfg(test)]
mod tests {
    use super::*;
    use sha3::{Digest, Sha3_256};

    #[test]
    fn test_game_type_serialization() {
        let game = GameType::Roulette;
        let serialized = serde_json::to_string(&game).unwrap();
        assert_eq!(serialized, "\"Roulette\"");
        
        let deserialized: GameType = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, GameType::Roulette);
    }

    #[test]
    fn test_all_game_types() {
        let games = vec![
            GameType::Roulette,
            GameType::Plinko,
            GameType::Mines,
            GameType::Wheel,
        ];
        
        for game in games {
            let json = serde_json::to_string(&game).unwrap();
            let back: GameType = serde_json::from_str(&json).unwrap();
            assert_eq!(game, back);
        }
    }

    #[test]
    fn test_commit_hash_verification() {
        // Simulate commit-reveal
        let reveal_value: [u8; 32] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 
                                      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
                                      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
        
        // Generate commit hash
        let mut hasher = Sha3_256::new();
        hasher.update(reveal_value);
        let commit_hash: [u8; 32] = hasher.finalize().into();
        
        // Verify: same reveal should produce same commit
        let mut hasher2 = Sha3_256::new();
        hasher2.update(reveal_value);
        let commit_hash2: [u8; 32] = hasher2.finalize().into();
        
        assert_eq!(commit_hash, commit_hash2, "Same reveal should produce same commit");
    }

    #[test]
    fn test_roulette_outcome_deterministic() {
        let reveal: [u8; 32] = [42; 32]; // Fixed seed
        
        let mut hasher = Sha3_256::new();
        hasher.update(reveal);
        hasher.update(b"roulette");
        let hash: [u8; 32] = hasher.finalize().into();
        
        let random_u32 = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]);
        let result1 = random_u32 % 37;
        
        // Run again - should be same
        let mut hasher2 = Sha3_256::new();
        hasher2.update(reveal);
        hasher2.update(b"roulette");
        let hash2: [u8; 32] = hasher2.finalize().into();
        
        let random_u32_2 = u32::from_be_bytes([hash2[0], hash2[1], hash2[2], hash2[3]]);
        let result2 = random_u32_2 % 37;
        
        assert_eq!(result1, result2, "Same seed should give same roulette result");
        assert!(result1 < 37, "Result should be 0-36");
    }

    #[test]
    fn test_mines_positions_deterministic() {
        let reveal: [u8; 32] = [123; 32]; // Fixed seed
        let total_cells = 25u32;
        let num_mines = 5u32;
        
        // Generate mine positions
        let mut hasher = Sha3_256::new();
        hasher.update(reveal);
        hasher.update(b"mines");
        let hash: [u8; 32] = hasher.finalize().into();
        
        let mut positions: Vec<u32> = (0..total_cells).collect();
        let mut mines1 = Vec::new();
        
        for i in 0..num_mines {
            let byte_idx = ((i * 4) % 32) as usize;
            let random_u32 = u32::from_be_bytes([
                hash[byte_idx % 32],
                hash[(byte_idx + 1) % 32],
                hash[(byte_idx + 2) % 32],
                hash[(byte_idx + 3) % 32],
            ]);
            let remaining = positions.len() as u32;
            let idx = (random_u32 % remaining) as usize;
            mines1.push(positions.remove(idx));
        }
        
        // Run again
        let mut positions2: Vec<u32> = (0..total_cells).collect();
        let mut mines2 = Vec::new();
        
        for i in 0..num_mines {
            let byte_idx = ((i * 4) % 32) as usize;
            let random_u32 = u32::from_be_bytes([
                hash[byte_idx % 32],
                hash[(byte_idx + 1) % 32],
                hash[(byte_idx + 2) % 32],
                hash[(byte_idx + 3) % 32],
            ]);
            let remaining = positions2.len() as u32;
            let idx = (random_u32 % remaining) as usize;
            mines2.push(positions2.remove(idx));
        }
        
        assert_eq!(mines1, mines2, "Same seed should give same mine positions");
        assert_eq!(mines1.len(), num_mines as usize, "Should have correct number of mines");
    }

    #[test]
    fn test_plinko_path_deterministic() {
        let reveal: [u8; 32] = [77; 32]; // Fixed seed
        let rows = 10u32;
        
        let mut hasher = Sha3_256::new();
        hasher.update(reveal);
        hasher.update(b"plinko");
        let hash: [u8; 32] = hasher.finalize().into();
        
        let mut position1 = rows / 2;
        for i in 0..rows {
            let byte_idx = (i / 8) as usize;
            let bit_idx = i % 8;
            let go_right = (hash[byte_idx % 32] >> bit_idx) & 1 == 1;
            if go_right {
                position1 = (position1 + 1).min(rows);
            } else {
                position1 = position1.saturating_sub(1);
            }
        }
        
        // Run again
        let mut position2 = rows / 2;
        for i in 0..rows {
            let byte_idx = (i / 8) as usize;
            let bit_idx = i % 8;
            let go_right = (hash[byte_idx % 32] >> bit_idx) & 1 == 1;
            if go_right {
                position2 = (position2 + 1).min(rows);
            } else {
                position2 = position2.saturating_sub(1);
            }
        }
        
        assert_eq!(position1, position2, "Same seed should give same plinko path");
    }

    #[test]
    fn test_wheel_outcome_deterministic() {
        let reveal: [u8; 32] = [200; 32]; // Fixed seed
        let segments = 8u32;
        
        let mut hasher = Sha3_256::new();
        hasher.update(reveal);
        hasher.update(b"wheel");
        let hash: [u8; 32] = hasher.finalize().into();
        
        let random_u32 = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]);
        let result1 = random_u32 % segments;
        
        // Run again
        let mut hasher2 = Sha3_256::new();
        hasher2.update(reveal);
        hasher2.update(b"wheel");
        let hash2: [u8; 32] = hasher2.finalize().into();
        
        let random_u32_2 = u32::from_be_bytes([hash2[0], hash2[1], hash2[2], hash2[3]]);
        let result2 = random_u32_2 % segments;
        
        assert_eq!(result1, result2, "Same seed should give same wheel result");
        assert!(result1 < segments, "Result should be within segments");
    }

    #[test]
    fn test_different_seeds_different_results() {
        let reveal1: [u8; 32] = [1; 32];
        let reveal2: [u8; 32] = [2; 32];
        
        let mut hasher1 = Sha3_256::new();
        hasher1.update(reveal1);
        let hash1: [u8; 32] = hasher1.finalize().into();
        
        let mut hasher2 = Sha3_256::new();
        hasher2.update(reveal2);
        let hash2: [u8; 32] = hasher2.finalize().into();
        
        assert_ne!(hash1, hash2, "Different seeds should produce different results");
    }
}
