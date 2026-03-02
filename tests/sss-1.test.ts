import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";
import { expect } from "chai";

// We use Anchor workspace to load the program
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

// Program IDL will be loaded from target/idl after build
// For now, use workspace reference
const program = anchor.workspace.SssCore as Program<any>;

describe("SSS-1 Minimal Preset", () => {
  const authority = provider.wallet;
  let mint: Keypair;
  let stablecoinPda: PublicKey;
  let stablecoinBump: number;
  let masterRolePda: PublicKey;
  let user1: Keypair;
  let user2: Keypair;

  before(async () => {
    // Airdrop to test users
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user2.publicKey, 2 * LAMPORTS_PER_SOL)
    );
  });

  // ── Initialization ────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("creates an SSS-1 stablecoin with zero features", async () => {
      mint = Keypair.generate();

      [stablecoinPda, stablecoinBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("stablecoin"), mint.publicKey.toBuffer()],
        program.programId
      );

      [masterRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          authority.publicKey.toBuffer(),
          Buffer.from("master"),
        ],
        program.programId
      );

      await program.methods
        .initialize({
          name: "Test USD",
          symbol: "TUSD",
          uri: "",
          decimals: 6,
          features: 0, // SSS-1: no extensions
          supplyCap: new anchor.BN(0), // unlimited
        })
        .accounts({
          payer: authority.publicKey,
          authority: authority.publicKey,
          mint: mint.publicKey,
          stablecoin: stablecoinPda,
          masterRole: masterRolePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      // Verify stablecoin state
      const state = await program.account.stablecoinState.fetch(stablecoinPda);
      expect(state.name).to.equal("Test USD");
      expect(state.symbol).to.equal("TUSD");
      expect(state.decimals).to.equal(6);
      expect(state.features).to.equal(0);
      expect(state.isPaused).to.be.false;
      expect(state.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    });

    it("rejects decimals > 9", async () => {
      const badMint = Keypair.generate();
      const [badPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stablecoin"), badMint.publicKey.toBuffer()],
        program.programId
      );
      const [badRole] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          badPda.toBuffer(),
          authority.publicKey.toBuffer(),
          Buffer.from("master"),
        ],
        program.programId
      );

      try {
        await program.methods
          .initialize({
            name: "Bad",
            symbol: "BAD",
            uri: "",
            decimals: 18,
            features: 0,
            supplyCap: new anchor.BN(0),
          })
          .accounts({
            payer: authority.publicKey,
            authority: authority.publicKey,
            mint: badMint.publicKey,
            stablecoin: badPda,
            masterRole: badRole,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([badMint])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("InvalidDecimals");
      }
    });

    it("rejects name longer than 32 chars", async () => {
      const badMint = Keypair.generate();
      const [badPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stablecoin"), badMint.publicKey.toBuffer()],
        program.programId
      );
      const [badRole] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          badPda.toBuffer(),
          authority.publicKey.toBuffer(),
          Buffer.from("master"),
        ],
        program.programId
      );

      try {
        await program.methods
          .initialize({
            name: "A".repeat(33),
            symbol: "OK",
            uri: "",
            decimals: 6,
            features: 0,
            supplyCap: new anchor.BN(0),
          })
          .accounts({
            payer: authority.publicKey,
            authority: authority.publicKey,
            mint: badMint.publicKey,
            stablecoin: badPda,
            masterRole: badRole,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([badMint])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("NameTooLong");
      }
    });
  });

  // ── Role Management ────────────────────────────────────────────────────────

  describe("roles", () => {
    it("master can grant minter role", async () => {
      const [minterRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("minter"),
        ],
        program.programId
      );

      await program.methods
        .grantRole({ roleType: { minter: {} } })
        .accounts({
          authority: authority.publicKey,
          payer: authority.publicKey,
          stablecoin: stablecoinPda,
          masterRole: masterRolePda,
          targetRole: minterRolePda,
          target: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const role = await program.account.roleAccount.fetch(minterRolePda);
      expect(role.isActive).to.be.true;
      expect(role.holder.toBase58()).to.equal(user1.publicKey.toBase58());
    });

    it("master can grant burner role", async () => {
      const [burnerRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("burner"),
        ],
        program.programId
      );

      await program.methods
        .grantRole({ roleType: { burner: {} } })
        .accounts({
          authority: authority.publicKey,
          payer: authority.publicKey,
          stablecoin: stablecoinPda,
          masterRole: masterRolePda,
          targetRole: burnerRolePda,
          target: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const role = await program.account.roleAccount.fetch(burnerRolePda);
      expect(role.isActive).to.be.true;
    });

    it("non-master cannot grant roles", async () => {
      const [badRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user2.publicKey.toBuffer(),
          Buffer.from("minter"),
        ],
        program.programId
      );
      const [fakeMasterPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("master"),
        ],
        program.programId
      );

      try {
        await program.methods
          .grantRole({ roleType: { minter: {} } })
          .accounts({
            authority: user1.publicKey,
            payer: user1.publicKey,
            stablecoin: stablecoinPda,
            masterRole: fakeMasterPda,
            targetRole: badRolePda,
            target: user2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Should fail — user1 is not master
        expect(err).to.exist;
      }
    });

    it("master can revoke a role", async () => {
      // Grant then revoke
      const [tempRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user2.publicKey.toBuffer(),
          Buffer.from("minter"),
        ],
        program.programId
      );

      await program.methods
        .grantRole({ roleType: { minter: {} } })
        .accounts({
          authority: authority.publicKey,
          payer: authority.publicKey,
          stablecoin: stablecoinPda,
          masterRole: masterRolePda,
          targetRole: tempRolePda,
          target: user2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .revokeRole({ roleType: { minter: {} } })
        .accounts({
          authority: authority.publicKey,
          stablecoin: stablecoinPda,
          masterRole: masterRolePda,
          targetRole: tempRolePda,
          target: user2.publicKey,
        })
        .rpc();

      // Account should be closed or marked inactive
      try {
        const role = await program.account.roleAccount.fetch(tempRolePda);
        expect(role.isActive).to.be.false;
      } catch {
        // Account closed — also valid
      }
    });
  });

  // ── Minting ────────────────────────────────────────────────────────────────

  describe("mint", () => {
    it("minter can mint tokens", async () => {
      // Create ATA for user2
      const ata = getAssociatedTokenAddressSync(
        mint.publicKey,
        user2.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const createAtaIx = createAssociatedTokenAccountInstruction(
        authority.publicKey,
        ata,
        user2.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      );
      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(createAtaIx)
      );

      const [minterRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("minter"),
        ],
        program.programId
      );
      const [quotaPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("minter_quota"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .mintTokens(new anchor.BN(1_000_000))
        .accounts({
          minter: user1.publicKey,
          stablecoin: stablecoinPda,
          minterRole: minterRolePda,
          minterQuota: quotaPda,
          mint: mint.publicKey,
          destination: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      const account = await getAccount(
        provider.connection,
        ata,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      expect(Number(account.amount)).to.equal(1_000_000);
    });

    it("non-minter cannot mint tokens", async () => {
      const ata = getAssociatedTokenAddressSync(
        mint.publicKey,
        user2.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const [fakeRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user2.publicKey.toBuffer(),
          Buffer.from("minter"),
        ],
        program.programId
      );
      const [quotaPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("minter_quota"),
          stablecoinPda.toBuffer(),
          user2.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .mintTokens(new anchor.BN(1_000))
          .accounts({
            minter: user2.publicKey,
            stablecoin: stablecoinPda,
            minterRole: fakeRolePda,
            minterQuota: quotaPda,
            mint: mint.publicKey,
            destination: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("tracks total_minted in state", async () => {
      const state = await program.account.stablecoinState.fetch(stablecoinPda);
      expect(state.totalMinted.toNumber()).to.be.greaterThan(0);
    });
  });

  // ── Burning ────────────────────────────────────────────────────────────────

  describe("burn", () => {
    it("burner can burn tokens", async () => {
      const ata = getAssociatedTokenAddressSync(
        mint.publicKey,
        user2.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const [burnerRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("burner"),
        ],
        program.programId
      );

      const balBefore = (
        await getAccount(
          provider.connection,
          ata,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        )
      ).amount;

      await program.methods
        .burnTokens(new anchor.BN(100_000))
        .accounts({
          burner: user1.publicKey,
          stablecoin: stablecoinPda,
          burnerRole: burnerRolePda,
          mint: mint.publicKey,
          from: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      const balAfter = (
        await getAccount(
          provider.connection,
          ata,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        )
      ).amount;
      expect(Number(balBefore) - Number(balAfter)).to.equal(100_000);
    });

    it("tracks total_burned in state", async () => {
      const state = await program.account.stablecoinState.fetch(stablecoinPda);
      expect(state.totalBurned.toNumber()).to.be.greaterThan(0);
    });
  });

  // ── Pause / Unpause ────────────────────────────────────────────────────────

  describe("pause", () => {
    it("pauser can pause the stablecoin", async () => {
      // Grant pauser role to user1
      const [pauserRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("pauser"),
        ],
        program.programId
      );

      await program.methods
        .grantRole({ roleType: { pauser: {} } })
        .accounts({
          authority: authority.publicKey,
          payer: authority.publicKey,
          stablecoin: stablecoinPda,
          masterRole: masterRolePda,
          targetRole: pauserRolePda,
          target: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .pause()
        .accounts({
          pauser: user1.publicKey,
          stablecoin: stablecoinPda,
          pauserRole: pauserRolePda,
        })
        .signers([user1])
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPda);
      expect(state.isPaused).to.be.true;
    });

    it("minting fails when paused", async () => {
      const ata = getAssociatedTokenAddressSync(
        mint.publicKey,
        user2.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const [minterRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("minter"),
        ],
        program.programId
      );
      const [quotaPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("minter_quota"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .mintTokens(new anchor.BN(1_000))
          .accounts({
            minter: user1.publicKey,
            stablecoin: stablecoinPda,
            minterRole: minterRolePda,
            minterQuota: quotaPda,
            mint: mint.publicKey,
            destination: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("StablecoinPaused");
      }
    });

    it("pauser can unpause", async () => {
      const [pauserRolePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          user1.publicKey.toBuffer(),
          Buffer.from("pauser"),
        ],
        program.programId
      );

      await program.methods
        .unpause()
        .accounts({
          pauser: user1.publicKey,
          stablecoin: stablecoinPda,
          pauserRole: pauserRolePda,
        })
        .signers([user1])
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPda);
      expect(state.isPaused).to.be.false;
    });
  });

  // ── Authority Transfer ─────────────────────────────────────────────────────

  describe("authority transfer", () => {
    it("authority can transfer to new authority", async () => {
      const newAuthority = Keypair.generate();

      await program.methods
        .transferAuthority()
        .accounts({
          authority: authority.publicKey,
          stablecoin: stablecoinPda,
          masterRole: masterRolePda,
          newAuthority: newAuthority.publicKey,
        })
        .rpc();

      const state = await program.account.stablecoinState.fetch(stablecoinPda);
      expect(state.authority.toBase58()).to.equal(
        newAuthority.publicKey.toBase58()
      );

      // Transfer back for subsequent tests
      const [newMasterPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          stablecoinPda.toBuffer(),
          newAuthority.publicKey.toBuffer(),
          Buffer.from("master"),
        ],
        program.programId
      );

      // Airdrop to new authority
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          newAuthority.publicKey,
          LAMPORTS_PER_SOL
        )
      );

      await program.methods
        .transferAuthority()
        .accounts({
          authority: newAuthority.publicKey,
          stablecoin: stablecoinPda,
          masterRole: newMasterPda,
          newAuthority: authority.publicKey,
        })
        .signers([newAuthority])
        .rpc();
    });
  });

  // ── Supply Cap ─────────────────────────────────────────────────────────────

  describe("supply cap", () => {
    it("creates stablecoin with supply cap", async () => {
      const cappedMint = Keypair.generate();
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stablecoin"), cappedMint.publicKey.toBuffer()],
        program.programId
      );
      const [role] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          pda.toBuffer(),
          authority.publicKey.toBuffer(),
          Buffer.from("master"),
        ],
        program.programId
      );

      await program.methods
        .initialize({
          name: "Capped",
          symbol: "CAP",
          uri: "",
          decimals: 6,
          features: 0,
          supplyCap: new anchor.BN(10_000_000),
        })
        .accounts({
          payer: authority.publicKey,
          authority: authority.publicKey,
          mint: cappedMint.publicKey,
          stablecoin: pda,
          masterRole: role,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([cappedMint])
        .rpc();

      const state = await program.account.stablecoinState.fetch(pda);
      expect(state.supplyCap.toNumber()).to.equal(10_000_000);
    });
  });
});
