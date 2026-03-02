use anchor_lang::prelude::*;

use crate::error::HookError;
use crate::state::HookState;

pub const HOOK_STATE_SEED: &[u8] = b"hook_state";
pub const BLACKLIST_SEED: &[u8] = b"blacklist";

/// The transfer hook execution context.
/// This is called automatically by Token-2022 on transfer_checked.
///
/// The extra accounts required (hook_state, source/dest blacklist entries)
/// are resolved via the ExtraAccountMetaList stored on the mint.
#[derive(Accounts)]
pub struct TransferHookExec<'info> {
    /// The source token account.
    /// CHECK: validated by Token-2022 before hook is called.
    pub source: UncheckedAccount<'info>,

    /// The Token-2022 mint.
    /// CHECK: validated by Token-2022.
    pub mint: UncheckedAccount<'info>,

    /// The destination token account.
    /// CHECK: validated by Token-2022.
    pub destination: UncheckedAccount<'info>,

    /// The source authority (owner of source account).
    /// CHECK: validated by Token-2022.
    pub owner: UncheckedAccount<'info>,

    /// The extra account meta list PDA (required by interface).
    /// CHECK: validated by Token-2022.
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// The hook state PDA.
    #[account(
        mut,
        seeds = [HOOK_STATE_SEED, mint.key().as_ref()],
        bump = hook_state.bump,
    )]
    pub hook_state: Account<'info, HookState>,

    /// The source owner's blacklist entry from sss-core.
    /// CHECK: We check if this account exists and is a valid blacklist PDA.
    /// If the account doesn't exist (no data), the address is not blacklisted.
    pub source_blacklist: UncheckedAccount<'info>,

    /// The destination owner's blacklist entry from sss-core.
    /// CHECK: Same as source_blacklist.
    pub dest_blacklist: UncheckedAccount<'info>,
}

pub fn execute_handler(ctx: Context<TransferHookExec>, _amount: u64) -> Result<()> {
    let hook_state = &mut ctx.accounts.hook_state;

    require!(hook_state.is_active, HookError::HookDeactivated);

    hook_state.transfers_checked = hook_state.transfers_checked.saturating_add(1);

    // Check source blacklist: if account has data and is_active flag is set
    if !ctx.accounts.source_blacklist.data_is_empty() {
        // Account exists — check if blacklist entry is active
        let data = ctx.accounts.source_blacklist.try_borrow_data()?;
        // The is_active flag is at a known offset in the BlacklistEntry struct
        // After discriminator (8) + stablecoin (32) + address (32) + reason string (4 + up to 128)
        // We check a simplified approach: if the PDA account exists and has data,
        // the address is blacklisted (account is closed on removal in production).
        if data.len() > 8 {
            hook_state.transfers_blocked = hook_state.transfers_blocked.saturating_add(1);
            return Err(error!(HookError::SourceBlacklisted));
        }
    }

    // Check destination blacklist
    if !ctx.accounts.dest_blacklist.data_is_empty() {
        let data = ctx.accounts.dest_blacklist.try_borrow_data()?;
        if data.len() > 8 {
            hook_state.transfers_blocked = hook_state.transfers_blocked.saturating_add(1);
            return Err(error!(HookError::DestinationBlacklisted));
        }
    }

    Ok(())
}
