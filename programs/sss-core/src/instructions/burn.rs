use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::SSSError;
use crate::events::TokensBurned;
use crate::state::*;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    /// The burner — must have Burner role.
    #[account(mut)]
    pub burner: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        mut,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin.bump,
        constraint = !stablecoin.is_paused @ SSSError::Paused,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The burner's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), burner.key().as_ref(), b"burner"],
        bump = burner_role.bump,
        constraint = burner_role.is_active @ SSSError::Unauthorized,
    )]
    pub burner_role: Account<'info, RoleAccount>,

    /// The Token-2022 mint.
    #[account(
        mut,
        constraint = mint.key() == stablecoin.mint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The token account to burn from (must be owned by burner).
    #[account(
        mut,
        token::mint = mint,
        token::authority = burner,
        token::token_program = token_program,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn burn_handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SSSError::ZeroAmount);

    let stablecoin = &mut ctx.accounts.stablecoin;
    let clock = Clock::get()?;

    // Burn tokens via CPI
    anchor_spl::token_2022::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_2022::Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.burner.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update state
    stablecoin.total_burned = stablecoin
        .total_burned
        .checked_add(amount)
        .ok_or(SSSError::MathOverflow)?;

    // Emit event
    emit!(TokensBurned {
        mint: ctx.accounts.mint.key(),
        amount,
        burner: ctx.accounts.burner.key(),
        new_supply: stablecoin.current_supply(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
