# Compliance Guide

## Overview

This guide covers compliance workflows for regulated stablecoins using SSS-2 (and SSS-3). It maps traditional stablecoin compliance requirements to SSS capabilities.

## Regulatory Mapping

| Requirement | SSS Feature | How It Works |
|-------------|-------------|-------------|
| KYC/AML onboarding | DefaultAccountState | Accounts start frozen; thaw after KYC |
| Sanctions screening | TransferHook + Blacklist | Hook blocks transfers involving blacklisted addresses |
| Asset seizure | PermanentDelegate + Seizer role | Transfer tokens from any account |
| Emergency halt | Pause/Unpause | Instantly stop all operations |
| Audit trail | Events (on-chain logs) | All operations emit events |
| Rate limiting | MinterQuota | Cap minting per epoch |

## OFAC/Sanctions Compliance

### Screening Workflow

```
1. Check OFAC SDN List (off-chain)
   ↓
2. Match found → blacklist_add with reason
   ↓
3. Transfer hook blocks all future transfers
   ↓
4. If funds present → freeze → seize
```

### Blacklist Management

```bash
# Add sanctioned address
sss-token compliance blacklist-add \
  -m <MINT> -t <ADDRESS> \
  -r "OFAC SDN List - Match ID: 12345"

# Verify blacklist status
sss-token compliance check -m <MINT> -t <ADDRESS>

# Remove after investigation/delisting
sss-token compliance blacklist-remove -m <MINT> -t <ADDRESS>
```

### Full Enforcement

When a sanctioned address holds tokens:

```bash
sss-token compliance enforce \
  -m <MINT> \
  -t <SANCTIONED_ADDRESS> \
  --seize-to <TREASURY_ADDRESS> \
  -a <FULL_BALANCE> \
  -r "OFAC enforcement per Executive Order 13224"
```

This executes atomically:
1. Freeze the account
2. Add to blacklist
3. Seize all tokens to treasury

## Role Separation

For proper compliance, distribute roles across different keys:

```
CEO/Board        → Master (can grant/revoke roles)
Treasury Team    → Minter, Burner (token operations)
Compliance Team  → Freezer, Blacklister, Seizer (enforcement)
Operations Team  → Pauser (emergency response)
```

**Never** assign all roles to a single key in production.

## Audit Trail

### On-Chain Events

Every compliance action emits a structured event:

```typescript
// Subscribe to compliance events
program.addEventListener("BlacklistAdded", (event) => {
  log({
    action: "BLACKLIST_ADD",
    stablecoin: event.stablecoin.toBase58(),
    address: event.address.toBase58(),
    reason: event.reason,
    operator: event.addedBy.toBase58(),
    timestamp: new Date(),
  });
});

program.addEventListener("TokensSeized", (event) => {
  log({
    action: "SEIZE",
    from: event.from.toBase58(),
    to: event.to.toBase58(),
    amount: event.amount.toString(),
    operator: event.seizedBy.toBase58(),
  });
});
```

### Exportable Records

For regulatory reporting, extract events from on-chain transaction logs:

```typescript
const signatures = await connection.getSignaturesForAddress(stablecoinPda);
for (const sig of signatures) {
  const tx = await connection.getTransaction(sig.signature);
  // Parse Anchor events from tx.meta.logMessages
}
```

## Emergency Response

### Incident Playbook

1. **Detect** suspicious activity (monitoring/alerts)
2. **Freeze** affected accounts immediately
3. **Pause** the stablecoin if systemic
4. **Investigate** (off-chain KYC, law enforcement)
5. **Enforce** (blacklist, seize) or **Clear** (thaw, remove from blacklist)
6. **Unpause** when resolved

### Pause vs. Freeze

| Action | Scope | Use When |
|--------|-------|----------|
| **Freeze** | Single account | Known bad actor |
| **Pause** | All operations | Systemic issue, exploit, upgrade |

## SSS-3 Compliance (Privacy Model)

SSS-3 uses confidential transfers which are **incompatible** with transfer hooks. Compliance is handled differently:

| Concept | SSS-2 Approach | SSS-3 Approach |
|---------|---------------|---------------|
| Blacklist enforcement | Transfer hook | Off-chain check before approval |
| Audit | Public tx amounts | Auditor key decrypts amounts |
| Onboarding | Thaw (DefaultFrozen) | Thaw + configure auditor |

The auditor key allows a designated party to decrypt transaction amounts for regulatory review, while amounts remain hidden from the public.

## Compliance Checklist

For production deployment:

- [ ] Roles distributed across separate keys
- [ ] Minter quotas configured
- [ ] Supply cap set (if applicable)
- [ ] Monitoring/alerting set up for events
- [ ] OFAC screening integration
- [ ] Emergency pause procedures documented
- [ ] Seizure authority documented with legal basis
- [ ] Backup/recovery plan for master authority
- [ ] Regular key rotation schedule
- [ ] Audit log export to compliance systems
