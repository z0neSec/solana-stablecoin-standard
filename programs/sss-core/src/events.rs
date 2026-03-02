use anchor_lang::prelude::*;

/// Emitted when a new stablecoin is initialized.
#[event]
pub struct StablecoinInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub features: u16,
    pub supply_cap: u64,
    pub timestamp: i64,
}

/// Emitted when tokens are minted.
#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub minter: Pubkey,
    pub new_supply: u64,
    pub timestamp: i64,
}

/// Emitted when tokens are burned.
#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub amount: u64,
    pub burner: Pubkey,
    pub new_supply: u64,
    pub timestamp: i64,
}

/// Emitted when an account is frozen.
#[event]
pub struct AccountFrozen {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub frozen_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when an account is thawed.
#[event]
pub struct AccountThawed {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub thawed_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when the stablecoin is paused or unpaused.
#[event]
pub struct PauseStatusChanged {
    pub mint: Pubkey,
    pub is_paused: bool,
    pub changed_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a role is granted.
#[event]
pub struct RoleGranted {
    pub mint: Pubkey,
    pub holder: Pubkey,
    pub role: String,
    pub granted_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when a role is revoked.
#[event]
pub struct RoleRevoked {
    pub mint: Pubkey,
    pub holder: Pubkey,
    pub role: String,
    pub revoked_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when master authority is transferred.
#[event]
pub struct AuthorityTransferred {
    pub mint: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

/// Emitted when an address is added to the blacklist (SSS-2).
#[event]
pub struct BlacklistAdded {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub reason: String,
    pub added_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when an address is removed from the blacklist (SSS-2).
#[event]
pub struct BlacklistRemoved {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when tokens are seized via permanent delegate (SSS-2).
#[event]
pub struct TokensSeized {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub seized_by: Pubkey,
    pub timestamp: i64,
}

/// Emitted when minter quota is updated.
#[event]
pub struct MinterQuotaUpdated {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub quota_per_epoch: u64,
    pub epoch_duration: i64,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}
