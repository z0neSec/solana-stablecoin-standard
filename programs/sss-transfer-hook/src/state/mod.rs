use anchor_lang::prelude::*;

/// Transfer hook state PDA for a stablecoin mint.
/// Seeds: ["hook_state", mint]
#[account]
#[derive(InitSpace)]
pub struct HookState {
    /// The Token-2022 mint this hook is for.
    pub mint: Pubkey,

    /// The sss-core stablecoin state PDA.
    pub stablecoin: Pubkey,

    /// Whether the hook is active.
    pub is_active: bool,

    /// Total transfers checked.
    pub transfers_checked: u64,

    /// Total transfers blocked.
    pub transfers_blocked: u64,

    /// PDA canonical bump.
    pub bump: u8,
}
