// Copyright (c) APT Casino. All rights reserved.
// Plinko game logic

use sha3::{Digest, Sha3_256};

/// Plinko multipliers for different landing positions (16 rows, 17 positions)
const PLINKO_MULTIPLIERS: [u32; 17] = [
    1000, 500, 300, 200, 150, 120, 110, 105, 100, 105, 110, 120, 150, 200, 300, 500, 1000
];

/// Calculate plinko outcome from reveal value
/// Returns (outcome_string, multiplier * 100)
pub fn calculate_outcome(reveal_value: &[u8; 32], game_params: &str) -> (String, u32) {
    // Parse rows from game_params, default to 16
    let rows: u32 = game_params.parse().unwrap_or(16);
    let rows = rows.clamp(8, 16);
    
    // Generate the ball path
    let mut hasher = Sha3_256::new();
    hasher.update(reveal_value);
    hasher.update(b"plinko");
    let hash: [u8; 32] = hasher.finalize().into();
    
    // Simulate the ball falling through pegs
    // Start at center position
    let mut position: i32 = (rows as i32) / 2;
    let mut path = Vec::new();
    
    for i in 0..rows {
        let byte_idx = (i / 8) as usize;
        let bit_idx = i % 8;
        let go_right = if byte_idx < hash.len() {
            (hash[byte_idx] >> bit_idx) & 1 == 1
        } else {
            false
        };
        
        if go_right {
            position += 1;
            path.push('R');
        } else {
            position -= 1;
            path.push('L');
        }
    }
    
    // Normalize position to 0-16 range
    let final_position = ((position + rows as i32) / 2) as usize;
    let final_position = final_position.min(16);
    
    let multiplier = PLINKO_MULTIPLIERS[final_position];
    let path_str: String = path.into_iter().collect();
    
    (format!("Plinko: Position {}, Path: {}", final_position, path_str), multiplier)
}
