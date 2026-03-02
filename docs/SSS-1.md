# SSS-1: Minimal Preset

## Overview

SSS-1 is the simplest stablecoin preset. It provides basic token operations without any Token-2022 compliance extensions.

## Features

- **Mint/Burn** with role-based access control
- **RBAC** — Master, Minter, Burner roles
- **Pause/Unpause** — emergency halt capability
- **Supply cap** — optional maximum supply limit
- **Minter quotas** — per-epoch rate limiting

## What SSS-1 Does NOT Include

- ❌ PermanentDelegate (no seize capability)
- ❌ TransferHook (no blacklist enforcement on transfers)
- ❌ DefaultAccountState (accounts are not frozen by default)
- ❌ ConfidentialTransfers (no privacy)

## When to Use SSS-1

- Internal utility tokens
- Testing and development
- Tokens that don't need regulatory controls
- When you want the simplest possible setup

## Creating SSS-1

```typescript
const result = await client.create({
  name: "Simple Token",
  symbol: "SIMP",
  decimals: 6,
  preset: "SSS-1",
});
```

```bash
sss-token create --name "Simple Token" --symbol SIMP --preset SSS-1
```

## Feature Bitmask

```
features = 0b0000 (0)
```

No extension bits are set.

## Available Operations

| Operation | Required Role | Available |
|-----------|--------------|-----------|
| Initialize | Creator | ✅ |
| Mint | Minter | ✅ |
| Burn | Burner | ✅ |
| Freeze | Freezer | ✅* |
| Thaw | Freezer | ✅* |
| Pause | Pauser | ✅ |
| Grant Role | Master | ✅ |
| Revoke Role | Master | ✅ |
| Blacklist | Blacklister | ⚠️ On-chain only, not enforced on transfers |
| Seize | Seizer | ❌ Requires PermanentDelegate |
| Transfer Hook | — | ❌ Not enabled |

*Freeze/thaw works but DefaultAccountState is not enabled (accounts start unfrozen).

## Upgrade Path

SSS-1 tokens **cannot be upgraded** to SSS-2 or SSS-3 after creation. Token-2022 extensions must be set during mint initialization. If you need compliance features later, create a new stablecoin with SSS-2.

## Example: Full SSS-1 Lifecycle

```typescript
import { SolanaStablecoin, RoleType } from "@stbr/sss-token";

const client = new SolanaStablecoin({ connection, wallet });

// 1. Create
const { mint } = await client.create({
  name: "Test Dollar",
  symbol: "TSTD",
  preset: "SSS-1",
  decimals: 6,
});

// 2. Grant minter
await client.grantRole(mint, minterWallet, RoleType.Minter);

// 3. Set quota
await client.updateMinterQuota(
  mint,
  minterWallet,
  BigInt(10_000_000_000), // 10K per day
  BigInt(86400)
);

// 4. Mint
await client.mint(mint, userWallet, BigInt(1_000_000));

// 5. Burn
await client.burn(mint, userWallet, BigInt(500_000));

// 6. Check supply
const info = await client.getSupplyInfo(mint);
console.log("Supply:", info.totalSupply.toString());
```
