use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::*;
use crate::state::*;

#[derive(Accounts)]
pub struct GetSupply<'info> {
    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The Token-2022 mint.
    #[account(constraint = mint.key() == stablecoin.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
}

pub fn total_supply_handler(ctx: Context<GetSupply>) -> Result<()> {
    let supply = ctx.accounts.stablecoin.current_supply();

    msg!("total_supply:{}", supply);
    msg!("total_minted:{}", ctx.accounts.stablecoin.total_minted);
    msg!("total_burned:{}", ctx.accounts.stablecoin.total_burned);
    msg!("mint_supply:{}", ctx.accounts.mint.supply);

    Ok(())
}

#[derive(Accounts)]
pub struct GetStatus<'info> {
    /// The stablecoin state PDA.
    #[account(
        seeds = [STABLECOIN_SEED, stablecoin.mint.as_ref()],
        bump = stablecoin.bump,
    )]
    pub stablecoin: Account<'info, StablecoinState>,
}

pub fn status_handler(ctx: Context<GetStatus>) -> Result<()> {
    let s = &ctx.accounts.stablecoin;

    msg!("name:{}", s.name);
    msg!("symbol:{}", s.symbol);
    msg!("decimals:{}", s.decimals);
    msg!("is_paused:{}", s.is_paused);
    msg!("features:{}", s.features);
    msg!("supply_cap:{}", s.supply_cap);
    msg!("current_supply:{}", s.current_supply());
    msg!("authority:{}", s.authority);
    msg!("version:{}", s.version);

    Ok(())
}
