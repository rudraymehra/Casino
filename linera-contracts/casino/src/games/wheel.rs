// Copyright (c) APT Casino. All rights reserved.
// Spin Wheel game logic

use sha3::{Digest, Sha3_256};

/// Wheel segments with their multipliers (multiplier * 100)
const WHEEL_SEGMENTS: [(u32, &str); 8] = [
    (200, "1x"),     // 2x - most common
    (150, "0.5x"),   // 1.5x
    (300, "2x"),     // 3x
    (0, "0x"),       // Lose
    (500, "4x"),     // 5x
    (200, "1x"),     // 2x
    (1000, "9x"),    // 10x - rare
    (100, "0x"),     // Lose small (return bet)
];

/// Calculate wheel outcome from reveal value
/// Returns (outcome_string, multiplier * 100)
pub fn calculate_outcome(reveal_value: &[u8; 32], _game_params: &str) -> (String, u32) {
    let mut hasher = Sha3_256::new();
    hasher.update(reveal_value);
    hasher.update(b"wheel");
    let hash: [u8; 32] = hasher.finalize().into();
    
    // Generate random segment (0-7)
    let random_u32 = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]);
    let segment = (random_u32 % 8) as usize;
    
    let (multiplier, label) = WHEEL_SEGMENTS[segment];
    
    // Calculate spin angle for visual display
    let angle = (segment as u32 * 45) + (random_u32 % 45); // Add variance within segment
    
    (format!("Wheel: Segment {} ({}), Angle {}°", segment, label, angle), multiplier)
}
