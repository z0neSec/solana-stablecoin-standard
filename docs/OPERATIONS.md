# Operations Guide

## Deploying a Stablecoin

### Step 1: Choose a Preset

| Preset | When to Use |
|--------|------------|
| SSS-1 | Internal tokens, testing, no compliance needed |
| SSS-2 | Regulated stablecoins requiring freeze/seize/blacklist |
| SSS-3 | Privacy-preserving tokens with confidential transfers |

### Step 2: Deploy Programs

```bash
# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Note down the program IDs from the output
```

### Step 3: Create the Stablecoin

**Via CLI:**
```bash
sss-token create \
  --name "USD Stablecoin" \
  --symbol USDX \
  --preset SSS-2 \
  --decimals 6 \
  --supply-cap 1000000000000  # 1M tokens (6 decimals)
```

**Via SDK:**
```typescript
const result = await client.create({
  name: "USD Stablecoin",
  symbol: "USDX",
  preset: "SSS-2",
  decimals: 6,
  supplyCap: BigInt(1_000_000_000_000),
});
```

### Step 4: Configure Roles

```bash
# Grant minter role
sss-token role grant -m <MINT> -t <MINTER_ADDRESS> -r minter

# Grant freezer role  
sss-token role grant -m <MINT> -t <COMPLIANCE_ADDRESS> -r freezer

# Grant blacklister role
sss-token role grant -m <MINT> -t <COMPLIANCE_ADDRESS> -r blacklister

# Grant seizer role
sss-token role grant -m <MINT> -t <COMPLIANCE_ADDRESS> -r seizer

# Set minter quota (optional)
sss-token mint-quota -m <MINT> --minter <MINTER> --quota 5000000000 --epoch 86400
```

## Day-to-Day Operations

### Minting

```bash
sss-token mint -m <MINT> -t <RECIPIENT> -a 1000000000
```

Minting checks:
1. Stablecoin is not paused
2. Caller has Minter role
3. Supply cap not exceeded
4. Minter quota not exceeded for this epoch

### Burning

```bash
sss-token burn -m <MINT> -f <FROM_OWNER> -a 500000000
```

### Checking Info

```bash
sss-token info -m <MINT>
```

## Compliance Operations

### Freezing an Account

When suspicious activity is detected:

```bash
# Freeze
sss-token freeze -m <MINT> -t <SUSPICIOUS_ADDRESS>

# Later, after investigation:
sss-token thaw -m <MINT> -t <CLEARED_ADDRESS>
```

### Blacklisting

Prevent an address from sending or receiving:

```bash
# Add to blacklist (only affects SSS-2 with transfer hook)
sss-token compliance blacklist-add -m <MINT> -t <BAD_ADDRESS> -r "OFAC SDN match"

# Remove from blacklist
sss-token compliance blacklist-remove -m <MINT> -t <CLEARED_ADDRESS>
```

### Seizing Assets

For regulatory enforcement (requires PermanentDelegate):

```bash
# Step 1: Freeze the account (required)
sss-token freeze -m <MINT> -t <TARGET>

# Step 2: Seize tokens
sss-token compliance enforce \
  -m <MINT> \
  -t <TARGET> \
  --seize-to <TREASURY> \
  -a <AMOUNT> \
  -r "Court order #12345"
```

Or use the atomic enforcement (freeze + blacklist + seize in one tx):

```bash
sss-token compliance enforce \
  -m <MINT> \
  -t <TARGET> \
  --seize-to <TREASURY> \
  -a <AMOUNT> \
  -r "OFAC enforcement"
```

### Emergency Pause

Halt ALL operations immediately:

```bash
# Pause
sss-token pause -m <MINT>

# When crisis resolved:
sss-token unpause -m <MINT>
```

When paused, these operations are blocked:
- Minting
- Burning
- Transfers (via pause check in instructions)

## Authority Transfer

Transfer master authority to a new key or multisig:

```bash
# Transfer authority
sss-token authority transfer -m <MINT> --new-authority <NEW_KEY>
```

**Warning:** This is irreversible. The old authority loses all master privileges.

## Monitoring

### Event Emission

The program emits events for all state-changing operations:

| Event | Fields |
|-------|--------|
| `StablecoinInitialized` | stablecoin, mint, authority, features, preset |
| `TokensMinted` | stablecoin, minter, destination, amount, total_supply |
| `TokensBurned` | stablecoin, burner, from, amount, total_supply |
| `AccountFrozen` | stablecoin, account, frozen_by |
| `AccountThawed` | stablecoin, account, thawed_by |
| `Paused` | stablecoin, paused_by |
| `Unpaused` | stablecoin, unpaused_by |
| `RoleGranted` | stablecoin, role, holder, granted_by |
| `RoleRevoked` | stablecoin, role, holder, revoked_by |
| `BlacklistAdded` | stablecoin, address, reason, added_by |
| `BlacklistRemoved` | stablecoin, address, removed_by |
| `TokensSeized` | stablecoin, from, to, amount, seized_by |
| `AuthorityTransferred` | stablecoin, old_authority, new_authority |

### Log Parsing

```typescript
// Listen for events using Anchor
program.addEventListener("TokensMinted", (event) => {
  console.log(`Minted ${event.amount} to ${event.destination}`);
});
```

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Unauthorized` | Missing required role | Grant the appropriate role |
| `StablecoinPaused` | Operations halted | Unpause the stablecoin |
| `SupplyCapExceeded` | Would exceed cap | Burn tokens or increase cap |
| `MinterQuotaExceeded` | Quota limit hit | Wait for next epoch or update quota |
| `AccountNotFrozen` | Trying to seize unfrozen account | Freeze the account first |
| `FeatureNotEnabled` | Using SSS-2 feature on SSS-1 | Create with correct preset |
| `InvalidFeatureCombo` | Hook + confidential | Choose SSS-2 OR SSS-3, not both |
