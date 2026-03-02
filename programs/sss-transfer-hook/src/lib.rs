use anchor_lang::prelude::*;
use spl_transfer_hook_interface::instruction::TransferHookInstruction;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("HookSSS111111111111111111111111111111111111");

/// SSS Transfer Hook — Enforces blacklist checks on every Token-2022 transfer.
///
/// This program implements the SPL Transfer Hook Interface. When wired to a
/// Token-2022 mint, it is called automatically on every `transfer_checked` CPI.
/// It checks the source and destination against a blacklist and rejects
/// transfers involving blacklisted addresses.
#[program]
pub mod sss_transfer_hook {
    use super::*;

    /// Initialize the transfer hook state for a stablecoin mint.
    /// Called once after the mint is created.
    pub fn initialize_hook(
        ctx: Context<InitializeHook>,
        stablecoin: Pubkey,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, stablecoin)
    }

    /// The transfer hook execution function.
    /// Called automatically by Token-2022 on every transfer_checked.
    /// Checks source and destination against the blacklist.
    pub fn transfer_hook(ctx: Context<TransferHookExec>, amount: u64) -> Result<()> {
        instructions::execute::handler(ctx, amount)
    }

    /// SPL Transfer Hook Interface fallback.
    /// Routes Execute instruction to our transfer_hook handler.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data);

        match instruction {
            Ok(TransferHookInstruction::Execute { amount }) => {
                let amount_bytes = amount.to_le_bytes();
                // Invoke our transfer_hook instruction
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}
