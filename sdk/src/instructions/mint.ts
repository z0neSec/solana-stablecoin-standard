import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SSS_CORE_PROGRAM_ID, ROLE_SEEDS, RoleType } from "../types";
import { getStablecoinAddress, getRoleAddress, getMinterQuotaAddress } from "../pda";
import * as borsh from "@coral-xyz/borsh";

export interface MintInstructionParams {
  mint: PublicKey;
  minter: PublicKey;
  destination: PublicKey;
  amount: bigint;
  programId?: PublicKey;
}

const MINT_DISCRIMINATOR = Buffer.from([
  51, 57, 225, 47, 244, 237, 185, 238,
]);

const mintSchema = borsh.struct([borsh.u64("amount")]);

export function createMintInstruction(
  params: MintInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [minterRole] = getRoleAddress(
    stablecoin,
    params.minter,
    ROLE_SEEDS[RoleType.Minter],
    programId
  );
  const [minterQuota] = getMinterQuotaAddress(
    stablecoin,
    params.minter,
    programId
  );
  const destinationAta = getAssociatedTokenAddressSync(
    params.mint,
    params.destination,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const data = Buffer.alloc(64);
  MINT_DISCRIMINATOR.copy(data);
  const len = mintSchema.encode({ amount: params.amount }, data, 8);

  const keys = [
    { pubkey: params.minter, isSigner: true, isWritable: true },
    { pubkey: stablecoin, isSigner: false, isWritable: true },
    { pubkey: minterRole, isSigner: false, isWritable: false },
    { pubkey: minterQuota, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: true },
    { pubkey: destinationAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}
