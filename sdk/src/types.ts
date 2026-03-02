import { PublicKey } from "@solana/web3.js";

// Core program ID (replace with actual after deployment)
export const SSS_CORE_PROGRAM_ID = new PublicKey(
  "CoreSSS111111111111111111111111111111111111"
);

// Transfer hook program ID (replace with actual after deployment)
export const SSS_HOOK_PROGRAM_ID = new PublicKey(
  "HookSSS111111111111111111111111111111111111"
);

// ─── Feature Flags ───────────────────────────────────────────────────────────

export const FEATURE_PERMANENT_DELEGATE = 1 << 0;
export const FEATURE_TRANSFER_HOOK = 1 << 1;
export const FEATURE_DEFAULT_FROZEN = 1 << 2;
export const FEATURE_CONFIDENTIAL_TRANSFERS = 1 << 3;

export enum StablecoinFeatures {
  PermanentDelegate = FEATURE_PERMANENT_DELEGATE,
  TransferHook = FEATURE_TRANSFER_HOOK,
  DefaultFrozen = FEATURE_DEFAULT_FROZEN,
  ConfidentialTransfers = FEATURE_CONFIDENTIAL_TRANSFERS,
}

// ─── Role Types ──────────────────────────────────────────────────────────────

export enum RoleType {
  Master = 0,
  Minter = 1,
  Burner = 2,
  Freezer = 3,
  Pauser = 4,
  Blacklister = 5,
  Seizer = 6,
}

export const ROLE_SEEDS: Record<RoleType, string> = {
  [RoleType.Master]: "master",
  [RoleType.Minter]: "minter",
  [RoleType.Burner]: "burner",
  [RoleType.Freezer]: "freezer",
  [RoleType.Pauser]: "pauser",
  [RoleType.Blacklister]: "blacklister",
  [RoleType.Seizer]: "seizer",
};

// ─── Account Interfaces ─────────────────────────────────────────────────────

export interface StablecoinState {
  authority: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  features: number;
  isPaused: boolean;
  totalMinted: bigint;
  totalBurned: bigint;
  supplyCap: bigint;
  transferHookProgram: PublicKey;
  bump: number;
  version: number;
}

export interface RoleAccount {
  stablecoin: PublicKey;
  holder: PublicKey;
  roleType: number;
  isActive: boolean;
  grantedAt: bigint;
  grantedBy: PublicKey;
  bump: number;
}

export interface MinterQuotaAccount {
  stablecoin: PublicKey;
  minter: PublicKey;
  quotaPerEpoch: bigint;
  mintedThisEpoch: bigint;
  epochStart: bigint;
  epochDuration: bigint;
  bump: number;
}

export interface BlacklistEntryAccount {
  stablecoin: PublicKey;
  address: PublicKey;
  reason: string;
  createdAt: bigint;
  createdBy: PublicKey;
  isActive: boolean;
  bump: number;
}
