import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { SSS_CORE_PROGRAM_ID } from "../types";
import { getStablecoinAddress, getRoleAddress } from "../pda";
import * as borsh from "@coral-xyz/borsh";

export interface InitializeInstructionParams {
  mint: PublicKey;
  authority: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  supplyCap: bigint;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  enableDefaultFrozen: boolean;
  enableConfidentialTransfers: boolean;
  transferHookProgram?: PublicKey;
  programId?: PublicKey;
}

// Anchor discriminator for "initialize"
const INITIALIZE_DISCRIMINATOR = Buffer.from([
  175, 175, 109, 31, 13, 152, 155, 237,
]);

// Matches Rust InitializeParams: name, symbol, uri, decimals, supply_cap,
// enable_permanent_delegate, enable_transfer_hook, enable_default_frozen,
// enable_confidential_transfers, transfer_hook_program (Option<Pubkey>)
const initializeSchema = borsh.struct([
  borsh.str("name"),
  borsh.str("symbol"),
  borsh.str("uri"),
  borsh.u8("decimals"),
  borsh.u64("supplyCap"),
  borsh.bool("enablePermanentDelegate"),
  borsh.bool("enableTransferHook"),
  borsh.bool("enableDefaultFrozen"),
  borsh.bool("enableConfidentialTransfers"),
  borsh.option(borsh.publicKey(), "transferHookProgram"),
]);

export function createInitializeInstruction(
  params: InitializeInstructionParams
): TransactionInstruction {
  const programId = params.programId ?? SSS_CORE_PROGRAM_ID;

  const [stablecoin] = getStablecoinAddress(params.mint, programId);
  const [masterRole] = getRoleAddress(
    stablecoin,
    params.authority,
    "master",
    programId
  );

  const data = Buffer.alloc(1024);
  INITIALIZE_DISCRIMINATOR.copy(data);
  const len = initializeSchema.encode(
    {
      name: params.name,
      symbol: params.symbol,
      uri: params.uri,
      decimals: params.decimals,
      supplyCap: params.supplyCap,
      enablePermanentDelegate: params.enablePermanentDelegate,
      enableTransferHook: params.enableTransferHook,
      enableDefaultFrozen: params.enableDefaultFrozen,
      enableConfidentialTransfers: params.enableConfidentialTransfers,
      transferHookProgram: params.transferHookProgram ?? null,
    },
    data,
    8
  );

  // Matches Rust Initialize accounts:
  // authority (mut, signer), stablecoin (mut), mint (mut, signer),
  // master_role (mut), token_program, system_program, rent
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: stablecoin, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: true, isWritable: true },
    { pubkey: masterRole, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data: data.subarray(0, 8 + len),
  });
}
