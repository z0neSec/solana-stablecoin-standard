use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SSSError;
use crate::events::{BlacklistAdded, BlacklistRemoved};
use crate::state::*;

#[derive(Accounts)]
pub struct BlacklistAdd<'info> {
    /// The blacklister — must have Blacklister role.
    #[account(mut)]
    pub blacklister: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
        // Feature gate: requires compliance
        constraint = stablecoin.has_feature(FEATURE_TRANSFER_HOOK) @ SSSError::ComplianceNotEnabled,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The blacklister's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), blacklister.key().as_ref(), b"blacklister"],
        bump = blacklister_role.bump,
        constraint = blacklister_role.is_active @ SSSError::Unauthorized,
    )]
    pub blacklister_role: Account<'info, RoleAccount>,

    /// The blacklist entry PDA to create.
    #[account(
        init,
        payer = blacklister,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [BLACKLIST_SEED, stablecoin.key().as_ref(), address.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    /// The address being blacklisted.
    /// CHECK: Any valid public key.
    pub address: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn add_handler(ctx: Context<BlacklistAdd>, reason: String) -> Result<()> {
    require!(reason.len() <= MAX_REASON_LEN, SSSError::StringTooLong);

    let clock = Clock::get()?;
    let entry = &mut ctx.accounts.blacklist_entry;

    entry.stablecoin = ctx.accounts.stablecoin.key();
    entry.address = ctx.accounts.address.key();
    entry.reason = reason.clone();
    entry.created_at = clock.unix_timestamp;
    entry.created_by = ctx.accounts.blacklister.key();
    entry.is_active = true;
    entry.bump = ctx.bumps.blacklist_entry;

    emit!(BlacklistAdded {
        mint: ctx.accounts.stablecoin.mint,
        address: ctx.accounts.address.key(),
        reason,
        added_by: ctx.accounts.blacklister.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct BlacklistRemove<'info> {
    /// The blacklister — must have Blacklister role.
    pub blacklister: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
        constraint = stablecoin.has_feature(FEATURE_TRANSFER_HOOK) @ SSSError::ComplianceNotEnabled,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The blacklister's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), blacklister.key().as_ref(), b"blacklister"],
        bump = blacklister_role.bump,
        constraint = blacklister_role.is_active @ SSSError::Unauthorized,
    )]
    pub blacklister_role: Account<'info, RoleAccount>,

    /// The blacklist entry PDA to deactivate.
    #[account(
        mut,
        seeds = [BLACKLIST_SEED, stablecoin.key().as_ref(), address.key().as_ref()],
        bump = blacklist_entry.bump,
        constraint = blacklist_entry.is_active @ SSSError::NotBlacklisted,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    /// The address being removed from blacklist.
    /// CHECK: Any valid public key.
    pub address: UncheckedAccount<'info>,
}

pub fn remove_handler(ctx: Context<BlacklistRemove>) -> Result<()> {
    let clock = Clock::get()?;
    ctx.accounts.blacklist_entry.is_active = false;

    emit!(BlacklistRemoved {
        mint: ctx.accounts.stablecoin.mint,
        address: ctx.accounts.address.key(),
        removed_by: ctx.accounts.blacklister.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
