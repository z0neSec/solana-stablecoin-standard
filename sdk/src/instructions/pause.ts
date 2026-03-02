import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { SSS_CORE_PROGRAM_ID, ROLE_SEEDS, RoleType } from "../types";
import { getStablecoinAddress, getRoleAddress } from "../pda";

export interface PauseInstructionParams {
  mint: PublicKey;
  pauser: PublicKey;
  programId?: PublicKey;
}

const PAUSE_DISCRIMINATOR = Buffer.from([
  211, 22, 221, 251, 74, 121, 193, 168,
]);

const UNPAUSE_DISCRIMINATOR = Buffer.from([
  169, 144, 4, 38, 10, 141, 130, 34,
]);

function buildPauseInstruction(
  params: PauseInstructionParams,
  discriminator: Buffer
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [pauserRole] = getRoleAddress(
    stablecoin,
    params.pauser,
    ROLE_SEEDS[RoleType.Pauser],
    programId
  );

  const keys = [
    { pubkey: params.pauser, isSigner: true, isWritable: false },
    { pubkey: stablecoin, isSigner: false, isWritable: true },
    { pubkey: pauserRole, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: discriminator,
  });
}

export function createPauseInstruction(
  params: PauseInstructionParams
): TransactionInstruction {
  return buildPauseInstruction(params, PAUSE_DISCRIMINATOR);
}

export function createUnpauseInstruction(
  params: PauseInstructionParams
): TransactionInstruction {
  return buildPauseInstruction(params, UNPAUSE_DISCRIMINATOR);
}
