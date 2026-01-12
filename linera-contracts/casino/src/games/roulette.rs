// Copyright (c) APT Casino. All rights reserved.
// Roulette game logic

use sha3::{Digest, Sha3_256};

/// Calculate roulette outcome from reveal value
/// Returns (outcome_string, multiplier * 100)
pub fn calculate_outcome(reveal_value: &[u8; 32], game_params: &str) -> (String, u32) {
    // Generate random number 0-36
    let mut hasher = Sha3_256::new();
    hasher.update(reveal_value);
    hasher.update(b"roulette");
    let hash: [u8; 32] = hasher.finalize().into();
    
    let random_u32 = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]);
    let result = random_u32 % 37; // 0-36

    // Parse the bet type from game_params
    // Format: "bet_type:value" e.g., "number:17" or "color:red" or "odd_even:odd"
    let parts: Vec<&str> = game_params.split(':').collect();
    let (bet_type, bet_value) = if parts.len() >= 2 {
        (parts[0], parts[1])
    } else {
        ("straight", "0")
    };

    let multiplier = match bet_type {
        "number" | "straight" => {
            // Straight bet on a single number - pays 35:1
            if let Ok(bet_num) = bet_value.parse::<u32>() {
                if result == bet_num { 3600 } else { 0 }
            } else { 0 }
        }
        "color" => {
            // Red/Black bet - pays 1:1
            let is_red = matches!(result, 1 | 3 | 5 | 7 | 9 | 12 | 14 | 16 | 18 | 19 | 21 | 23 | 25 | 27 | 30 | 32 | 34 | 36);
            let bet_red = bet_value == "red";
            if result == 0 {
                0 // House wins on 0
            } else if (is_red && bet_red) || (!is_red && !bet_red) {
                200 // 2x payout
            } else {
                0
            }
        }
        "odd_even" => {
            // Odd/Even bet - pays 1:1
            if result == 0 {
                0 // House wins on 0
            } else {
                let is_even = result % 2 == 0;
                let bet_even = bet_value == "even";
                if (is_even && bet_even) || (!is_even && !bet_even) {
                    200 // 2x payout
                } else {
                    0
                }
            }
        }
        "high_low" => {
            // High (19-36) / Low (1-18) - pays 1:1
            if result == 0 {
                0
            } else {
                let is_high = result >= 19;
                let bet_high = bet_value == "high";
                if (is_high && bet_high) || (!is_high && !bet_high) {
                    200
                } else {
                    0
                }
            }
        }
        _ => 0,
    };

    (format!("Roulette: {}, Bet: {}:{}", result, bet_type, bet_value), multiplier)
}
