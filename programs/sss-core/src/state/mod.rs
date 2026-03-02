use anchor_lang::prelude::*;

// ─── Feature Flags (bitfield) ────────────────────────────────────────────────
/// Stored in StablecoinState.features as u16 bitflags.
/// Used for runtime feature gating of SSS-2/SSS-3 instructions.
pub const FEATURE_PERMANENT_DELEGATE: u16 = 1 << 0;
pub const FEATURE_TRANSFER_HOOK: u16 = 1 << 1;
pub const FEATURE_DEFAULT_FROZEN: u16 = 1 << 2;
pub const FEATURE_CONFIDENTIAL_TRANSFERS: u16 = 1 << 3;

/// SSS-1 preset: no compliance features
pub const PRESET_SSS1: u16 = 0;

/// SSS-2 preset: permanent delegate + transfer hook + default frozen
pub const PRESET_SSS2: u16 =
    FEATURE_PERMANENT_DELEGATE | FEATURE_TRANSFER_HOOK | FEATURE_DEFAULT_FROZEN;

/// SSS-3 preset: confidential transfers (experimental)
pub const PRESET_SSS3: u16 = FEATURE_CONFIDENTIAL_TRANSFERS;

/// Core stablecoin state PDA.
/// Seeds: ["stablecoin", mint.key()]
#[account]
#[derive(InitSpace)]
pub struct StablecoinState {
    /// The master authority who can manage roles and configuration.
    pub authority: Pubkey,

    /// The Token-2022 mint address.
    pub mint: Pubkey,

    /// Human-readable name (max 32 bytes).
    #[max_len(32)]
    pub name: String,

    /// Ticker symbol (max 10 bytes).
    #[max_len(10)]
    pub symbol: String,

    /// Metadata URI (max 200 bytes).
    #[max_len(200)]
    pub uri: String,

    /// Token decimals (0-9).
    pub decimals: u8,

    /// Bitflags of enabled features (see FEATURE_* constants).
    pub features: u16,

    /// Whether all operations are paused.
    pub is_paused: bool,

    /// Total minted supply (tracked on-chain for audit clarity).
    pub total_minted: u64,

    /// Total burned supply.
    pub total_burned: u64,

    /// Optional supply cap (0 = no cap).
    pub supply_cap: u64,

    /// Transfer hook program ID (only for SSS-2).
    pub transfer_hook_program: Pubkey,

    /// PDA canonical bump.
    pub bump: u8,

    /// Version field for future upgrades.
    pub version: u8,

    /// Reserved space for future fields.
    pub _reserved: [u8; 64],
}

impl StablecoinState {
    pub fn has_feature(&self, feature: u16) -> bool {
        self.features & feature != 0
    }

    pub fn current_supply(&self) -> u64 {
        self.total_minted.saturating_sub(self.total_burned)
    }

    pub fn can_mint(&self, amount: u64) -> bool {
        if self.supply_cap == 0 {
            return true;
        }
        self.current_supply()
            .checked_add(amount)
            .map(|new_supply| new_supply <= self.supply_cap)
            .unwrap_or(false)
    }
}

/// Role PDA — one per (stablecoin, address, role_type).
/// Seeds: ["role", stablecoin.key(), address, role_seed]
#[account]
#[derive(InitSpace)]
pub struct RoleAccount {
    /// The stablecoin this role belongs to.
    pub stablecoin: Pubkey,

    /// The address that holds this role.
    pub holder: Pubkey,

    /// Role type discriminator byte.
    pub role_type: u8,

    /// Whether this role is currently active.
    pub is_active: bool,

    /// When this role was granted (Unix timestamp).
    pub granted_at: i64,

    /// Who granted this role.
    pub granted_by: Pubkey,

    /// PDA canonical bump.
    pub bump: u8,
}

/// Minter quota PDA — per-minter rate limiting.
/// Seeds: ["minter_quota", stablecoin.key(), minter.key()]
#[account]
#[derive(InitSpace)]
pub struct MinterQuota {
    /// The stablecoin this quota belongs to.
    pub stablecoin: Pubkey,

    /// The minter address.
    pub minter: Pubkey,

    /// Maximum tokens this minter can mint per epoch.
    pub quota_per_epoch: u64,

    /// Tokens already minted in the current epoch.
    pub minted_this_epoch: u64,

    /// Start time of the current epoch (Unix timestamp).
    pub epoch_start: i64,

    /// Duration of each epoch in seconds.
    pub epoch_duration: i64,

    /// PDA canonical bump.
    pub bump: u8,
}

impl MinterQuota {
    /// Check and update quota. Returns Ok(()) if minting is allowed.
    pub fn check_and_update(&mut self, amount: u64, now: i64) -> Result<()> {
        // Reset epoch if expired
        if now >= self.epoch_start + self.epoch_duration {
            self.minted_this_epoch = 0;
            self.epoch_start = now;
        }

        let new_total = self
            .minted_this_epoch
            .checked_add(amount)
            .ok_or(error!(crate::error::SSSError::MathOverflow))?;

        require!(
            new_total <= self.quota_per_epoch,
            crate::error::SSSError::MinterQuotaExceeded
        );

        self.minted_this_epoch = new_total;
        Ok(())
    }
}

/// Blacklist entry PDA — per-address compliance record (SSS-2 only).
/// Seeds: ["blacklist", stablecoin.key(), address]
#[account]
#[derive(InitSpace)]
pub struct BlacklistEntry {
    /// The stablecoin this entry belongs to.
    pub stablecoin: Pubkey,

    /// The blacklisted address.
    pub address: Pubkey,

    /// Reason for blacklisting (max 128 bytes).
    #[max_len(128)]
    pub reason: String,

    /// When this entry was created (Unix timestamp).
    pub created_at: i64,

    /// Who added this entry.
    pub created_by: Pubkey,

    /// Whether this entry is currently active.
    pub is_active: bool,

    /// PDA canonical bump.
    pub bump: u8,
}
