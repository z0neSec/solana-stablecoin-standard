use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::SSSError;
use crate::events::TokensSeized;
use crate::state::*;

#[derive(Accounts)]
pub struct Seize<'info> {
    /// The seizer — must have Seizer role.
    pub seizer: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin.bump,
        // Feature gate: requires permanent delegate
        constraint = stablecoin.has_feature(FEATURE_PERMANENT_DELEGATE) @ SSSError::ComplianceNotEnabled,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The seizer's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), seizer.key().as_ref(), b"seizer"],
        bump = seizer_role.bump,
        constraint = seizer_role.is_active @ SSSError::Unauthorized,
    )]
    pub seizer_role: Account<'info, RoleAccount>,

    /// The Token-2022 mint.
    #[account(constraint = mint.key() == stablecoin.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The frozen source account to seize from.
    /// Must be frozen before seizing.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = from_account.is_frozen() @ SSSError::AccountNotFrozen,
    )]
    pub from_account: InterfaceAccount<'info, TokenAccount>,

    /// The treasury account to transfer seized tokens to.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Seize>, amount: u64) -> Result<()> {
    require!(amount > 0, SSSError::ZeroAmount);

    let mint_key = ctx.accounts.mint.key();
    let signer_seeds: &[&[u8]] = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.stablecoin.bump],
    ];

    // Use transfer_checked via permanent delegate authority.
    // The stablecoin PDA is the permanent delegate, so it can
    // transfer from any token account without the owner's signature.
    anchor_spl::token_2022::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_2022::TransferChecked {
                from: ctx.accounts.from_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.treasury_account.to_account_info(),
                authority: ctx.accounts.stablecoin.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let clock = Clock::get()?;
    emit!(TokensSeized {
        mint: ctx.accounts.mint.key(),
        from: ctx.accounts.from_account.key(),
        to: ctx.accounts.treasury_account.key(),
        amount,
        seized_by: ctx.accounts.seizer.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
