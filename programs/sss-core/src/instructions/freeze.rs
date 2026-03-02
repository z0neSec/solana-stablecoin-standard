use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::SSSError;
use crate::events::{AccountFrozen, AccountThawed};
use crate::state::*;

#[derive(Accounts)]
pub struct FreezeTokenAccount<'info> {
    /// The freezer — must have Freezer role.
    pub freezer: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin.bump,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The freezer's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), freezer.key().as_ref(), b"freezer"],
        bump = freezer_role.bump,
        constraint = freezer_role.is_active @ SSSError::Unauthorized,
    )]
    pub freezer_role: Account<'info, RoleAccount>,

    /// The Token-2022 mint.
    #[account(constraint = mint.key() == stablecoin.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The token account to freeze.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn freeze_handler(ctx: Context<FreezeTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let signer_seeds: &[&[u8]] = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.stablecoin.bump],
    ];

    anchor_spl::token_2022::freeze_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_2022::FreezeAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.stablecoin.to_account_info(),
            },
            &[signer_seeds],
        ),
    )?;

    let clock = Clock::get()?;
    emit!(AccountFrozen {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.token_account.key(),
        frozen_by: ctx.accounts.freezer.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ThawTokenAccount<'info> {
    /// The freezer — must have Freezer role.
    pub freezer: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = stablecoin.bump,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The freezer's role PDA.
    #[account(
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), freezer.key().as_ref(), b"freezer"],
        bump = freezer_role.bump,
        constraint = freezer_role.is_active @ SSSError::Unauthorized,
    )]
    pub freezer_role: Account<'info, RoleAccount>,

    /// The Token-2022 mint.
    #[account(constraint = mint.key() == stablecoin.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The token account to thaw.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn thaw_handler(ctx: Context<ThawTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let signer_seeds: &[&[u8]] = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.stablecoin.bump],
    ];

    anchor_spl::token_2022::thaw_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_2022::ThawAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.stablecoin.to_account_info(),
            },
            &[signer_seeds],
        ),
    )?;

    let clock = Clock::get()?;
    emit!(AccountThawed {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.token_account.key(),
        thawed_by: ctx.accounts.freezer.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
