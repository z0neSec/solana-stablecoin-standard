import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { SSS_CORE_PROGRAM_ID } from "../types";
import { getStablecoinAddress } from "../pda";
import * as borsh from "@coral-xyz/borsh";

export interface TransferAuthorityInstructionParams {
  mint: PublicKey;
  currentAuthority: PublicKey;
  newAuthority: PublicKey;
  programId?: PublicKey;
}

const TRANSFER_AUTHORITY_DISCRIMINATOR = Buffer.from([
  202, 75, 164, 83, 213, 173, 7, 242,
]);

const transferAuthoritySchema = borsh.struct([
  borsh.publicKey("newAuthority"),
]);

export function createTransferAuthorityInstruction(
  params: TransferAuthorityInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;
  const [stablecoin] = getStablecoinAddress(params.mint, programId);

  const data = Buffer.alloc(48);
  TRANSFER_AUTHORITY_DISCRIMINATOR.copy(data);
  const len = transferAuthoritySchema.encode(
    { newAuthority: params.newAuthority },
    data,
    8
  );

  // Matches Rust TransferAuthority: authority (signer), stablecoin (mut)
  const keys = [
    { pubkey: params.currentAuthority, isSigner: true, isWritable: false },
    { pubkey: stablecoin, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}
