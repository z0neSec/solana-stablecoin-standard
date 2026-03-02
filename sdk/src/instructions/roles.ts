import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { SSS_CORE_PROGRAM_ID, ROLE_SEEDS, RoleType } from "../types";
import { getStablecoinAddress, getRoleAddress, getMinterQuotaAddress } from "../pda";
import * as borsh from "@coral-xyz/borsh";

// ─── Grant Role ──────────────────────────────────────────────────────────────

export interface GrantRoleInstructionParams {
  mint: PublicKey;
  authority: PublicKey;
  payer: PublicKey;
  target: PublicKey;
  roleType: RoleType;
  programId?: PublicKey;
}

const GRANT_ROLE_DISCRIMINATOR = Buffer.from([
  49, 232, 44, 177, 77, 69, 237, 132,
]);

const grantRoleSchema = borsh.struct([borsh.u8("roleType")]);

export function createGrantRoleInstruction(
  params: GrantRoleInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const roleSeed = ROLE_SEEDS[params.roleType];
  const [targetRole] = getRoleAddress(
    stablecoin,
    params.target,
    roleSeed,
    programId
  );

  const data = Buffer.alloc(16);
  GRANT_ROLE_DISCRIMINATOR.copy(data);
  const len = grantRoleSchema.encode({ roleType: params.roleType }, data, 8);

  // Matches Rust GrantRole: authority (mut, signer), stablecoin,
  // role_account (mut), grantee, system_program
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: stablecoin, isSigner: false, isWritable: false },
    { pubkey: targetRole, isSigner: false, isWritable: true },
    { pubkey: params.target, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}

// ─── Revoke Role ─────────────────────────────────────────────────────────────

export interface RevokeRoleInstructionParams {
  mint: PublicKey;
  authority: PublicKey;
  target: PublicKey;
  roleType: RoleType;
  programId?: PublicKey;
}

const REVOKE_ROLE_DISCRIMINATOR = Buffer.from([
  124, 83, 169, 230, 181, 95, 47, 78,
]);

const revokeRoleSchema = borsh.struct([borsh.u8("roleType")]);

export function createRevokeRoleInstruction(
  params: RevokeRoleInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const roleSeed = ROLE_SEEDS[params.roleType];
  const [targetRole] = getRoleAddress(
    stablecoin,
    params.target,
    roleSeed,
    programId
  );

  const data = Buffer.alloc(16);
  REVOKE_ROLE_DISCRIMINATOR.copy(data);
  const len = revokeRoleSchema.encode(
    { roleType: params.roleType },
    data,
    8
  );

  // Matches Rust RevokeRole: authority (signer), stablecoin,
  // role_account (mut), revokee
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: false },
    { pubkey: stablecoin, isSigner: false, isWritable: false },
    { pubkey: targetRole, isSigner: false, isWritable: true },
    { pubkey: params.target, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}

// ─── Update Minter Quota ────────────────────────────────────────────────────

export interface UpdateMinterQuotaInstructionParams {
  mint: PublicKey;
  authority: PublicKey;
  payer: PublicKey;
  minter: PublicKey;
  quotaPerEpoch: bigint;
  epochDuration: bigint;
  programId?: PublicKey;
}

const UPDATE_QUOTA_DISCRIMINATOR = Buffer.from([
  77, 199, 52, 89, 201, 80, 120, 206,
]);

const updateQuotaSchema = borsh.struct([
  borsh.u64("quotaPerEpoch"),
  borsh.u64("epochDuration"),
]);

export function createUpdateMinterQuotaInstruction(
  params: UpdateMinterQuotaInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [minterQuota] = getMinterQuotaAddress(
    stablecoin,
    params.minter,
    programId
  );

  const data = Buffer.alloc(32);
  UPDATE_QUOTA_DISCRIMINATOR.copy(data);
  const len = updateQuotaSchema.encode(
    {
      quotaPerEpoch: params.quotaPerEpoch,
      epochDuration: params.epochDuration,
    },
    data,
    8
  );

  // Matches Rust UpdateMinterQuota: authority (mut, signer), stablecoin,
  // minter_quota (mut), minter, system_program
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: stablecoin, isSigner: false, isWritable: false },
    { pubkey: minterQuota, isSigner: false, isWritable: true },
    { pubkey: params.minter, isSigner: false, isWritable: false },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}
