use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("CoreSSS111111111111111111111111111111111111");

/// Solana Stablecoin Standard — Core Program
///
/// A single configurable program supporting SSS-1 (Minimal), SSS-2 (Compliant),
/// and SSS-3 (Private) presets via initialization parameters.
///
/// ## Architecture
/// - Layer 1 (Base): Token creation, mint/burn, freeze/thaw, role management
/// - Layer 2 (Modules): Compliance (blacklist, seize), Privacy (confidential transfers)
/// - Layer 3 (Presets): SSS-1, SSS-2, SSS-3 as opinionated configurations
#[program]
pub mod sss_core {
    use super::*;

    // ─── Layer 1: Base Operations ────────────────────────────────────

    /// Initialize a new stablecoin with the given configuration.
    /// Creates the Token-2022 mint with requested extensions and sets up
    /// the stablecoin state PDA. The caller becomes the master authority.
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    /// Mint tokens to a recipient. Caller must have the Minter role.
    /// Respects per-minter quotas and global supply cap if configured.
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }

    /// Burn tokens from the caller's account. Caller must have the Burner role.
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }

    /// Freeze a token account. Caller must have the Freezer role.
    pub fn freeze_account(ctx: Context<FreezeTokenAccount>) -> Result<()> {
        instructions::freeze::freeze_handler(ctx)
    }

    /// Thaw a frozen token account. Caller must have the Freezer role.
    pub fn thaw_account(ctx: Context<ThawTokenAccount>) -> Result<()> {
        instructions::freeze::thaw_handler(ctx)
    }

    /// Pause all stablecoin operations. Caller must have the Pauser role.
    pub fn pause(ctx: Context<PauseUnpause>) -> Result<()> {
        instructions::pause::pause_handler(ctx)
    }

    /// Unpause stablecoin operations. Caller must have the Pauser role.
    pub fn unpause(ctx: Context<PauseUnpause>) -> Result<()> {
        instructions::pause::unpause_handler(ctx)
    }

    // ─── Role Management ─────────────────────────────────────────────

    /// Grant a role to an address. Caller must be master authority.
    pub fn grant_role(ctx: Context<GrantRole>, role: RoleType) -> Result<()> {
        instructions::roles::grant_role_handler(ctx, role)
    }

    /// Revoke a role from an address. Caller must be master authority.
    pub fn revoke_role(ctx: Context<RevokeRole>, role: RoleType) -> Result<()> {
        instructions::roles::revoke_role_handler(ctx, role)
    }

    /// Update minter quota. Caller must be master authority.
    pub fn update_minter_quota(
        ctx: Context<UpdateMinterQuota>,
        quota: u64,
        epoch_duration: i64,
    ) -> Result<()> {
        instructions::roles::update_minter_quota_handler(ctx, quota, epoch_duration)
    }

    /// Transfer master authority to a new address.
    /// This is a critical operation — the old authority loses all control.
    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::authority::handler(ctx, new_authority)
    }

    // ─── Layer 2: SSS-2 Compliance Operations ───────────────────────

    /// Add an address to the blacklist. Caller must have the Blacklister role.
    /// Fails gracefully if compliance module was not enabled at initialization.
    pub fn blacklist_add(
        ctx: Context<BlacklistAdd>,
        reason: String,
    ) -> Result<()> {
        instructions::blacklist::add_handler(ctx, reason)
    }

    /// Remove an address from the blacklist. Caller must have the Blacklister role.
    pub fn blacklist_remove(ctx: Context<BlacklistRemove>) -> Result<()> {
        instructions::blacklist::remove_handler(ctx)
    }

    /// Seize tokens from a frozen account via permanent delegate authority.
    /// Caller must have the Seizer role. Account must be frozen first.
    /// Fails gracefully if compliance module was not enabled at initialization.
    pub fn seize(ctx: Context<Seize>, amount: u64) -> Result<()> {
        instructions::seize::handler(ctx, amount)
    }

    // ─── Views ───────────────────────────────────────────────────────

    /// Get the total supply of the stablecoin.
    pub fn get_total_supply(ctx: Context<GetSupply>) -> Result<()> {
        instructions::views::total_supply_handler(ctx)
    }

    /// Get stablecoin status (paused, supply, config).
    pub fn get_status(ctx: Context<GetStatus>) -> Result<()> {
        instructions::views::status_handler(ctx)
    }
}

/// Role types for the RBAC system.
/// Each role is stored as a separate PDA per (stablecoin, address, role_type).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum RoleType {
    Master,
    Minter,
    Burner,
    Freezer,
    Pauser,
    Blacklister,
    Seizer,
}

impl RoleType {
    pub fn seed(&self) -> &[u8] {
        match self {
            RoleType::Master => b"master",
            RoleType::Minter => b"minter",
            RoleType::Burner => b"burner",
            RoleType::Freezer => b"freezer",
            RoleType::Pauser => b"pauser",
            RoleType::Blacklister => b"blacklister",
            RoleType::Seizer => b"seizer",
        }
    }

    /// Returns true if this role requires SSS-2 compliance features.
    pub fn requires_compliance(&self) -> bool {
        matches!(self, RoleType::Blacklister | RoleType::Seizer)
    }
}
