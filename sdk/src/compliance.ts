import {
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import type { SolanaStablecoin } from "./client";
import {
  createBlacklistAddInstruction,
  createBlacklistRemoveInstruction,
  createSeizeInstruction,
  createFreezeInstruction,
  createThawInstruction,
} from "./instructions";
import { Transaction } from "@solana/web3.js";

/**
 * ComplianceModule — higher-level compliance operations that compose
 * multiple instructions (e.g., freeze + blacklist + seize in one tx).
 *
 * Access via `client.compliance.*`
 */
export class ComplianceModule {
  private client: SolanaStablecoin;

  constructor(client: SolanaStablecoin) {
    this.client = client;
  }

  /**
   * Add an address to the blacklist.
   */
  async blacklistAdd(
    mint: PublicKey,
    target: PublicKey,
    reason?: string
  ): Promise<TransactionSignature> {
    return this.client["sendAndConfirm"](
      new Transaction().add(
        createBlacklistAddInstruction({
          mint,
          blacklister: this.client["wallet"].publicKey,
          payer: this.client["wallet"].publicKey,
          target,
          reason,
          programId: this.client.programId,
        })
      )
    );
  }

  /**
   * Remove an address from the blacklist.
   */
  async blacklistRemove(
    mint: PublicKey,
    target: PublicKey
  ): Promise<TransactionSignature> {
    return this.client["sendAndConfirm"](
      new Transaction().add(
        createBlacklistRemoveInstruction({
          mint,
          blacklister: this.client["wallet"].publicKey,
          payer: this.client["wallet"].publicKey,
          target,
          programId: this.client.programId,
        })
      )
    );
  }

  /**
   * Full enforcement: freeze → blacklist → seize in a single atomic tx.
   * This is the typical regulatory enforcement flow.
   */
  async enforceFullSanction(
    mint: PublicKey,
    target: PublicKey,
    seizeTo: PublicKey,
    amount: bigint,
    reason?: string
  ): Promise<TransactionSignature> {
    const wallet = this.client["wallet"];
    const programId = this.client.programId;

    const tx = new Transaction();

    // 1. Freeze the target account
    tx.add(
      createFreezeInstruction({
        mint,
        freezer: wallet.publicKey,
        target,
        programId,
      })
    );

    // 2. Add to blacklist
    tx.add(
      createBlacklistAddInstruction({
        mint,
        blacklister: wallet.publicKey,
        payer: wallet.publicKey,
        target,
        reason: reason ?? "Regulatory enforcement",
        programId,
      })
    );

    // 3. Seize funds via permanent delegate
    tx.add(
      createSeizeInstruction({
        mint,
        seizer: wallet.publicKey,
        from: target,
        to: seizeTo,
        amount,
        programId,
      })
    );

    return this.client["sendAndConfirm"](tx);
  }

  /**
   * Unfreeze and un-blacklist an address (e.g., after investigation clears them).
   */
  async liftSanction(
    mint: PublicKey,
    target: PublicKey
  ): Promise<TransactionSignature> {
    const wallet = this.client["wallet"];
    const programId = this.client.programId;

    const tx = new Transaction();

    tx.add(
      createBlacklistRemoveInstruction({
        mint,
        blacklister: wallet.publicKey,
        payer: wallet.publicKey,
        target,
        programId,
      })
    );

    tx.add(
      createThawInstruction({
        mint,
        freezer: wallet.publicKey,
        target,
        programId,
      })
    );

    return this.client["sendAndConfirm"](tx);
  }

  /**
   * Check compliance status for an address.
   */
  async getComplianceStatus(
    mint: PublicKey,
    address: PublicKey
  ): Promise<{
    isBlacklisted: boolean;
    isFrozen: boolean;
    canTransfer: boolean;
  }> {
    const [isBlacklisted, balance] = await Promise.all([
      this.client.isBlacklisted(mint, address),
      this.client.getBalance(mint, address).catch(() => BigInt(0)),
    ]);

    // A naive frozen check — in practice, check the token account state
    return {
      isBlacklisted,
      isFrozen: false, // Would need to check token account freeze state
      canTransfer: !isBlacklisted,
    };
  }
}
