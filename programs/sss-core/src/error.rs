use anchor_lang::prelude::*;

#[error_code]
pub enum SSSError {
    // ─── General ─────────────────────────────────────────────────────
    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Arithmetic overflow")]
    MathOverflow,

    #[msg("String exceeds maximum length")]
    StringTooLong,

    #[msg("Invalid decimals (must be 0-9)")]
    InvalidDecimals,

    // ─── Access Control ──────────────────────────────────────────────
    #[msg("Unauthorized: signer does not have the required role")]
    Unauthorized,

    #[msg("Unauthorized: only master authority can perform this action")]
    NotMasterAuthority,

    #[msg("Cannot revoke your own master role")]
    CannotRevokeSelf,

    #[msg("Role already granted to this address")]
    RoleAlreadyGranted,

    #[msg("Role not found or already revoked")]
    RoleNotFound,

    // ─── Pause ───────────────────────────────────────────────────────
    #[msg("Stablecoin is currently paused")]
    Paused,

    #[msg("Stablecoin is not paused")]
    NotPaused,

    // ─── Supply ──────────────────────────────────────────────────────
    #[msg("Minting would exceed the configured supply cap")]
    SupplyCapExceeded,

    #[msg("Minter quota exceeded for the current epoch")]
    MinterQuotaExceeded,

    #[msg("Insufficient token balance")]
    InsufficientBalance,

    // ─── Compliance (SSS-2) ──────────────────────────────────────────
    #[msg("Compliance features are not enabled on this stablecoin")]
    ComplianceNotEnabled,

    #[msg("Address is already blacklisted")]
    AlreadyBlacklisted,

    #[msg("Address is not blacklisted")]
    NotBlacklisted,

    #[msg("Account must be frozen before seizing tokens")]
    AccountNotFrozen,

    #[msg("Transfer hook program not configured")]
    TransferHookNotConfigured,

    // ─── Confidential (SSS-3) ────────────────────────────────────────
    #[msg("Confidential transfers are not enabled on this stablecoin")]
    ConfidentialNotEnabled,

    // ─── Configuration ───────────────────────────────────────────────
    #[msg("Invalid feature combination: transfer hook requires permanent delegate")]
    InvalidFeatureCombination,

    #[msg("Cannot enable both compliance (transfer hook) and confidential transfers")]
    IncompatibleFeatures,
}
