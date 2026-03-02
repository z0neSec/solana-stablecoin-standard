/**
 * @stbr/sss-token — Solana Stablecoin Standard SDK
 *
 * A modular toolkit for creating and managing Token-2022 stablecoins on Solana.
 * Supports three opinionated presets:
 *
 * | Preset | Name                 | Features                                          |
 * |--------|----------------------|---------------------------------------------------|
 * | SSS-1  | Minimal Stablecoin   | Mint + freeze + metadata                          |
 * | SSS-2  | Compliant Stablecoin | SSS-1 + permanent delegate + transfer hook + blacklist |
 * | SSS-3  | Private Stablecoin   | SSS-1 + confidential transfers (experimental)     |
 *
 * @example
 * ```typescript
 * import { SolanaStablecoin, Presets } from "@stbr/sss-token";
 *
 * const stable = await SolanaStablecoin.create(connection, {
 *   preset: Presets.SSS_2,
 *   name: "Regulated USD",
 *   symbol: "rUSD",
 *   decimals: 6,
 *   authority: adminKeypair,
 * });
 *
 * await stable.mint({ recipient, amount: 1_000_000n, minter: minterKeypair });
 * await stable.compliance.blacklistAdd(address, "OFAC match");
 * ```
 */

// Core client
export { SolanaStablecoin } from "./client";
export type {
  CreateStablecoinParams,
  CreateStablecoinResult,
  SolanaStablecoinConfig,
} from "./client";

// Presets
export {
  PRESETS,
  SSS1_PRESET,
  SSS2_PRESET,
  SSS3_PRESET,
  getPreset,
  buildFeatures,
  parseFeatures,
} from "./presets";
export type { PresetConfig } from "./presets";

// PDA helpers
export {
  getStablecoinAddress,
  getRoleAddress,
  getMinterQuotaAddress,
  getBlacklistAddress,
  getHookStateAddress,
  deriveStablecoinAddresses,
  STABLECOIN_SEED,
  ROLE_SEED,
  MINTER_QUOTA_SEED,
  BLACKLIST_SEED,
  HOOK_STATE_SEED,
} from "./pda";

// Types
export {
  RoleType,
  StablecoinFeatures,
  FEATURE_PERMANENT_DELEGATE,
  FEATURE_TRANSFER_HOOK,
  FEATURE_DEFAULT_FROZEN,
  FEATURE_CONFIDENTIAL_TRANSFERS,
} from "./types";

// Errors
export { SSSErrorCode, HookErrorCode, SSSError, withSSSError } from "./errors";

// Compliance module
export { ComplianceModule } from "./compliance";

// Instructions (low-level)
export * as instructions from "./instructions";
