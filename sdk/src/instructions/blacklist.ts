import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { SSS_CORE_PROGRAM_ID, ROLE_SEEDS, RoleType } from "../types";
import { getStablecoinAddress, getRoleAddress, getBlacklistAddress } from "../pda";
import * as borsh from "@coral-xyz/borsh";

export interface BlacklistInstructionParams {
  mint: PublicKey;
  blacklister: PublicKey;
  target: PublicKey;
  reason?: string;
  programId?: PublicKey;
}

const BLACKLIST_ADD_DISCRIMINATOR = Buffer.from([
  63, 144, 87, 230, 50, 53, 152, 6,
]);

const BLACKLIST_REMOVE_DISCRIMINATOR = Buffer.from([
  241, 119, 216, 137, 52, 17, 211, 39,
]);

const blacklistAddSchema = borsh.struct([borsh.str("reason")]);

export function createBlacklistAddInstruction(
  params: BlacklistInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [blacklisterRole] = getRoleAddress(
    stablecoin,
    params.blacklister,
    ROLE_SEEDS[RoleType.Blacklister],
    programId
  );
  const [blacklistEntry] = getBlacklistAddress(
    stablecoin,
    params.target,
    programId
  );

  const data = Buffer.alloc(256);
  BLACKLIST_ADD_DISCRIMINATOR.copy(data);
  const len = blacklistAddSchema.encode(
    { reason: params.reason ?? "" },
    data,
    8
  );

  // Matches Rust BlacklistAdd: blacklister (mut, signer), stablecoin,
  // blacklister_role, blacklist_entry (mut), address, system_program
  const keys = [
    { pubkey: params.blacklister, isSigner: true, isWritable: true },
    { pubkey: stablecoin, isSigner: false, isWritable: false },
    { pubkey: blacklisterRole, isSigner: false, isWritable: false },
    { pubkey: blacklistEntry, isSigner: false, isWritable: true },
    { pubkey: params.target, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}

export function createBlacklistRemoveInstruction(
  params: BlacklistInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [blacklisterRole] = getRoleAddress(
    stablecoin,
    params.blacklister,
    ROLE_SEEDS[RoleType.Blacklister],
    programId
  );
  const [blacklistEntry] = getBlacklistAddress(
    stablecoin,
    params.target,
    programId
  );

  const keys = [
    { pubkey: params.blacklister, isSigner: true, isWritable: false },
    { pubkey: stablecoin, isSigner: false, isWritable: false },
    { pubkey: blacklisterRole, isSigner: false, isWritable: false },
    { pubkey: blacklistEntry, isSigner: false, isWritable: true },
    { pubkey: params.target, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: BLACKLIST_REMOVE_DISCRIMINATOR,
  });
}
