// Copyright (c) APT Casino. All rights reserved.
// Mines game logic

use sha3::{Digest, Sha3_256};

/// Calculate mines outcome from reveal value
/// Returns (outcome_string, multiplier * 100)
pub fn calculate_outcome(reveal_value: &[u8; 32], game_params: &str) -> (String, u32) {
    // Parse game params: "num_mines:cells_revealed"
    let parts: Vec<&str> = game_params.split(':').collect();
    let num_mines: u32 = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(5);
    let cells_revealed: u32 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    
    let total_cells: u32 = 25; // 5x5 grid
    let num_mines = num_mines.clamp(1, 24);
    
    // Generate mine positions using Fisher-Yates shuffle
    let mut hasher = Sha3_256::new();
    hasher.update(reveal_value);
    hasher.update(b"mines");
    let hash: [u8; 32] = hasher.finalize().into();
    
    let mut positions: Vec<u32> = (0..total_cells).collect();
    let mut mine_positions = Vec::new();
    
    for i in 0..num_mines {
        let byte_idx = ((i * 4) % 32) as usize;
        let random_u32 = u32::from_be_bytes([
            hash[byte_idx % 32],
            hash[(byte_idx + 1) % 32],
            hash[(byte_idx + 2) % 32],
            hash[(byte_idx + 3) % 32],
        ]);
        
        let remaining = positions.len() as u32;
        if remaining == 0 {
            break;
        }
        let idx = (random_u32 % remaining) as usize;
        mine_positions.push(positions.remove(idx));
    }
    
    // Calculate multiplier based on how many safe cells were revealed
    // Multiplier increases exponentially with each reveal
    let safe_cells = total_cells - num_mines;
    let multiplier = if cells_revealed == 0 {
        0 // Cashed out immediately or hit a mine on first reveal
    } else if cells_revealed >= safe_cells {
        // Revealed all safe cells - jackpot!
        calculate_mines_multiplier(num_mines, safe_cells)
    } else {
        calculate_mines_multiplier(num_mines, cells_revealed)
    };
    
    let mine_str: String = mine_positions.iter()
        .map(|p| p.to_string())
        .collect::<Vec<_>>()
        .join(",");
    
    (format!("Mines: {} mines at [{}], {} revealed", num_mines, mine_str, cells_revealed), multiplier)
}

/// Calculate multiplier for mines game
/// Formula: probability of surviving = (safe_cells - revealed) / (total - revealed)
/// Multiplier = 1 / cumulative_probability
fn calculate_mines_multiplier(num_mines: u32, cells_revealed: u32) -> u32 {
    let total = 25u64;
    let safe = (25 - num_mines) as u64;
    
    // Calculate cumulative probability of surviving each reveal
    // P = (safe/total) * ((safe-1)/(total-1)) * ... * ((safe-n+1)/(total-n+1))
    let mut numerator: u64 = 1;
    let mut denominator: u64 = 1;
    
    for i in 0..cells_revealed as u64 {
        numerator *= safe - i;
        denominator *= total - i;
    }
    
    if numerator == 0 {
        return 0;
    }
    
    // Multiplier = (1 / probability) * 100 with 3% house edge
    let multiplier = ((denominator * 97) / numerator) as u32;
    multiplier.max(100) // Minimum 1x return
}
