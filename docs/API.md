# API Reference

## Core Program Instructions

### initialize

Creates a new stablecoin with Token-2022 mint and extensions.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `payer` | ✅ | ✅ | Pays for account creation |
| `authority` | ✅ | ❌ | Stablecoin authority (gets Master role) |
| `mint` | ✅ | ✅ | New mint keypair |
| `stablecoin` | ❌ | ✅ | PDA: ["stablecoin", mint] |
| `master_role` | ❌ | ✅ | PDA: ["role", stablecoin, authority, "master"] |
| `token_program` | ❌ | ❌ | Token-2022 program |
| `system_program` | ❌ | ❌ | System program |
| `rent` | ❌ | ❌ | Rent sysvar |

**Args:**

```rust
pub struct InitializeParams {
    pub name: String,        // max 32 chars
    pub symbol: String,      // max 8 chars
    pub uri: String,         // max 128 chars
    pub decimals: u8,        // 0-9
    pub features: u16,       // feature bitmask
    pub supply_cap: u64,     // 0 = unlimited
}
```

---

### mint_tokens

Mint tokens to a destination account.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `minter` | ✅ | ❌ | Must have Minter role |
| `stablecoin` | ❌ | ✅ | Stablecoin state PDA |
| `minter_role` | ❌ | ❌ | Minter's role PDA |
| `minter_quota` | ❌ | ✅ | Minter quota PDA |
| `mint` | ❌ | ✅ | Token mint |
| `destination` | ❌ | ✅ | Destination token account |
| `token_program` | ❌ | ❌ | Token-2022 program |

**Args:** `amount: u64`

---

### burn_tokens

Burn tokens from an account.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `burner` | ✅ | ❌ | Must have Burner role |
| `stablecoin` | ❌ | ✅ | Stablecoin state PDA |
| `burner_role` | ❌ | ❌ | Burner's role PDA |
| `mint` | ❌ | ✅ | Token mint |
| `from` | ❌ | ✅ | Source token account |
| `token_program` | ❌ | ❌ | Token-2022 program |

**Args:** `amount: u64`

---

### freeze_account / thaw_account

Freeze or unfreeze a token account.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `freezer` | ✅ | ❌ | Must have Freezer role |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `freezer_role` | ❌ | ❌ | Freezer's role PDA |
| `mint` | ❌ | ❌ | Token mint |
| `target_account` | ❌ | ✅ | Token account to freeze/thaw |
| `token_program` | ❌ | ❌ | Token-2022 program |

---

### pause / unpause

Pause or resume all stablecoin operations.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `pauser` | ✅ | ❌ | Must have Pauser role |
| `stablecoin` | ❌ | ✅ | Stablecoin state PDA |
| `pauser_role` | ❌ | ❌ | Pauser's role PDA |

---

### grant_role

Grant a role to an address.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | ✅ | ❌ | Must have Master role |
| `payer` | ✅ | ✅ | Pays for account creation |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `master_role` | ❌ | ❌ | Authority's master role PDA |
| `target_role` | ❌ | ✅ | New role PDA to create |
| `target` | ❌ | ❌ | Address receiving the role |
| `system_program` | ❌ | ❌ | System program |

**Args:** `role_type: RoleType` (enum: Master=0, Minter=1, Burner=2, Freezer=3, Pauser=4, Blacklister=5, Seizer=6)

---

### revoke_role

Revoke a role from an address.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | ✅ | ❌ | Must have Master role |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `master_role` | ❌ | ❌ | Authority's master role PDA |
| `target_role` | ❌ | ✅ | Role PDA to close |
| `target` | ❌ | ❌ | Address losing the role |

**Args:** `role_type: RoleType`

---

### update_minter_quota

Set minting limits for a minter.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | ✅ | ❌ | Must have Master role |
| `payer` | ✅ | ✅ | Pays for account if new |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `master_role` | ❌ | ❌ | Authority's master role PDA |
| `minter_quota` | ❌ | ✅ | Quota PDA |
| `minter` | ❌ | ❌ | Minter address |
| `system_program` | ❌ | ❌ | System program |

**Args:** `quota_per_epoch: u64`, `epoch_duration: i64`

---

### blacklist_add

Add an address to the blacklist.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `blacklister` | ✅ | ❌ | Must have Blacklister role |
| `payer` | ✅ | ✅ | Pays for account |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `blacklister_role` | ❌ | ❌ | Blacklister's role PDA |
| `blacklist_entry` | ❌ | ✅ | PDA: ["blacklist", stablecoin, target] |
| `target` | ❌ | ❌ | Address to blacklist |
| `system_program` | ❌ | ❌ | System program |

**Args:** `reason: String`

---

### blacklist_remove

Remove an address from the blacklist.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `blacklister` | ✅ | ❌ | Must have Blacklister role |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `blacklister_role` | ❌ | ❌ | Blacklister's role PDA |
| `blacklist_entry` | ❌ | ✅ | Blacklist entry PDA |
| `target` | ❌ | ❌ | Address to un-blacklist |

---

### seize

Seize tokens from a frozen account via PermanentDelegate.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `seizer` | ✅ | ❌ | Must have Seizer role |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `seizer_role` | ❌ | ❌ | Seizer's role PDA |
| `mint` | ❌ | ❌ | Token mint |
| `from` | ❌ | ✅ | Source token account (must be frozen) |
| `to` | ❌ | ✅ | Destination token account |
| `token_program` | ❌ | ❌ | Token-2022 program |

**Args:** `amount: u64`

---

### transfer_authority

Transfer the stablecoin authority.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | ✅ | ❌ | Current authority |
| `stablecoin` | ❌ | ✅ | Stablecoin state PDA |
| `master_role` | ❌ | ❌ | Current master role PDA |
| `new_authority` | ❌ | ❌ | New authority address |

---

## Transfer Hook Program

### initialize_hook

Initialize the transfer hook state.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | ✅ | ✅ | Stablecoin authority |
| `hook_state` | ❌ | ✅ | PDA: ["hook_state", mint] |
| `mint` | ❌ | ❌ | Token mint |
| `stablecoin` | ❌ | ❌ | Stablecoin state PDA |
| `system_program` | ❌ | ❌ | System program |

### execute (Transfer Hook)

Called automatically by Token-2022 on every `transfer_checked`.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `source` | ❌ | ❌ | Source token account |
| `mint` | ❌ | ❌ | Token mint |
| `destination` | ❌ | ❌ | Destination token account |
| `authority` | ❌ | ❌ | Transfer authority |
| `hook_state` | ❌ | ✅ | Hook state PDA |
| `source_blacklist` | ❌ | ❌ | Optional blacklist PDA for source owner |
| `dest_blacklist` | ❌ | ❌ | Optional blacklist PDA for dest owner |

---

## Error Codes

### Core Program

| Code | Name | Description |
|------|------|-------------|
| 6000 | `Unauthorized` | Missing required role |
| 6001 | `StablecoinPaused` | Operations halted |
| 6002 | `InsufficientBalance` | Not enough tokens |
| 6003 | `SupplyCapExceeded` | Would exceed cap |
| 6004 | `MinterQuotaExceeded` | Quota limit reached |
| 6005 | `AccountFrozen` | Account is frozen |
| 6006 | `AccountNotFrozen` | Account not frozen (seize requires frozen) |
| 6007 | `AccountBlacklisted` | Already blacklisted |
| 6008 | `AccountNotBlacklisted` | Not blacklisted |
| 6009 | `FeatureNotEnabled` | Required feature not set |
| 6010 | `InvalidDecimals` | Decimals > 9 |
| 6011 | `InvalidAuthority` | Wrong authority |
| 6012 | `RoleAlreadyGranted` | Duplicate role |
| 6013 | `InvalidRoleType` | Bad role enum |
| 6014 | `InvalidFeatureCombo` | Incompatible features |
| 6015 | `NameTooLong` | Name > 32 chars |
| 6016 | `SymbolTooLong` | Symbol > 8 chars |
| 6017 | `UriTooLong` | URI > 128 chars |
| 6018 | `MathOverflow` | Arithmetic overflow |
| 6019 | `SupplyCapTooLow` | Cap below current supply |

### Hook Program

| Code | Name | Description |
|------|------|-------------|
| 6100 | `SenderBlacklisted` | Source is blacklisted |
| 6101 | `RecipientBlacklisted` | Destination is blacklisted |
| 6102 | `HookNotActive` | Hook not initialized |
