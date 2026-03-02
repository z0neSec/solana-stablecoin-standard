# SSS-2: Compliant Preset

## Overview

SSS-2 is the regulatory-grade stablecoin preset designed for real-world compliance requirements. It mirrors the capabilities of USDC and USDT on Solana using Token-2022 extensions.

## Features

| Extension | Purpose |
|-----------|---------|
| **PermanentDelegate** | Enables asset seizure from any account |
| **TransferHook** | Enforces blacklist on every transfer |
| **DefaultAccountState** | New accounts start frozen (require thaw) |

## Feature Bitmask

```
features = 0b0111 (7)
  Bit 0: PERMANENT_DELEGATE ✓
  Bit 1: TRANSFER_HOOK      ✓
  Bit 2: DEFAULT_FROZEN      ✓
  Bit 3: CONFIDENTIAL_XFERS  ✗
```

## RBAC Model

All 7 roles are relevant for SSS-2:

| Role | Permissions |
|------|------------|
| **Master** | Grant/revoke roles, transfer authority, set quotas |
| **Minter** | Mint new tokens (subject to quota) |
| **Burner** | Burn tokens |
| **Freezer** | Freeze/thaw individual accounts |
| **Pauser** | Emergency pause/unpause all operations |
| **Blacklister** | Add/remove addresses from blacklist |
| **Seizer** | Seize tokens from frozen accounts |

## How Transfer Hooks Work

```
User calls transfer_checked() on Token-2022
    ↓
Token-2022 invokes sss-transfer-hook::execute()
    ↓
Hook checks source blacklist PDA → exists? → REJECT
    ↓
Hook checks destination blacklist PDA → exists? → REJECT
    ↓
Both clear → ALLOW transfer
    ↓
Hook increments transfers_checked counter
```

### Key Points

- Transfer hooks run on **every** transfer, not just ones initiated through the SSS SDK
- Standard `transfer` (without `_checked`) will fail — Token-2022 requires `transfer_checked` for tokens with hooks
- The hook program is immutable once deployed — it always checks the same blacklist PDAs

## Default Frozen Accounts

With DefaultAccountState enabled:
1. `createAssociatedTokenAccount()` creates an account in **frozen** state
2. The Freezer must call `thaw_account` before the user can receive tokens
3. This creates an "opt-in" compliance model — no transfers until approved

### Onboarding Flow

```
New User → Creates Token Account (frozen by default)
    ↓
KYC/AML Check → Passes
    ↓
Freezer/Compliance Agent → thaw_account()
    ↓
User can now send/receive tokens
```

## Asset Seizure (Seize)

The PermanentDelegate extension allows the stablecoin PDA to transfer tokens from any account, even without the account owner's signature.

**Safety requirements:**
1. Account MUST be frozen first (prevents front-running)
2. Caller MUST have Seizer role
3. PermanentDelegate feature MUST be enabled

```typescript
// Full enforcement flow
await client.compliance.enforceFullSanction(
  mint,
  sanctionedAddress,
  treasuryAddress,
  seizeAmount,
  "Court order #12345"
);
```

This sends one atomic transaction with:
1. `freeze_account` — freeze the target
2. `blacklist_add` — add to blacklist (blocks future transfers)
3. `seize` — transfer tokens via permanent delegate

## Creating SSS-2

```typescript
const { mint } = await client.create({
  name: "Compliant USD",
  symbol: "CUSD",
  preset: "SSS-2",
  decimals: 6,
  supplyCap: BigInt(1_000_000_000_000),
});
```

## Transfer Hook and Seize Limitation

> **Important:** When a transfer hook is active, the `seize` operation (which uses `transfer_checked` internally) will also trigger the transfer hook. If the target account is blacklisted, the hook would reject the transfer — including the seizure.
>
> **Workaround:** Seize BEFORE blacklisting, or use `burn` instead of `transfer` for seized funds. The `enforceFullSanction` method handles this ordering correctly.

## Example: Complete SSS-2 Lifecycle

```typescript
// 1. Create
const { mint } = await client.create({
  name: "Regulated Coin",
  symbol: "RGC",
  preset: "SSS-2",
  decimals: 6,
});

// 2. Setup roles
await client.grantRole(mint, minter, RoleType.Minter);
await client.grantRole(mint, compliance, RoleType.Freezer);
await client.grantRole(mint, compliance, RoleType.Blacklister);
await client.grantRole(mint, compliance, RoleType.Seizer);

// 3. Onboard a user (thaw their default-frozen account)
await client.thaw(mint, newUser);

// 4. Mint tokens
await client.mint(mint, newUser, BigInt(100_000_000));

// 5. Detect suspicious activity → freeze
await client.freeze(mint, suspiciousUser);

// 6. After investigation → enforce
await client.compliance.enforceFullSanction(
  mint,
  suspiciousUser,
  treasury,
  BigInt(100_000_000),
  "Fraud investigation #789"
);

// 7. False positive → lift sanction
await client.compliance.liftSanction(mint, clearedUser);
```
