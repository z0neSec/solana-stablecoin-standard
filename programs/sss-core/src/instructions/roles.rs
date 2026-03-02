use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SSSError;
use crate::events::{RoleGranted, RoleRevoked, MinterQuotaUpdated};
use crate::state::*;
use crate::RoleType;

#[derive(Accounts)]
#[instruction(role: RoleType)]
pub struct GrantRole<'info> {
    /// The master authority.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
        constraint = stablecoin.authority == authority.key() @ SSSError::NotMasterAuthority,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The role PDA to create.
    #[account(
        init,
        payer = authority,
        space = 8 + RoleAccount::INIT_SPACE,
        seeds = [
            ROLE_SEED,
            stablecoin.key().as_ref(),
            grantee.key().as_ref(),
            role.seed(),
        ],
        bump,
    )]
    pub role_account: Account<'info, RoleAccount>,

    /// The address receiving the role.
    /// CHECK: Any valid public key can receive a role.
    pub grantee: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn grant_role_handler(ctx: Context<GrantRole>, role: RoleType) -> Result<()> {
    // SSS-2 roles require compliance features
    if role.requires_compliance() {
        require!(
            ctx.accounts.stablecoin.has_feature(FEATURE_PERMANENT_DELEGATE)
                || ctx.accounts.stablecoin.has_feature(FEATURE_TRANSFER_HOOK),
            SSSError::ComplianceNotEnabled
        );
    }

    let clock = Clock::get()?;
    let role_account = &mut ctx.accounts.role_account;
    role_account.stablecoin = ctx.accounts.stablecoin.key();
    role_account.holder = ctx.accounts.grantee.key();
    role_account.role_type = role as u8;
    role_account.is_active = true;
    role_account.granted_at = clock.unix_timestamp;
    role_account.granted_by = ctx.accounts.authority.key();
    role_account.bump = ctx.bumps.role_account;

    emit!(RoleGranted {
        mint: ctx.accounts.stablecoin.mint,
        holder: ctx.accounts.grantee.key(),
        role: format!("{:?}", role),
        granted_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(role: RoleType)]
pub struct RevokeRole<'info> {
    /// The master authority.
    pub authority: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
        constraint = stablecoin.authority == authority.key() @ SSSError::NotMasterAuthority,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The role PDA to deactivate.
    #[account(
        mut,
        seeds = [
            ROLE_SEED,
            stablecoin.key().as_ref(),
            revokee.key().as_ref(),
            role.seed(),
        ],
        bump = role_account.bump,
        constraint = role_account.is_active @ SSSError::RoleNotFound,
    )]
    pub role_account: Account<'info, RoleAccount>,

    /// The address losing the role.
    /// CHECK: Any valid public key.
    pub revokee: UncheckedAccount<'info>,
}

pub fn revoke_role_handler(ctx: Context<RevokeRole>, role: RoleType) -> Result<()> {
    // Cannot revoke your own master role
    if matches!(role, RoleType::Master) {
        require!(
            ctx.accounts.revokee.key() != ctx.accounts.authority.key(),
            SSSError::CannotRevokeSelf
        );
    }

    let clock = Clock::get()?;
    let role_account = &mut ctx.accounts.role_account;
    role_account.is_active = false;

    emit!(RoleRevoked {
        mint: ctx.accounts.stablecoin.mint,
        holder: ctx.accounts.revokee.key(),
        role: format!("{:?}", role),
        revoked_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateMinterQuota<'info> {
    /// The master authority.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
        constraint = stablecoin.authority == authority.key() @ SSSError::NotMasterAuthority,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The minter's quota PDA (init-if-needed for first setup).
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + MinterQuota::INIT_SPACE,
        seeds = [MINTER_QUOTA_SEED, stablecoin.key().as_ref(), minter.key().as_ref()],
        bump,
    )]
    pub minter_quota: Account<'info, MinterQuota>,

    /// The minter address.
    /// CHECK: Any valid public key.
    pub minter: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn update_minter_quota_handler(
    ctx: Context<UpdateMinterQuota>,
    quota: u64,
    epoch_duration: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    let minter_quota = &mut ctx.accounts.minter_quota;

    minter_quota.stablecoin = ctx.accounts.stablecoin.key();
    minter_quota.minter = ctx.accounts.minter.key();
    minter_quota.quota_per_epoch = quota;
    minter_quota.epoch_duration = epoch_duration;
    // Reset epoch on quota update
    minter_quota.minted_this_epoch = 0;
    minter_quota.epoch_start = clock.unix_timestamp;
    minter_quota.bump = ctx.bumps.minter_quota;

    emit!(MinterQuotaUpdated {
        mint: ctx.accounts.stablecoin.mint,
        minter: ctx.accounts.minter.key(),
        quota_per_epoch: quota,
        epoch_duration,
        updated_by: ctx.accounts.authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
