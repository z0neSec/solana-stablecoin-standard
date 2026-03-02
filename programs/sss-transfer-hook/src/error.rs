use anchor_lang::prelude::*;

#[error_code]
pub enum HookError {
    #[msg("Source address is blacklisted")]
    SourceBlacklisted,

    #[msg("Destination address is blacklisted")]
    DestinationBlacklisted,

    #[msg("Transfer hook is deactivated")]
    HookDeactivated,
}
