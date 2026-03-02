import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionSignature,
  SendOptions,
  ConfirmOptions,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  getMint,
} from "@solana/spl-token";
import {
  SSS_CORE_PROGRAM_ID,
  SSS_HOOK_PROGRAM_ID,
  RoleType,
  ROLE_SEEDS,
  StablecoinState,
  FEATURE_PERMANENT_DELEGATE,
  FEATURE_TRANSFER_HOOK,
  FEATURE_DEFAULT_FROZEN,
  FEATURE_CONFIDENTIAL_TRANSFERS,
} from "./types";
import {
  getStablecoinAddress,
  getRoleAddress,
  getMinterQuotaAddress,
  getBlacklistAddress,
  getHookStateAddress,
  deriveStablecoinAddresses,
} from "./pda";
import { PresetConfig, SSS1_PRESET, SSS2_PRESET, SSS3_PRESET, getPreset } from "./presets";
import { SSSError, withSSSError } from "./errors";
import { ComplianceModule } from "./compliance";
import {
  createInitializeInstruction,
  createMintInstruction,
  createBurnInstruction,
  createFreezeInstruction,
  createThawInstruction,
  createPauseInstruction,
  createUnpauseInstruction,
  createGrantRoleInstruction,
  createRevokeRoleInstruction,
  createUpdateMinterQuotaInstruction,
  createBlacklistAddInstruction,
  createBlacklistRemoveInstruction,
  createSeizeInstruction,
  createTransferAuthorityInstruction,
} from "./instructions";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface SolanaStablecoinConfig {
  connection: Connection;
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
  };
  programId?: PublicKey;
  hookProgramId?: PublicKey;
  confirmOptions?: ConfirmOptions;
}

export interface CreateStablecoinParams {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  supplyCap?: bigint;
  preset?: "SSS-1" | "SSS-2" | "SSS-3";
  features?: number;
  mintKeypair?: Keypair;
}

export interface CreateStablecoinResult {
  mint: PublicKey;
  stablecoin: PublicKey;
  masterRole: PublicKey;
  txSignature: TransactionSignature;
  preset: string;
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export class SolanaStablecoin {
  public readonly connection: Connection;
  public readonly programId: PublicKey;
  public readonly hookProgramId: PublicKey;
  public readonly compliance: ComplianceModule;

  private wallet: SolanaStablecoinConfig["wallet"];
  private confirmOptions: ConfirmOptions;

  constructor(config: SolanaStablecoinConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = config.programId ?? SSS_CORE_PROGRAM_ID;
    this.hookProgramId = config.hookProgramId ?? SSS_HOOK_PROGRAM_ID;
    this.confirmOptions = config.confirmOptions ?? {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    };
    this.compliance = new ComplianceModule(this);
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Create a new stablecoin with a preset or custom features.
   */
  async create(params: CreateStablecoinParams): Promise<CreateStablecoinResult> {
    const preset = params.preset
      ? getPreset(params.preset)
      : SSS1_PRESET;

    const features = params.features ?? preset.features;
    const decimals = params.decimals ?? 6;
    const supplyCap = params.supplyCap ?? BigInt(0); // 0 = unlimited
    const uri = params.uri ?? "";
    const mintKeypair = params.mintKeypair ?? Keypair.generate();

    const ix = createInitializeInstruction({
      mint: mintKeypair.publicKey,
      authority: this.wallet.publicKey,
      name: params.name,
      symbol: params.symbol,
      uri,
      decimals,
      supplyCap,
      enablePermanentDelegate: (features & FEATURE_PERMANENT_DELEGATE) !== 0,
      enableTransferHook: (features & FEATURE_TRANSFER_HOOK) !== 0,
      enableDefaultFrozen: (features & FEATURE_DEFAULT_FROZEN) !== 0,
      enableConfidentialTransfers: (features & FEATURE_CONFIDENTIAL_TRANSFERS) !== 0,
      transferHookProgram: (features & FEATURE_TRANSFER_HOOK) !== 0
        ? this.hookProgramId
        : undefined,
      programId: this.programId,
    });

    const tx = new Transaction().add(ix);
    const sig = await this.sendAndConfirm(tx, [mintKeypair]);

    const [stablecoin] = getStablecoinAddress(mintKeypair.publicKey, this.programId);
    const [masterRole] = getRoleAddress(
      stablecoin,
      this.wallet.publicKey,
      "master",
      this.programId
    );

    return {
      mint: mintKeypair.publicKey,
      stablecoin,
      masterRole,
      txSignature: sig,
      preset: preset.id,
    };
  }

  // ── Mint / Burn ──────────────────────────────────────────────────────────

  async mint(
    mint: PublicKey,
    destination: PublicKey,
    amount: bigint
  ): Promise<TransactionSignature> {
    const ix = createMintInstruction({
      mint,
      minter: this.wallet.publicKey,
      destination,
      amount,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  async burn(
    mint: PublicKey,
    from: PublicKey,
    amount: bigint
  ): Promise<TransactionSignature> {
    const ix = createBurnInstruction({
      mint,
      burner: this.wallet.publicKey,
      from,
      amount,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  // ── Freeze / Thaw ───────────────────────────────────────────────────────

  async freeze(
    mint: PublicKey,
    target: PublicKey
  ): Promise<TransactionSignature> {
    const ix = createFreezeInstruction({
      mint,
      freezer: this.wallet.publicKey,
      target,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  async thaw(
    mint: PublicKey,
    target: PublicKey
  ): Promise<TransactionSignature> {
    const ix = createThawInstruction({
      mint,
      freezer: this.wallet.publicKey,
      target,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  // ── Pause ────────────────────────────────────────────────────────────────

  async pause(mint: PublicKey): Promise<TransactionSignature> {
    const ix = createPauseInstruction({
      mint,
      pauser: this.wallet.publicKey,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  async unpause(mint: PublicKey): Promise<TransactionSignature> {
    const ix = createUnpauseInstruction({
      mint,
      pauser: this.wallet.publicKey,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  async grantRole(
    mint: PublicKey,
    target: PublicKey,
    roleType: RoleType
  ): Promise<TransactionSignature> {
    const ix = createGrantRoleInstruction({
      mint,
      authority: this.wallet.publicKey,
      payer: this.wallet.publicKey,
      target,
      roleType,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  async revokeRole(
    mint: PublicKey,
    target: PublicKey,
    roleType: RoleType
  ): Promise<TransactionSignature> {
    const ix = createRevokeRoleInstruction({
      mint,
      authority: this.wallet.publicKey,
      target,
      roleType,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  async updateMinterQuota(
    mint: PublicKey,
    minter: PublicKey,
    quotaPerEpoch: bigint,
    epochDuration: bigint = BigInt(86400) // 1 day default
  ): Promise<TransactionSignature> {
    const ix = createUpdateMinterQuotaInstruction({
      mint,
      authority: this.wallet.publicKey,
      payer: this.wallet.publicKey,
      minter,
      quotaPerEpoch,
      epochDuration,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  // ── Seize ────────────────────────────────────────────────────────────────

  async seize(
    mint: PublicKey,
    from: PublicKey,
    to: PublicKey,
    amount: bigint
  ): Promise<TransactionSignature> {
    const ix = createSeizeInstruction({
      mint,
      seizer: this.wallet.publicKey,
      from,
      to,
      amount,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  // ── Authority ────────────────────────────────────────────────────────────

  async transferAuthority(
    mint: PublicKey,
    newAuthority: PublicKey
  ): Promise<TransactionSignature> {
    const ix = createTransferAuthorityInstruction({
      mint,
      currentAuthority: this.wallet.publicKey,
      newAuthority,
      programId: this.programId,
    });
    return this.sendAndConfirm(new Transaction().add(ix));
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * Fetch the on-chain StablecoinState account.
   */
  async getStablecoinState(mint: PublicKey): Promise<StablecoinState | null> {
    const [stablecoinPda] = getStablecoinAddress(mint, this.programId);
    const info = await this.connection.getAccountInfo(stablecoinPda);
    if (!info) return null;
    // Decode from Anchor account layout (skip 8-byte discriminator)
    return this.decodeStablecoinState(info.data);
  }

  /**
   * Check if an address has a specific role.
   */
  async hasRole(
    mint: PublicKey,
    address: PublicKey,
    roleType: RoleType
  ): Promise<boolean> {
    const [stablecoin] = getStablecoinAddress(mint, this.programId);
    const [rolePda] = getRoleAddress(
      stablecoin,
      address,
      ROLE_SEEDS[roleType],
      this.programId
    );
    const info = await this.connection.getAccountInfo(rolePda);
    return info !== null;
  }

  /**
   * Check if an address is blacklisted.
   */
  async isBlacklisted(
    mint: PublicKey,
    address: PublicKey
  ): Promise<boolean> {
    const [stablecoin] = getStablecoinAddress(mint, this.programId);
    const [blacklistPda] = getBlacklistAddress(
      stablecoin,
      address,
      this.programId
    );
    const info = await this.connection.getAccountInfo(blacklistPda);
    return info !== null;
  }

  /**
   * Get the token balance for an address.
   */
  async getBalance(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<bigint> {
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    try {
      const account = await getAccount(
        this.connection,
        ata,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      return account.amount;
    } catch {
      return BigInt(0);
    }
  }

  /**
   * Get supply info for a stablecoin.
   */
  async getSupplyInfo(mint: PublicKey): Promise<{
    totalSupply: bigint;
    totalMinted: bigint;
    totalBurned: bigint;
    supplyCap: bigint;
  }> {
    const state = await this.getStablecoinState(mint);
    const mintInfo = await getMint(
      this.connection,
      mint,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    return {
      totalSupply: mintInfo.supply,
      totalMinted: state?.totalMinted ?? BigInt(0),
      totalBurned: state?.totalBurned ?? BigInt(0),
      supplyCap: state?.supplyCap ?? BigInt(0),
    };
  }

  // ── PDA Helpers ──────────────────────────────────────────────────────────

  deriveAddresses(mint: PublicKey, authority?: PublicKey) {
    return deriveStablecoinAddresses(
      mint,
      authority ?? this.wallet.publicKey,
      this.programId,
      this.hookProgramId
    );
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async sendAndConfirm(
    tx: Transaction,
    signers: Keypair[] = []
  ): Promise<TransactionSignature> {
    return withSSSError(async () => {
      tx.feePayer = this.wallet.publicKey;
      tx.recentBlockhash = (
        await this.connection.getLatestBlockhash(
          this.confirmOptions.preflightCommitment
        )
      ).blockhash;

      if (signers.length > 0) {
        tx.partialSign(...signers);
      }

      const signed = await this.wallet.signTransaction(tx);
      const rawTx = signed.serialize();
      const sig = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: this.confirmOptions.preflightCommitment,
      });

      await this.connection.confirmTransaction(sig, this.confirmOptions.commitment);
      return sig;
    });
  }

  private decodeStablecoinState(data: Buffer): StablecoinState {
    // Skip 8-byte Anchor discriminator
    let offset = 8;

    const authority = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const mint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    // Read Borsh strings (4-byte length prefix + utf8 data)
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.subarray(offset, offset + nameLen).toString("utf8");
    offset += nameLen;

    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.subarray(offset, offset + symbolLen).toString("utf8");
    offset += symbolLen;

    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.subarray(offset, offset + uriLen).toString("utf8");
    offset += uriLen;

    const decimals = data.readUInt8(offset);
    offset += 1;
    const features = data.readUInt16LE(offset);
    offset += 2;
    const isPaused = data.readUInt8(offset) !== 0;
    offset += 1;
    const totalMinted = data.readBigUInt64LE(offset);
    offset += 8;
    const totalBurned = data.readBigUInt64LE(offset);
    offset += 8;
    const supplyCap = data.readBigUInt64LE(offset);
    offset += 8;
    const transferHookProgram = new PublicKey(
      data.subarray(offset, offset + 32)
    );
    offset += 32;
    const bump = data.readUInt8(offset);
    offset += 1;
    const version = data.readUInt8(offset);

    return {
      authority,
      mint,
      name,
      symbol,
      uri,
      decimals,
      features,
      isPaused,
      totalMinted,
      totalBurned,
      supplyCap,
      transferHookProgram,
      bump,
      version,
    };
  }
}
