import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SSS_CORE_PROGRAM_ID, ROLE_SEEDS, RoleType } from "../types";
import { getStablecoinAddress, getRoleAddress } from "../pda";

export interface FreezeInstructionParams {
  mint: PublicKey;
  freezer: PublicKey;
  target: PublicKey;
  programId?: PublicKey;
}

const FREEZE_DISCRIMINATOR = Buffer.from([
  149, 116, 87, 243, 52, 252, 159, 1,
]);

const THAW_DISCRIMINATOR = Buffer.from([
  212, 219, 97, 235, 169, 56, 108, 138,
]);

function buildFreezeThawInstruction(
  params: FreezeInstructionParams,
  discriminator: Buffer
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [freezerRole] = getRoleAddress(
    stablecoin,
    params.freezer,
    ROLE_SEEDS[RoleType.Freezer],
    programId
  );
  const targetAta = getAssociatedTokenAddressSync(
    params.mint,
    params.target,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const keys = [
    { pubkey: params.freezer, isSigner: true, isWritable: false },
    { pubkey: stablecoin, isSigner: false, isWritable: false },
    { pubkey: freezerRole, isSigner: false, isWritable: false },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: targetAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: discriminator,
  });
}

export function createFreezeInstruction(
  params: FreezeInstructionParams
): TransactionInstruction {
  return buildFreezeThawInstruction(params, FREEZE_DISCRIMINATOR);
}

export function createThawInstruction(
  params: FreezeInstructionParams
): TransactionInstruction {
  return buildFreezeThawInstruction(params, THAW_DISCRIMINATOR);
}
