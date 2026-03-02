use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SSSError;
use crate::events::AuthorityTransferred;
use crate::state::*;

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    /// The current master authority.
    pub authority: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        mut,
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
        constraint = stablecoin.authority == authority.key() @ SSSError::NotMasterAuthority,
    )]
    pub stablecoin: Account<'info, StablecoinState>,
}

pub fn handler(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
    let stablecoin = &mut ctx.accounts.stablecoin;
    let old_authority = stablecoin.authority;

    stablecoin.authority = new_authority;

    let clock = Clock::get()?;
    emit!(AuthorityTransferred {
        mint: stablecoin.mint,
        old_authority,
        new_authority,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
