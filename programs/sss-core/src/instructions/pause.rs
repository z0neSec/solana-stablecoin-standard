use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SSSError;
use crate::events::PauseStatusChanged;
use crate::state::*;

#[derive(Accounts)]
pub struct PauseUnpause<'info> {
    /// The pauser — must have Pauser role.
    pub pauser: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The pauser's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), pauser.key().as_ref(), b"pauser"],
        bump = pauser_role.bump,
        constraint = pauser_role.is_active @ SSSError::Unauthorized,
    )]
    pub pauser_role: Account<'info, RoleAccount>,
}

pub fn pause_handler(ctx: Context<PauseUnpause>) -> Result<()> {
    let stablecoin = &mut ctx.accounts.stablecoin;
    require!(!stablecoin.is_paused, SSSError::Paused);

    stablecoin.is_paused = true;

    let clock = Clock::get()?;
    emit!(PauseStatusChanged {
        mint: stablecoin.mint,
        is_paused: true,
        changed_by: ctx.accounts.pauser.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

pub fn unpause_handler(ctx: Context<PauseUnpause>) -> Result<()> {
    let stablecoin = &mut ctx.accounts.stablecoin;
    require!(stablecoin.is_paused, SSSError::NotPaused);

    stablecoin.is_paused = false;

    let clock = Clock::get()?;
    emit!(PauseStatusChanged {
        mint: stablecoin.mint,
        is_paused: false,
        changed_by: ctx.accounts.pauser.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
