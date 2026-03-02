import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import {
  getStablecoinAddress,
  getRoleAddress,
  getMinterQuotaAddress,
  getBlacklistAddress,
  getHookStateAddress,
  deriveStablecoinAddresses,
} from "../src/pda";
import {
  SSS1_PRESET,
  SSS2_PRESET,
  SSS3_PRESET,
  getPreset,
  buildFeatures,
  parseFeatures,
} from "../src/presets";
import {
  RoleType,
  ROLE_SEEDS,
  SSS_CORE_PROGRAM_ID,
  SSS_HOOK_PROGRAM_ID,
  FEATURE_PERMANENT_DELEGATE,
  FEATURE_TRANSFER_HOOK,
  FEATURE_DEFAULT_FROZEN,
  FEATURE_CONFIDENTIAL_TRANSFERS,
} from "../src/types";
import { SSSError, SSSErrorCode, HookErrorCode } from "../src/errors";

// ─── PDA Tests ───────────────────────────────────────────────────────────────

describe("PDA derivation", () => {
  const mint = Keypair.generate().publicKey;
  const authority = Keypair.generate().publicKey;

  it("derives stablecoin address deterministically", () => {
    const [addr1] = getStablecoinAddress(mint);
    const [addr2] = getStablecoinAddress(mint);
    expect(addr1.toBase58()).to.equal(addr2.toBase58());
  });

  it("different mints produce different PDAs", () => {
    const mint2 = Keypair.generate().publicKey;
    const [addr1] = getStablecoinAddress(mint);
    const [addr2] = getStablecoinAddress(mint2);
    expect(addr1.toBase58()).to.not.equal(addr2.toBase58());
  });

  it("derives role address with correct seeds", () => {
    const [stablecoin] = getStablecoinAddress(mint);
    const [role] = getRoleAddress(stablecoin, authority, "master");
    expect(PublicKey.isOnCurve(role.toBytes())).to.be.false; // PDA is off curve
  });

  it("different roles produce different PDAs", () => {
    const [stablecoin] = getStablecoinAddress(mint);
    const [minterRole] = getRoleAddress(stablecoin, authority, "minter");
    const [burnerRole] = getRoleAddress(stablecoin, authority, "burner");
    expect(minterRole.toBase58()).to.not.equal(burnerRole.toBase58());
  });

  it("derives minter quota address", () => {
    const [stablecoin] = getStablecoinAddress(mint);
    const [quota] = getMinterQuotaAddress(stablecoin, authority);
    expect(PublicKey.isOnCurve(quota.toBytes())).to.be.false;
  });

  it("derives blacklist address", () => {
    const [stablecoin] = getStablecoinAddress(mint);
    const target = Keypair.generate().publicKey;
    const [bl] = getBlacklistAddress(stablecoin, target);
    expect(PublicKey.isOnCurve(bl.toBytes())).to.be.false;
  });

  it("derives hook state address", () => {
    const [hookState] = getHookStateAddress(mint);
    expect(PublicKey.isOnCurve(hookState.toBytes())).to.be.false;
  });

  it("deriveStablecoinAddresses returns all expected fields", () => {
    const result = deriveStablecoinAddresses(mint, authority);
    expect(result).to.have.property("stablecoin");
    expect(result).to.have.property("stablecoinBump");
    expect(result).to.have.property("masterRole");
    expect(result).to.have.property("masterRoleBump");
    expect(result).to.have.property("hookState");
    expect(result).to.have.property("hookStateBump");
  });
});

// ─── Preset Tests ────────────────────────────────────────────────────────────

describe("Presets", () => {
  it("SSS-1 has zero features", () => {
    expect(SSS1_PRESET.features).to.equal(0);
    expect(SSS1_PRESET.requiresTransferHook).to.be.false;
    expect(SSS1_PRESET.requiresConfidentialTransfers).to.be.false;
  });

  it("SSS-2 has permanent_delegate + transfer_hook + default_frozen", () => {
    const f = SSS2_PRESET.features;
    expect(f & FEATURE_PERMANENT_DELEGATE).to.not.equal(0);
    expect(f & FEATURE_TRANSFER_HOOK).to.not.equal(0);
    expect(f & FEATURE_DEFAULT_FROZEN).to.not.equal(0);
    expect(f & FEATURE_CONFIDENTIAL_TRANSFERS).to.equal(0);
    expect(SSS2_PRESET.requiresTransferHook).to.be.true;
  });

  it("SSS-3 has permanent_delegate + default_frozen + confidential_transfers", () => {
    const f = SSS3_PRESET.features;
    expect(f & FEATURE_PERMANENT_DELEGATE).to.not.equal(0);
    expect(f & FEATURE_DEFAULT_FROZEN).to.not.equal(0);
    expect(f & FEATURE_CONFIDENTIAL_TRANSFERS).to.not.equal(0);
    expect(f & FEATURE_TRANSFER_HOOK).to.equal(0);
    expect(SSS3_PRESET.requiresConfidentialTransfers).to.be.true;
  });

  it("getPreset is case-insensitive", () => {
    expect(getPreset("sss-1").id).to.equal("SSS-1");
    expect(getPreset("SSS-2").id).to.equal("SSS-2");
  });

  it("getPreset throws for unknown preset", () => {
    expect(() => getPreset("SSS-99")).to.throw("Unknown preset");
  });

  it("buildFeatures computes correct bitmask", () => {
    const f = buildFeatures({
      permanentDelegate: true,
      transferHook: true,
      defaultFrozen: true,
    });
    expect(f).to.equal(
      FEATURE_PERMANENT_DELEGATE | FEATURE_TRANSFER_HOOK | FEATURE_DEFAULT_FROZEN
    );
  });

  it("buildFeatures rejects incompatible combo", () => {
    expect(() =>
      buildFeatures({
        transferHook: true,
        confidentialTransfers: true,
      })
    ).to.throw("incompatible");
  });

  it("parseFeatures round-trips correctly", () => {
    const features = SSS2_PRESET.features;
    const parsed = parseFeatures(features);
    expect(parsed.permanentDelegate).to.be.true;
    expect(parsed.transferHook).to.be.true;
    expect(parsed.defaultFrozen).to.be.true;
    expect(parsed.confidentialTransfers).to.be.false;
  });
});

// ─── Error Tests ─────────────────────────────────────────────────────────────

describe("Errors", () => {
  it("creates SSSError from code", () => {
    const err = new SSSError(SSSErrorCode.Paused);
    expect(err.code).to.equal(6009);
    expect(err.message).to.contain("paused");
    expect(err.programError).to.be.true;
  });

  it("creates SSSError from Anchor error", () => {
    const anchorErr = {
      error: {
        errorCode: { number: 6003 },
        errorMessage: "Supply cap exceeded",
      },
    };
    const err = SSSError.fromAnchorError(anchorErr);
    expect(err.code).to.equal(6003);
  });

  it("creates hook error", () => {
    const err = new SSSError(HookErrorCode.SenderBlacklisted);
    expect(err.message).to.contain("blacklisted");
  });

  it("unknown error code gets generic message", () => {
    const err = new SSSError(9999);
    expect(err.message).to.contain("Unknown");
  });
});

// ─── Types Tests ─────────────────────────────────────────────────────────────

describe("Types", () => {
  it("RoleType enum has 7 variants", () => {
    const values = [
      RoleType.Master,
      RoleType.Minter,
      RoleType.Burner,
      RoleType.Freezer,
      RoleType.Pauser,
      RoleType.Blacklister,
      RoleType.Seizer,
    ];
    expect(values).to.have.length(7);
  });

  it("ROLE_SEEDS maps all role types", () => {
    for (const role of [
      RoleType.Master,
      RoleType.Minter,
      RoleType.Burner,
      RoleType.Freezer,
      RoleType.Pauser,
      RoleType.Blacklister,
      RoleType.Seizer,
    ]) {
      expect(ROLE_SEEDS[role]).to.be.a("string");
    }
  });

  it("program IDs are valid public keys", () => {
    expect(PublicKey.isOnCurve(SSS_CORE_PROGRAM_ID.toBytes())).to.be.a(
      "boolean"
    );
    expect(PublicKey.isOnCurve(SSS_HOOK_PROGRAM_ID.toBytes())).to.be.a(
      "boolean"
    );
  });
});
