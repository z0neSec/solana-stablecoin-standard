/**
 * SSS Error codes — mirrors on-chain SSSError + HookError enums
 */

// ─── Core Program Errors ─────────────────────────────────────────────────────

export enum SSSErrorCode {
  // Matches Rust SSSError enum declaration order (Anchor starts at 6000)
  ZeroAmount = 6000,
  MathOverflow = 6001,
  StringTooLong = 6002,
  InvalidDecimals = 6003,
  Unauthorized = 6004,
  NotMasterAuthority = 6005,
  CannotRevokeSelf = 6006,
  RoleAlreadyGranted = 6007,
  RoleNotFound = 6008,
  Paused = 6009,
  NotPaused = 6010,
  SupplyCapExceeded = 6011,
  MinterQuotaExceeded = 6012,
  InsufficientBalance = 6013,
  ComplianceNotEnabled = 6014,
  AlreadyBlacklisted = 6015,
  NotBlacklisted = 6016,
  AccountNotFrozen = 6017,
  TransferHookNotConfigured = 6018,
  ConfidentialNotEnabled = 6019,
  InvalidFeatureCombination = 6020,
  IncompatibleFeatures = 6021,
}

// ─── Hook Program Errors ─────────────────────────────────────────────────────

export enum HookErrorCode {
  SenderBlacklisted = 6100,
  RecipientBlacklisted = 6101,
  HookNotActive = 6102,
}

// ─── Error Messages ──────────────────────────────────────────────────────────

const CORE_ERROR_MESSAGES: Record<number, string> = {
  [SSSErrorCode.ZeroAmount]: "Amount must be greater than zero",
  [SSSErrorCode.MathOverflow]: "Arithmetic overflow",
  [SSSErrorCode.StringTooLong]: "String exceeds maximum length",
  [SSSErrorCode.InvalidDecimals]: "Invalid decimals (must be 0-9)",
  [SSSErrorCode.Unauthorized]:
    "Unauthorized: signer does not have the required role",
  [SSSErrorCode.NotMasterAuthority]:
    "Unauthorized: only master authority can perform this action",
  [SSSErrorCode.CannotRevokeSelf]: "Cannot revoke your own master role",
  [SSSErrorCode.RoleAlreadyGranted]:
    "Role has already been granted to this address",
  [SSSErrorCode.RoleNotFound]: "Role not found or already revoked",
  [SSSErrorCode.Paused]:
    "Stablecoin is paused — all operations suspended",
  [SSSErrorCode.NotPaused]: "Stablecoin is not paused",
  [SSSErrorCode.SupplyCapExceeded]:
    "Minting would exceed the configured supply cap",
  [SSSErrorCode.MinterQuotaExceeded]:
    "Minter has exceeded their quota for this epoch",
  [SSSErrorCode.InsufficientBalance]:
    "Insufficient token balance",
  [SSSErrorCode.ComplianceNotEnabled]:
    "Compliance features are not enabled on this stablecoin",
  [SSSErrorCode.AlreadyBlacklisted]: "Address is already blacklisted",
  [SSSErrorCode.NotBlacklisted]: "Address is not blacklisted",
  [SSSErrorCode.AccountNotFrozen]:
    "Account must be frozen before seizing tokens",
  [SSSErrorCode.TransferHookNotConfigured]:
    "Transfer hook program not configured",
  [SSSErrorCode.ConfidentialNotEnabled]:
    "Confidential transfers are not enabled on this stablecoin",
  [SSSErrorCode.InvalidFeatureCombination]:
    "Invalid feature combination: transfer hook requires permanent delegate",
  [SSSErrorCode.IncompatibleFeatures]:
    "Cannot enable both compliance (transfer hook) and confidential transfers",
};

const HOOK_ERROR_MESSAGES: Record<number, string> = {
  [HookErrorCode.SenderBlacklisted]:
    "Transfer blocked: sender is blacklisted",
  [HookErrorCode.RecipientBlacklisted]:
    "Transfer blocked: recipient is blacklisted",
  [HookErrorCode.HookNotActive]:
    "Transfer hook is not active for this stablecoin",
};

// ─── Error Class ─────────────────────────────────────────────────────────────

export class SSSError extends Error {
  public readonly code: number;
  public readonly programError: boolean;

  constructor(code: number, message?: string) {
    const msg =
      message ??
      CORE_ERROR_MESSAGES[code] ??
      HOOK_ERROR_MESSAGES[code] ??
      `Unknown SSS error: ${code}`;
    super(msg);
    this.name = "SSSError";
    this.code = code;
    this.programError = true;
  }

  static fromAnchorError(err: any): SSSError {
    if (err?.error?.errorCode?.number) {
      return new SSSError(err.error.errorCode.number, err.error.errorMessage);
    }
    if (err?.code) {
      return new SSSError(err.code, err.message);
    }
    return new SSSError(-1, err?.message ?? String(err));
  }
}

/**
 * Wrap an async SDK call to produce typed SSSError on failure.
 */
export async function withSSSError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    throw SSSError.fromAnchorError(err);
  }
}
