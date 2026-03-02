import {
  StablecoinFeatures,
  FEATURE_PERMANENT_DELEGATE,
  FEATURE_TRANSFER_HOOK,
  FEATURE_DEFAULT_FROZEN,
  FEATURE_CONFIDENTIAL_TRANSFERS,
} from "./types";

// ─── Preset Types ────────────────────────────────────────────────────────────

export interface PresetConfig {
  /** Human-readable preset name */
  name: string;
  /** Preset identifier */
  id: "SSS-1" | "SSS-2" | "SSS-3";
  /** Feature bitmask to pass to on-chain initialize */
  features: number;
  /** Description of capabilities */
  description: string;
  /** Roles automatically configured during creation */
  defaultRoles: string[];
  /** Whether transfer hook program is deployed */
  requiresTransferHook: boolean;
  /** Whether confidential transfers are enabled */
  requiresConfidentialTransfers: boolean;
}

// ─── SSS-1: Minimal ─────────────────────────────────────────────────────────

export const SSS1_PRESET: PresetConfig = {
  name: "SSS-1 Minimal",
  id: "SSS-1",
  features: 0,
  description:
    "Bare-bones stablecoin with mint/burn/RBAC. No compliance extensions. " +
    "Suitable for internal tokens, testing, or simple use-cases.",
  defaultRoles: ["master", "minter", "burner"],
  requiresTransferHook: false,
  requiresConfidentialTransfers: false,
};

// ─── SSS-2: Compliant ────────────────────────────────────────────────────────

export const SSS2_PRESET: PresetConfig = {
  name: "SSS-2 Compliant",
  id: "SSS-2",
  features:
    FEATURE_PERMANENT_DELEGATE |
    FEATURE_TRANSFER_HOOK |
    FEATURE_DEFAULT_FROZEN,
  description:
    "Full regulatory-grade stablecoin with freeze/seize, blacklisting via " +
    "transfer hooks, permanent delegate for asset seizure, and default-frozen " +
    "accounts requiring explicit approval. USDC/USDT equivalent.",
  defaultRoles: [
    "master",
    "minter",
    "burner",
    "freezer",
    "pauser",
    "blacklister",
    "seizer",
  ],
  requiresTransferHook: true,
  requiresConfidentialTransfers: false,
};

// ─── SSS-3: Private ──────────────────────────────────────────────────────────

export const SSS3_PRESET: PresetConfig = {
  name: "SSS-3 Private",
  id: "SSS-3",
  features:
    FEATURE_PERMANENT_DELEGATE |
    FEATURE_DEFAULT_FROZEN |
    FEATURE_CONFIDENTIAL_TRANSFERS,
  description:
    "Privacy-preserving stablecoin using Token-2022 confidential transfers " +
    "with auditor key for selective disclosure. No transfer hooks (incompatible " +
    "with confidential transfers). Uses auditor-based compliance model.",
  defaultRoles: [
    "master",
    "minter",
    "burner",
    "freezer",
    "pauser",
    "blacklister",
    "seizer",
  ],
  requiresTransferHook: false,
  requiresConfidentialTransfers: true,
};

// ─── Preset Registry ─────────────────────────────────────────────────────────

export const PRESETS: Record<string, PresetConfig> = {
  "SSS-1": SSS1_PRESET,
  "SSS-2": SSS2_PRESET,
  "SSS-3": SSS3_PRESET,
};

/**
 * Look up a preset by ID. Throws if not found.
 */
export function getPreset(id: string): PresetConfig {
  const preset = PRESETS[id.toUpperCase()];
  if (!preset) {
    throw new Error(
      `Unknown preset: ${id}. Available: ${Object.keys(PRESETS).join(", ")}`
    );
  }
  return preset;
}

/**
 * Build a custom feature set from individual flags.
 */
export function buildFeatures(options: {
  permanentDelegate?: boolean;
  transferHook?: boolean;
  defaultFrozen?: boolean;
  confidentialTransfers?: boolean;
}): number {
  let features = 0;
  if (options.permanentDelegate) features |= FEATURE_PERMANENT_DELEGATE;
  if (options.transferHook) features |= FEATURE_TRANSFER_HOOK;
  if (options.defaultFrozen) features |= FEATURE_DEFAULT_FROZEN;
  if (options.confidentialTransfers)
    features |= FEATURE_CONFIDENTIAL_TRANSFERS;

  // Validate incompatible features
  if (options.transferHook && options.confidentialTransfers) {
    throw new Error(
      "Transfer hooks and confidential transfers are incompatible in Token-2022"
    );
  }

  return features;
}

/**
 * Parse a feature bitmask into human-readable flags.
 */
export function parseFeatures(features: number): {
  permanentDelegate: boolean;
  transferHook: boolean;
  defaultFrozen: boolean;
  confidentialTransfers: boolean;
} {
  return {
    permanentDelegate: (features & FEATURE_PERMANENT_DELEGATE) !== 0,
    transferHook: (features & FEATURE_TRANSFER_HOOK) !== 0,
    defaultFrozen: (features & FEATURE_DEFAULT_FROZEN) !== 0,
    confidentialTransfers: (features & FEATURE_CONFIDENTIAL_TRANSFERS) !== 0,
  };
}
