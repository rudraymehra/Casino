//! Commit-Reveal Randomness Implementation
//!
//! This module implements a provably fair randomness scheme where:
//! 1. Player commits to a hash of their secret
//! 2. House commits to a hash of their secret  
//! 3. Player reveals their secret (verified against commit)
//! 4. House reveals their secret (verified against commit)
//! 5. Final random = XOR of both secrets

use sha2::{Sha256, Digest};

/// Compute SHA256 hash of a secret and return as hex string
pub fn compute_commit(secret: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret);
    let result = hasher.finalize();
    hex::encode(result)
}

/// Verify that a revealed secret matches its commitment
pub fn verify_commit(secret_hex: &str, commit_hex: &str) -> Result<bool, String> {
    let secret = hex::decode(secret_hex).map_err(|e| format!("Invalid secret hex: {}", e))?;
    let expected_commit = compute_commit(&secret);
    Ok(expected_commit.to_lowercase() == commit_hex.to_lowercase())
}

/// Combine player and house secrets using XOR to produce final randomness
pub fn compute_random(player_secret_hex: &str, house_secret_hex: &str) -> Result<u64, String> {
    let player_secret = hex::decode(player_secret_hex)
        .map_err(|e| format!("Invalid player secret hex: {}", e))?;
    let house_secret = hex::decode(house_secret_hex)
        .map_err(|e| format!("Invalid house secret hex: {}", e))?;
    
    // XOR the secrets
    let mut combined = vec![0u8; player_secret.len().max(house_secret.len())];
    for (i, byte) in combined.iter_mut().enumerate() {
        let p = player_secret.get(i).copied().unwrap_or(0);
        let h = house_secret.get(i).copied().unwrap_or(0);
        *byte = p ^ h;
    }
    
    // Hash the XOR'd result for better distribution
    let mut hasher = Sha256::new();
    hasher.update(&combined);
    let hash = hasher.finalize();
    
    // Take first 8 bytes as u64
    let bytes: [u8; 8] = hash[..8].try_into().unwrap();
    Ok(u64::from_le_bytes(bytes))
}

/// Generate a random value in a range [0, max)
pub fn random_in_range(random: u64, max: u64) -> u64 {
    if max == 0 {
        return 0;
    }
    random % max
}

/// Generate multiple random values from a single seed
pub fn expand_random(seed: u64, count: usize) -> Vec<u64> {
    let mut results = Vec::with_capacity(count);
    let mut current = seed;
    
    for i in 0..count {
        // Use a simple mixing function to generate more values
        let mut hasher = Sha256::new();
        hasher.update(current.to_le_bytes());
        hasher.update((i as u64).to_le_bytes());
        let hash = hasher.finalize();
        
        let bytes: [u8; 8] = hash[..8].try_into().unwrap();
        current = u64::from_le_bytes(bytes);
        results.push(current);
    }
    
    results
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_commit_verify() {
        let secret = b"test_secret_12345678901234567890";
        let secret_hex = hex::encode(secret);
        let commit = compute_commit(secret);
        
        assert!(verify_commit(&secret_hex, &commit).unwrap());
        assert!(!verify_commit("wrong_secret", &commit).unwrap_or(false));
    }
    
    #[test]
    fn test_compute_random() {
        let player = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let house = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
        
        let random = compute_random(player, house).unwrap();
        assert!(random > 0);
        
        // Same inputs should produce same output
        let random2 = compute_random(player, house).unwrap();
        assert_eq!(random, random2);
    }
    
    #[test]
    fn test_random_in_range() {
        let random = 12345678901234567890u64;
        let result = random_in_range(random, 37);
        assert!(result < 37);
    }
}

