# Architecture

## Design Philosophy

The Solana Stablecoin Standard follows a **modular, layered architecture** where each layer adds capabilities without changing the interface of layers below it. This design is inspired by the Solana Vault Standard (SVS) and real-world stablecoin requirements (USDC, USDT, PYUSD).

## Layer Model

```
Layer 3: Presets (SSS-1, SSS-2, SSS-3)
         Pre-configured combinations of features + roles
         ↓ composed from ↓

Layer 2: Modules (Compliance, Privacy)
         Optional middleware: transfer hooks, blacklists, confidential transfers
         ↓ built on ↓

Layer 1: Base SDK (SolanaStablecoin client)
         Core operations: create, mint, burn, freeze, roles
```

### Layer 1 — Base SDK

The foundation. Every stablecoin uses this layer regardless of preset.

- **Token creation** with Token-2022 (MetadataPointer for on-chain metadata)
- **RBAC** — 7 role types, each as a separate PDA
- **Mint/Burn** with quota enforcement
- **Freeze/Thaw** individual token accounts
- **Pause/Unpause** the entire stablecoin
- **Authority transfer** (two-step pattern)

### Layer 2 — Modules

Optional capabilities enabled via feature flags:

- **Compliance Module** — blacklisting, transfer hook enforcement, asset seizure
- **Privacy Module** — confidential transfers with auditor key (SSS-3)

### Layer 3 — Presets

Ready-to-use configurations:

| Preset | Features | Use Case |
|--------|----------|----------|
| SSS-1 | None | Testing, simple tokens |
| SSS-2 | PermanentDelegate + TransferHook + DefaultFrozen | Regulated stablecoins |
| SSS-3 | PermanentDelegate + Confidential + DefaultFrozen | Private stablecoins |

## On-Chain Programs

### sss-core

The main program managing all stablecoin state and operations.

**Accounts:**

```
StablecoinState (PDA: ["stablecoin", mint])
├── authority: Pubkey
├── mint: Pubkey
├── name: String (max 32)
├── symbol: String (max 8)
├── uri: String (max 128)
├── decimals: u8
├── features: u16 (bitmask)
├── is_paused: bool
├── total_minted: u64
├── total_burned: u64
├── supply_cap: u64
├── transfer_hook_program: Pubkey
├── bump: u8
├── version: u8
└── _reserved: [u8; 64]

RoleAccount (PDA: ["role", stablecoin, holder, role_seed])
├── stablecoin: Pubkey
├── holder: Pubkey
├── role_type: u8
├── is_active: bool
├── granted_at: i64
├── granted_by: Pubkey
└── bump: u8

MinterQuota (PDA: ["minter_quota", stablecoin, minter])
├── stablecoin: Pubkey
├── minter: Pubkey
├── quota_per_epoch: u64
├── minted_this_epoch: u64
├── epoch_start: i64
├── epoch_duration: i64
└── bump: u8

BlacklistEntry (PDA: ["blacklist", stablecoin, address])
├── stablecoin: Pubkey
├── address: Pubkey
├── reason: String
├── created_at: i64
├── created_by: Pubkey
├── is_active: bool
└── bump: u8
```

**Instructions:**

| Instruction | Roles Required | Description |
|-------------|---------------|-------------|
| `initialize` | Creator | Create a new stablecoin |
| `mint_tokens` | Minter | Mint tokens to a destination |
| `burn_tokens` | Burner | Burn tokens from an account |
| `freeze_account` | Freezer | Freeze a token account |
| `thaw_account` | Freezer | Unfreeze a token account |
| `pause` | Pauser | Pause all operations |
| `unpause` | Pauser | Resume operations |
| `grant_role` | Master | Grant a role to an address |
| `revoke_role` | Master | Revoke a role |
| `update_minter_quota` | Master | Set minting limits |
| `transfer_authority` | Master | Transfer master authority |
| `blacklist_add` | Blacklister | Add to blacklist |
| `blacklist_remove` | Blacklister | Remove from blacklist |
| `seize` | Seizer | Seize tokens (frozen accounts only) |

### sss-transfer-hook

Implements the SPL Transfer Hook Interface. Installed on SSS-2 mints.

**Flow:**
1. User initiates transfer via Token-2022
2. Token-2022 calls `sss-transfer-hook::execute`
3. Hook checks source and destination against blacklist PDAs
4. If either is blacklisted → transfer rejected
5. If both clear → transfer proceeds, counters updated

**Accounts:**
```
HookState (PDA: ["hook_state", mint])
├── stablecoin: Pubkey
├── mint: Pubkey
├── is_active: bool
├── transfers_checked: u64
├── transfers_blocked: u64
└── bump: u8
```

## Feature Flag Design

Features are stored as a `u16` bitmask in `StablecoinState.features`:

```
Bit 0: PERMANENT_DELEGATE (1)
Bit 1: TRANSFER_HOOK      (2)
Bit 2: DEFAULT_FROZEN      (4)
Bit 3: CONFIDENTIAL_XFERS  (8)
```

**Validation rules:**
- Transfer hook requires permanent delegate (for seize to work)
- Transfer hook and confidential transfers are mutually exclusive (Token-2022 limitation)
- Decimals must be 0–9

## PDA Derivation

All PDAs use deterministic seeds for client-side derivation:

```typescript
// Stablecoin state
[Buffer.from("stablecoin"), mint.toBuffer()]

// Role
[Buffer.from("role"), stablecoin.toBuffer(), holder.toBuffer(), Buffer.from(role_seed)]

// Minter quota
[Buffer.from("minter_quota"), stablecoin.toBuffer(), minter.toBuffer()]

// Blacklist entry
[Buffer.from("blacklist"), stablecoin.toBuffer(), address.toBuffer()]

// Hook state
[Buffer.from("hook_state"), mint.toBuffer()]
```

## Security Model

### Threat Model

1. **Unauthorized minting** → Prevented by RBAC (minter role required) + quotas
2. **Front-running seizure** → Prevented by requiring frozen accounts before seize
3. **Blacklist evasion** → Prevented by transfer hook checking both source and destination
4. **Authority compromise** → Mitigated by role separation (7 distinct roles)
5. **Emergency response** → Pauser can halt all operations instantly

### Invariants

1. `total_supply == total_minted - total_burned` (tracked off-chain via events)
2. Only the master role can grant/revoke other roles
3. Seize is impossible without PermanentDelegate feature enabled
4. Transfer hook is only invoked if the feature flag is set during initialization
5. Minter quota resets each epoch — prevents accumulation
