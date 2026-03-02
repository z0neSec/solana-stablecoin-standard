use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::SSSError;
use crate::events::TokensMinted;
use crate::state::*;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    /// The minter — must have Minter role.
    #[account(mut)]
    pub minter: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        mut,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin.bump,
        constraint = !stablecoin.is_paused @ SSSError::Paused,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The minter's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), minter.key().as_ref(), b"minter"],
        bump = minter_role.bump,
        constraint = minter_role.is_active @ SSSError::Unauthorized,
    )]
    pub minter_role: Account<'info, RoleAccount>,

    /// The minter's quota PDA.
    #[account(
        mut,
        seeds = [MINTER_QUOTA_SEED, stablecoin.key().as_ref(), minter.key().as_ref()],
        bump = minter_quota.bump,
    )]
    pub minter_quota: Account<'info, MinterQuota>,

    /// The Token-2022 mint.
    #[account(
        mut,
        constraint = mint.key() == stablecoin.mint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The recipient's token account.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SSSError::ZeroAmount);

    let stablecoin = &mut ctx.accounts.stablecoin;

    // Check supply cap
    require!(stablecoin.can_mint(amount), SSSError::SupplyCapExceeded);

    // Check and update minter quota
    let clock = Clock::get()?;
    ctx.accounts
        .minter_quota
        .check_and_update(amount, clock.unix_timestamp)?;

    // Mint tokens via CPI (stablecoin PDA is the mint authority)
    let mint_key = ctx.accounts.mint.key();
    let signer_seeds: &[&[u8]] = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[stablecoin.bump],
    ];

    anchor_spl::token_2022::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_2022::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: stablecoin.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    // Update state
    stablecoin.total_minted = stablecoin
        .total_minted
        .checked_add(amount)
        .ok_or(SSSError::MathOverflow)?;

    // Emit event
    emit!(TokensMinted {
        mint: ctx.accounts.mint.key(),
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        minter: ctx.accounts.minter.key(),
        new_supply: stablecoin.current_supply(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
