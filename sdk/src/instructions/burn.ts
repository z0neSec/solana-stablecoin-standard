import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SSS_CORE_PROGRAM_ID, ROLE_SEEDS, RoleType } from "../types";
import { getStablecoinAddress, getRoleAddress } from "../pda";
import * as borsh from "@coral-xyz/borsh";

export interface BurnInstructionParams {
  mint: PublicKey;
  burner: PublicKey;
  from: PublicKey;
  amount: bigint;
  programId?: PublicKey;
}

const BURN_DISCRIMINATOR = Buffer.from([
  116, 110, 29, 56, 107, 219, 42, 93,
]);

const burnSchema = borsh.struct([borsh.u64("amount")]);

export function createBurnInstruction(
  params: BurnInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [burnerRole] = getRoleAddress(
    stablecoin,
    params.burner,
    ROLE_SEEDS[RoleType.Burner],
    programId
  );
  const fromAta = getAssociatedTokenAddressSync(
    params.mint,
    params.from,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const data = Buffer.alloc(64);
  BURN_DISCRIMINATOR.copy(data);
  const len = burnSchema.encode({ amount: params.amount }, data, 8);

  const keys = [
    { pubkey: params.burner, isSigner: true, isWritable: true },
    { pubkey: stablecoin, isSigner: false, isWritable: true },
    { pubkey: burnerRole, isSigner: false, isWritable: false },
    { pubkey: params.mint, isSigner: false, isWritable: true },
    { pubkey: fromAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}
