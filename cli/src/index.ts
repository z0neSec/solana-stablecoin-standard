#!/usr/bin/env node

import { Command } from "commander";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  SolanaStablecoin,
  RoleType,
  SSS1_PRESET,
  SSS2_PRESET,
  SSS3_PRESET,
  getPreset,
  parseFeatures,
} from "@stbr/sss-token";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadKeypair(filepath: string): Keypair {
  const resolved = filepath.startsWith("~")
    ? path.join(process.env.HOME!, filepath.slice(1))
    : filepath;
  const secretKey = JSON.parse(fs.readFileSync(resolved, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function getConnection(cluster: string): Connection {
  const url =
    cluster === "localnet"
      ? "http://127.0.0.1:8899"
      : clusterApiUrl(cluster as any);
  return new Connection(url, "confirmed");
}

function getClient(opts: any): SolanaStablecoin {
  const keypair = loadKeypair(
    opts.keypair || "~/.config/solana/id.json"
  );
  const connection = getConnection(opts.cluster || "devnet");

  return new SolanaStablecoin({
    connection,
    wallet: {
      publicKey: keypair.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(keypair);
        return tx;
      },
    },
  });
}

function log(label: string, value: string) {
  console.log(`  ${chalk.cyan(label.padEnd(18))} ${value}`);
}

// ─── Program ─────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("sss-token")
  .description("Solana Stablecoin Standard CLI")
  .version("0.1.0")
  .option("-k, --keypair <path>", "Path to keypair file", "~/.config/solana/id.json")
  .option("-c, --cluster <cluster>", "Solana cluster", "devnet");

// ── Create ──────────────────────────────────────────────────────────────────

program
  .command("create")
  .description("Create a new stablecoin")
  .requiredOption("-n, --name <name>", "Token name")
  .requiredOption("-s, --symbol <symbol>", "Token symbol")
  .option("-p, --preset <preset>", "Preset: SSS-1, SSS-2, SSS-3", "SSS-1")
  .option("-d, --decimals <decimals>", "Decimals", "6")
  .option("--uri <uri>", "Metadata URI", "")
  .option("--supply-cap <cap>", "Supply cap (0 = unlimited)", "0")
  .action(async (opts) => {
    const spinner = ora("Creating stablecoin...").start();
    try {
      const client = getClient(program.opts());
      const result = await client.create({
        name: opts.name,
        symbol: opts.symbol,
        preset: opts.preset,
        decimals: parseInt(opts.decimals),
        supplyCap: BigInt(opts.supplyCap),
        uri: opts.uri,
      });

      spinner.succeed("Stablecoin created!");
      console.log();
      log("Mint", result.mint.toBase58());
      log("Stablecoin PDA", result.stablecoin.toBase58());
      log("Master Role", result.masterRole.toBase58());
      log("Preset", result.preset);
      log("Transaction", result.txSignature);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Mint ────────────────────────────────────────────────────────────────────

program
  .command("mint")
  .description("Mint tokens")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --to <address>", "Destination address")
  .requiredOption("-a, --amount <amount>", "Amount (raw units)")
  .action(async (opts) => {
    const spinner = ora("Minting tokens...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.mint(
        new PublicKey(opts.mint),
        new PublicKey(opts.to),
        BigInt(opts.amount)
      );
      spinner.succeed(`Minted ${opts.amount} tokens`);
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Burn ────────────────────────────────────────────────────────────────────

program
  .command("burn")
  .description("Burn tokens")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-f, --from <address>", "Source address")
  .requiredOption("-a, --amount <amount>", "Amount (raw units)")
  .action(async (opts) => {
    const spinner = ora("Burning tokens...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.burn(
        new PublicKey(opts.mint),
        new PublicKey(opts.from),
        BigInt(opts.amount)
      );
      spinner.succeed(`Burned ${opts.amount} tokens`);
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Freeze / Thaw ───────────────────────────────────────────────────────────

program
  .command("freeze")
  .description("Freeze an account")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Target address")
  .action(async (opts) => {
    const spinner = ora("Freezing account...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.freeze(
        new PublicKey(opts.mint),
        new PublicKey(opts.target)
      );
      spinner.succeed("Account frozen");
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

program
  .command("thaw")
  .description("Thaw (unfreeze) an account")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Target address")
  .action(async (opts) => {
    const spinner = ora("Thawing account...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.thaw(
        new PublicKey(opts.mint),
        new PublicKey(opts.target)
      );
      spinner.succeed("Account thawed");
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Pause / Unpause ─────────────────────────────────────────────────────────

program
  .command("pause")
  .description("Pause the stablecoin (emergency)")
  .requiredOption("-m, --mint <address>", "Mint address")
  .action(async (opts) => {
    const spinner = ora("Pausing stablecoin...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.pause(new PublicKey(opts.mint));
      spinner.succeed("Stablecoin paused");
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

program
  .command("unpause")
  .description("Unpause the stablecoin")
  .requiredOption("-m, --mint <address>", "Mint address")
  .action(async (opts) => {
    const spinner = ora("Unpausing stablecoin...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.unpause(new PublicKey(opts.mint));
      spinner.succeed("Stablecoin unpaused");
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Roles ───────────────────────────────────────────────────────────────────

const roles = program.command("role").description("Manage roles");

roles
  .command("grant")
  .description("Grant a role to an address")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Target address")
  .requiredOption(
    "-r, --role <role>",
    "Role: master, minter, burner, freezer, pauser, blacklister, seizer"
  )
  .action(async (opts) => {
    const spinner = ora(`Granting ${opts.role} role...`).start();
    try {
      const client = getClient(program.opts());
      const roleType = parseRoleType(opts.role);
      const sig = await client.grantRole(
        new PublicKey(opts.mint),
        new PublicKey(opts.target),
        roleType
      );
      spinner.succeed(`${opts.role} role granted`);
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

roles
  .command("revoke")
  .description("Revoke a role from an address")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Target address")
  .requiredOption("-r, --role <role>", "Role to revoke")
  .action(async (opts) => {
    const spinner = ora(`Revoking ${opts.role} role...`).start();
    try {
      const client = getClient(program.opts());
      const roleType = parseRoleType(opts.role);
      const sig = await client.revokeRole(
        new PublicKey(opts.mint),
        new PublicKey(opts.target),
        roleType
      );
      spinner.succeed(`${opts.role} role revoked`);
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Compliance ──────────────────────────────────────────────────────────────

const compliance = program
  .command("compliance")
  .description("Compliance operations");

compliance
  .command("blacklist-add")
  .description("Add address to blacklist")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Target address")
  .option("-r, --reason <reason>", "Reason for blacklisting")
  .action(async (opts) => {
    const spinner = ora("Adding to blacklist...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.compliance.blacklistAdd(
        new PublicKey(opts.mint),
        new PublicKey(opts.target),
        opts.reason
      );
      spinner.succeed("Address blacklisted");
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

compliance
  .command("blacklist-remove")
  .description("Remove address from blacklist")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Target address")
  .action(async (opts) => {
    const spinner = ora("Removing from blacklist...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.compliance.blacklistRemove(
        new PublicKey(opts.mint),
        new PublicKey(opts.target)
      );
      spinner.succeed("Address removed from blacklist");
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

compliance
  .command("enforce")
  .description("Full enforcement: freeze + blacklist + seize")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Target to sanction")
  .requiredOption("--seize-to <address>", "Address to receive seized funds")
  .requiredOption("-a, --amount <amount>", "Amount to seize")
  .option("-r, --reason <reason>", "Enforcement reason")
  .action(async (opts) => {
    const spinner = ora("Executing full enforcement...").start();
    try {
      const client = getClient(program.opts());
      const sig = await client.compliance.enforceFullSanction(
        new PublicKey(opts.mint),
        new PublicKey(opts.target),
        new PublicKey(opts.seizeTo),
        BigInt(opts.amount),
        opts.reason
      );
      spinner.succeed("Full enforcement executed");
      log("Transaction", sig);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

compliance
  .command("check")
  .description("Check compliance status of an address")
  .requiredOption("-m, --mint <address>", "Mint address")
  .requiredOption("-t, --target <address>", "Address to check")
  .action(async (opts) => {
    try {
      const client = getClient(program.opts());
      const status = await client.compliance.getComplianceStatus(
        new PublicKey(opts.mint),
        new PublicKey(opts.target)
      );
      console.log();
      log("Blacklisted", status.isBlacklisted ? chalk.red("YES") : chalk.green("NO"));
      log("Frozen", status.isFrozen ? chalk.red("YES") : chalk.green("NO"));
      log("Can Transfer", status.canTransfer ? chalk.green("YES") : chalk.red("NO"));
    } catch (err: any) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

// ── Info ────────────────────────────────────────────────────────────────────

program
  .command("info")
  .description("Show stablecoin info")
  .requiredOption("-m, --mint <address>", "Mint address")
  .action(async (opts) => {
    try {
      const client = getClient(program.opts());
      const mint = new PublicKey(opts.mint);
      const state = await client.getStablecoinState(mint);
      if (!state) {
        console.log(chalk.red("Stablecoin not found"));
        process.exit(1);
      }

      const features = parseFeatures(state.features);
      const supply = await client.getSupplyInfo(mint);

      console.log();
      console.log(chalk.bold("  Stablecoin Info"));
      console.log(chalk.gray("  " + "─".repeat(40)));
      log("Name", state.name);
      log("Symbol", state.symbol);
      log("Decimals", state.decimals.toString());
      log("Authority", state.authority.toBase58());
      log("Mint", state.mint.toBase58());
      log("Paused", state.isPaused ? chalk.red("YES") : chalk.green("NO"));
      log("Version", state.version.toString());
      console.log();
      console.log(chalk.bold("  Supply"));
      console.log(chalk.gray("  " + "─".repeat(40)));
      log("Total Supply", supply.totalSupply.toString());
      log("Total Minted", supply.totalMinted.toString());
      log("Total Burned", supply.totalBurned.toString());
      log("Supply Cap", supply.supplyCap === BigInt(0) ? "Unlimited" : supply.supplyCap.toString());
      console.log();
      console.log(chalk.bold("  Features"));
      console.log(chalk.gray("  " + "─".repeat(40)));
      log("Permanent Delegate", features.permanentDelegate ? "✓" : "✗");
      log("Transfer Hook", features.transferHook ? "✓" : "✗");
      log("Default Frozen", features.defaultFrozen ? "✓" : "✗");
      log("Confidential Xfers", features.confidentialTransfers ? "✓" : "✗");
    } catch (err: any) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

// ── Presets Info ─────────────────────────────────────────────────────────────

program
  .command("presets")
  .description("Show available presets")
  .action(() => {
    const presets = [SSS1_PRESET, SSS2_PRESET, SSS3_PRESET];
    for (const p of presets) {
      console.log();
      console.log(chalk.bold.cyan(`  ${p.name}`));
      console.log(chalk.gray(`  ${p.description}`));
      console.log(`  ${chalk.dim("Roles:")} ${p.defaultRoles.join(", ")}`);
      console.log(
        `  ${chalk.dim("Hook:")} ${p.requiresTransferHook ? "Yes" : "No"}  ` +
          `${chalk.dim("Confidential:")} ${p.requiresConfidentialTransfers ? "Yes" : "No"}`
      );
    }
    console.log();
  });

// ── Parse ───────────────────────────────────────────────────────────────────

function parseRoleType(role: string): RoleType {
  const map: Record<string, RoleType> = {
    master: RoleType.Master,
    minter: RoleType.Minter,
    burner: RoleType.Burner,
    freezer: RoleType.Freezer,
    pauser: RoleType.Pauser,
    blacklister: RoleType.Blacklister,
    seizer: RoleType.Seizer,
  };
  const result = map[role.toLowerCase()];
  if (result === undefined) {
    throw new Error(
      `Invalid role: ${role}. Valid roles: ${Object.keys(map).join(", ")}`
    );
  }
  return result;
}

program.parse();
