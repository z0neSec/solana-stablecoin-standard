import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SSS_CORE_PROGRAM_ID, ROLE_SEEDS, RoleType } from "../types";
import { getStablecoinAddress, getRoleAddress } from "../pda";
import * as borsh from "@coral-xyz/borsh";

export interface SeizeInstructionParams {
  mint: PublicKey;
  seizer: PublicKey;
  from: PublicKey;
  to: PublicKey;
  amount: bigint;
  programId?: PublicKey;
}

const SEIZE_DISCRIMINATOR = Buffer.from([
  181, 44, 93, 135, 166, 110, 173, 16,
]);

const seizeSchema = borsh.struct([borsh.u64("amount")]);

export function createSeizeInstruction(
  params: SeizeInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [seizerRole] = getRoleAddress(
    stablecoin,
    params.seizer,
    ROLE_SEEDS[RoleType.Seizer],
    programId
  );

  const fromAta = getAssociatedTokenAddressSync(
    params.mint,
    params.from,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  const toAta = getAssociatedTokenAddressSync(
    params.mint,
    params.to,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const data = Buffer.alloc(64);
  SEIZE_DISCRIMINATOR.copy(data);
  const len = seizeSchema.encode({ amount: params.amount }, data, 8);

  const keys = [
    { pubkey: params.seizer, isSigner: true, isWritable: false },
    { pubkey: stablecoin, isSigner: false, isWritable: false },
    { pubkey: seizerRole, isSigner: false, isWritable: false },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: fromAta, isSigner: false, isWritable: true },
    { pubkey: toAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}
