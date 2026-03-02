# SDK Reference

## Installation

```bash
npm install @stbr/sss-token
# or
yarn add @stbr/sss-token
```

## Quick Start

```typescript
import { SolanaStablecoin, RoleType } from "@stbr/sss-token";
import { Connection } from "@solana/web3.js";

const client = new SolanaStablecoin({
  connection: new Connection("https://api.devnet.solana.com"),
  wallet: myWalletAdapter, // AnchorWallet or similar
});
```

## SolanaStablecoin Class

### Constructor

```typescript
new SolanaStablecoin(config: SolanaStablecoinConfig)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `connection` | `Connection` | Solana RPC connection |
| `wallet` | `{ publicKey, signTransaction }` | Wallet adapter |
| `programId?` | `PublicKey` | Core program ID (default: SSS_CORE_PROGRAM_ID) |
| `hookProgramId?` | `PublicKey` | Hook program ID (default: SSS_HOOK_PROGRAM_ID) |
| `confirmOptions?` | `ConfirmOptions` | Transaction confirmation (default: confirmed) |

### create(params)

Create a new stablecoin.

```typescript
const result = await client.create({
  name: "My Token",
  symbol: "MTK",
  uri: "https://example.com/metadata.json",
  decimals: 6,
  preset: "SSS-2",        // or "SSS-1", "SSS-3"
  supplyCap: BigInt(0),    // 0 = unlimited
  mintKeypair: Keypair.generate(), // optional
});
// Returns: { mint, stablecoin, masterRole, txSignature, preset }
```

### mint(mint, destination, amount)

Mint tokens. Caller must have the Minter role.

```typescript
const sig = await client.mint(
  mintAddress,
  destinationWallet,
  BigInt(1_000_000) // 1 token with 6 decimals
);
```

### burn(mint, from, amount)

Burn tokens. Caller must have the Burner role.

```typescript
const sig = await client.burn(mintAddress, fromWallet, BigInt(500_000));
```

### freeze(mint, target) / thaw(mint, target)

Freeze or unfreeze a token account. Caller must have the Freezer role.

```typescript
await client.freeze(mintAddress, suspiciousAddress);
// later...
await client.thaw(mintAddress, suspiciousAddress);
```

### pause(mint) / unpause(mint)

Pause or unpause all operations. Caller must have the Pauser role.

```typescript
await client.pause(mintAddress);    // Emergency halt
await client.unpause(mintAddress);  // Resume
```

### grantRole(mint, target, roleType) / revokeRole(mint, target, roleType)

Role management. Caller must have the Master role.

```typescript
import { RoleType } from "@stbr/sss-token";

await client.grantRole(mintAddress, newMinter, RoleType.Minter);
await client.revokeRole(mintAddress, oldMinter, RoleType.Minter);
```

### updateMinterQuota(mint, minter, quotaPerEpoch, epochDuration?)

Set minting limits per epoch.

```typescript
await client.updateMinterQuota(
  mintAddress,
  minterAddress,
  BigInt(10_000_000_000), // 10K tokens per epoch
  BigInt(86400)           // 1 day epoch (seconds)
);
```

### seize(mint, from, to, amount)

Seize tokens from a frozen account. Requires PermanentDelegate feature + Seizer role.

```typescript
await client.seize(
  mintAddress,
  frozenAccountOwner,
  treasuryAddress,
  BigInt(1_000_000)
);
```

### transferAuthority(mint, newAuthority)

Transfer master authority to a new address.

```typescript
await client.transferAuthority(mintAddress, newAuthorityAddress);
```

## Query Methods

### getStablecoinState(mint)

```typescript
const state = await client.getStablecoinState(mintAddress);
// Returns: StablecoinState | null
```

### hasRole(mint, address, roleType)

```typescript
const isMinter = await client.hasRole(mint, address, RoleType.Minter);
```

### isBlacklisted(mint, address)

```typescript
const blocked = await client.isBlacklisted(mint, targetAddress);
```

### getBalance(mint, owner)

```typescript
const balance = await client.getBalance(mint, ownerAddress);
```

### getSupplyInfo(mint)

```typescript
const info = await client.getSupplyInfo(mint);
// { totalSupply, totalMinted, totalBurned, supplyCap }
```

## ComplianceModule

Accessed via `client.compliance`.

### blacklistAdd(mint, target, reason?)

```typescript
await client.compliance.blacklistAdd(mint, target, "OFAC match");
```

### blacklistRemove(mint, target)

```typescript
await client.compliance.blacklistRemove(mint, target);
```

### enforceFullSanction(mint, target, seizeTo, amount, reason?)

Atomic freeze → blacklist → seize in a single transaction.

```typescript
await client.compliance.enforceFullSanction(
  mint,
  sanctionedAddress,
  treasuryAddress,
  BigInt(1_000_000),
  "Regulatory enforcement"
);
```

### liftSanction(mint, target)

Remove from blacklist and thaw.

```typescript
await client.compliance.liftSanction(mint, clearedAddress);
```

### getComplianceStatus(mint, address)

```typescript
const status = await client.compliance.getComplianceStatus(mint, address);
// { isBlacklisted, isFrozen, canTransfer }
```

## PDA Helpers

Standalone PDA derivation — useful for building custom transactions.

```typescript
import {
  getStablecoinAddress,
  getRoleAddress,
  getMinterQuotaAddress,
  getBlacklistAddress,
  deriveStablecoinAddresses,
} from "@stbr/sss-token";

const [stablecoin, bump] = getStablecoinAddress(mint);
const [role, roleBump] = getRoleAddress(stablecoin, holder, "minter");
const all = deriveStablecoinAddresses(mint, authority);
```

## Presets

```typescript
import {
  SSS1_PRESET,
  SSS2_PRESET,
  SSS3_PRESET,
  getPreset,
  buildFeatures,
  parseFeatures,
} from "@stbr/sss-token";

// Use preset
console.log(SSS2_PRESET.features); // 7 (0b0111)

// Build custom features
const features = buildFeatures({
  permanentDelegate: true,
  defaultFrozen: true,
});

// Parse bitmask
const parsed = parseFeatures(7);
// { permanentDelegate: true, transferHook: true, defaultFrozen: true, ... }
```

## Low-Level Instructions

For custom transaction building:

```typescript
import {
  createInitializeInstruction,
  createMintInstruction,
  createFreezeInstruction,
  // ... etc
} from "@stbr/sss-token/instructions";

const ix = createMintInstruction({
  mint,
  minter: wallet.publicKey,
  destination: target,
  amount: BigInt(1000),
});

const tx = new Transaction().add(ix);
```

## Error Handling

```typescript
import { SSSError, SSSErrorCode, withSSSError } from "@stbr/sss-token";

try {
  await client.mint(mint, dest, BigInt(1000));
} catch (err) {
  if (err instanceof SSSError) {
    console.log(err.code);    // e.g., 6001
    console.log(err.message); // "Stablecoin is paused"
  }
}
```
