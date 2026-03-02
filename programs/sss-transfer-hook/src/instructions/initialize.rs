use anchor_lang::prelude::*;
use crate::state::HookState;

pub const HOOK_STATE_SEED: &[u8] = b"hook_state";

#[derive(Accounts)]
pub struct InitializeHook<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The Token-2022 mint.
    /// CHECK: Validated by the caller (sss-core).
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + HookState::INIT_SPACE,
        seeds = [HOOK_STATE_SEED, mint.key().as_ref()],
        bump,
    )]
    pub hook_state: Account<'info, HookState>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeHook>, stablecoin: Pubkey) -> Result<()> {
    let hook_state = &mut ctx.accounts.hook_state;
    hook_state.mint = ctx.accounts.mint.key();
    hook_state.stablecoin = stablecoin;
    hook_state.is_active = true;
    hook_state.transfers_checked = 0;
    hook_state.transfers_blocked = 0;
    hook_state.bump = ctx.bumps.hook_state;

    Ok(())
}
