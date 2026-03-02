import { PublicKey } from "@solana/web3.js";
import { SSS_CORE_PROGRAM_ID, SSS_HOOK_PROGRAM_ID } from "./types";

// ─── Seed Constants ──────────────────────────────────────────────────────────

export const STABLECOIN_SEED = Buffer.from("stablecoin");
export const ROLE_SEED = Buffer.from("role");
export const MINTER_QUOTA_SEED = Buffer.from("minter_quota");
export const BLACKLIST_SEED = Buffer.from("blacklist");
export const HOOK_STATE_SEED = Buffer.from("hook_state");

// ─── PDA Derivation Helpers ──────────────────────────────────────────────────

/**
 * Derive the stablecoin state PDA.
 * Seeds: ["stablecoin", mint]
 */
export function getStablecoinAddress(
  mint: PublicKey,
  programId: PublicKey = SSS_CORE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STABLECOIN_SEED, mint.toBuffer()],
    programId
  );
}

/**
 * Derive a role PDA.
 * Seeds: ["role", stablecoin, holder, role_seed]
 */
export function getRoleAddress(
  stablecoin: PublicKey,
  holder: PublicKey,
  roleSeed: string,
  programId: PublicKey = SSS_CORE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      ROLE_SEED,
      stablecoin.toBuffer(),
      holder.toBuffer(),
      Buffer.from(roleSeed),
    ],
    programId
  );
}

/**
 * Derive the minter quota PDA.
 * Seeds: ["minter_quota", stablecoin, minter]
 */
export function getMinterQuotaAddress(
  stablecoin: PublicKey,
  minter: PublicKey,
  programId: PublicKey = SSS_CORE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_QUOTA_SEED, stablecoin.toBuffer(), minter.toBuffer()],
    programId
  );
}

/**
 * Derive the blacklist entry PDA.
 * Seeds: ["blacklist", stablecoin, address]
 */
export function getBlacklistAddress(
  stablecoin: PublicKey,
  address: PublicKey,
  programId: PublicKey = SSS_CORE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, stablecoin.toBuffer(), address.toBuffer()],
    programId
  );
}

/**
 * Derive the hook state PDA.
 * Seeds: ["hook_state", mint]
 */
export function getHookStateAddress(
  mint: PublicKey,
  programId: PublicKey = SSS_HOOK_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [HOOK_STATE_SEED, mint.toBuffer()],
    programId
  );
}

/**
 * Derive all PDAs for a stablecoin at once.
 */
export function deriveStablecoinAddresses(
  mint: PublicKey,
  authority: PublicKey,
  programId: PublicKey = SSS_CORE_PROGRAM_ID,
  hookProgramId: PublicKey = SSS_HOOK_PROGRAM_ID
) {
  const [stablecoin, stablecoinBump] = getStablecoinAddress(mint, programId);
  const [masterRole, masterRoleBump] = getRoleAddress(
    stablecoin,
    authority,
    "master",
    programId
  );
  const [hookState, hookStateBump] = getHookStateAddress(mint, hookProgramId);

  return {
    stablecoin,
    stablecoinBump,
    masterRole,
    masterRoleBump,
    hookState,
    hookStateBump,
  };
}
