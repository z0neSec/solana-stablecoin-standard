# Solana Stablecoin Standard (SSS)

> An open-source SDK, on-chain programs, and CLI for issuing regulatory-grade stablecoins on Solana using Token-2022 extensions.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

The **Solana Stablecoin Standard** provides a modular, tiered framework for creating and managing stablecoins on Solana. It leverages Token-2022 (SPL Token Extensions) to deliver institutional-grade features like freeze/seize, transfer hooks for blacklist enforcement, and confidential transfers — all through a clean SDK and CLI interface.

### Presets

| Preset | Description | Extensions Used |
|--------|-------------|-----------------|
| **SSS-1** Minimal | Basic mint/burn/RBAC | None |
| **SSS-2** Compliant | Full regulatory controls | PermanentDelegate, TransferHook, DefaultAccountState |
| **SSS-3** Private | Privacy-preserving | PermanentDelegate, ConfidentialTransferMint, DefaultAccountState |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  CLI (sss-token)                  │
├──────────────────────────────────────────────────┤
│              TypeScript SDK (@stbr/sss-token)     │
│  ┌────────────┬────────────┬────────────────────┐│
│  │   Client    │  Presets   │  ComplianceModule  ││
│  │ (create,    │ (SSS-1,   │  (blacklist, seize,││
│  │  mint,burn) │  SSS-2,   │   enforce)         ││
│  │             │  SSS-3)   │                    ││
│  └────────────┴────────────┴────────────────────┘│
├──────────────────────────────────────────────────┤
│            On-Chain Programs (Anchor)             │
│  ┌─────────────────┐  ┌────────────────────────┐ │
│  │    sss-core      │  │  sss-transfer-hook     │ │
│  │  (state, RBAC,   │  │  (blacklist check on   │ │
│  │   mint/burn,     │  │   every transfer)      │ │
│  │   freeze/seize)  │  │                        │ │
│  └─────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Rust 1.85+ with `rustup`
- Anchor 0.31.0
- Node.js 18+ & npm/yarn
- Solana CLI 1.18+

### Installation

```bash
# Clone the repository
git clone https://github.com/solanabr/solana-stablecoin-standard.git
cd solana-stablecoin-standard

# Install dependencies
yarn install

# Build programs
anchor build

# Run tests
anchor test
```

### SDK Usage

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const wallet = loadWallet(); // Your wallet adapter

const client = new SolanaStablecoin({ connection, wallet });

// Create an SSS-2 compliant stablecoin
const result = await client.create({
  name: "My Stablecoin",
  symbol: "MUSD",
  decimals: 6,
  preset: "SSS-2",
  supplyCap: BigInt(1_000_000_000_000), // 1M tokens
});

console.log("Mint:", result.mint.toBase58());

// Mint tokens
await client.mint(result.mint, destinationWallet, BigInt(100_000_000));

// Freeze a suspicious account
await client.freeze(result.mint, suspiciousAddress);

// Full enforcement: freeze → blacklist → seize
await client.compliance.enforceFullSanction(
  result.mint,
  sanctionedAddress,
  treasuryAddress,
  BigInt(50_000_000),
  "OFAC SDN List match"
);
```

### CLI Usage

```bash
# Show available presets
sss-token presets

# Create an SSS-2 stablecoin
sss-token create --name "USD Coin" --symbol USDC --preset SSS-2 --decimals 6

# Mint tokens
sss-token mint -m <MINT> -t <TO_ADDRESS> -a 1000000

# Compliance enforcement
sss-token compliance enforce -m <MINT> -t <TARGET> --seize-to <TREASURY> -a 500000

# Check status
sss-token info -m <MINT>
```

## Project Structure

```
├── programs/
│   ├── sss-core/          # Main stablecoin program
│   │   └── src/
│   │       ├── instructions/  # All instruction handlers
│   │       ├── state/         # Account state definitions
│   │       ├── error.rs       # Error codes
│   │       ├── events.rs      # Event definitions
│   │       └── constants.rs   # Seeds, limits
│   └── sss-transfer-hook/ # Transfer hook program
│       └── src/
│           ├── instructions/  # Initialize + execute
│           └── state/         # Hook state
├── sdk/                   # TypeScript SDK
│   └── src/
│       ├── client.ts      # Main SolanaStablecoin class
│       ├── presets.ts      # SSS-1/2/3 configurations
│       ├── compliance.ts  # ComplianceModule
│       ├── pda.ts         # PDA derivation helpers
│       ├── errors.ts      # Error mapping
│       ├── types.ts       # Type definitions
│       └── instructions/  # Low-level ix builders
├── cli/                   # CLI tool
│   └── src/index.ts
├── tests/                 # Integration tests
│   ├── sss-1.test.ts      # SSS-1 preset tests
│   └── sss-2.test.ts      # SSS-2 preset tests
└── docs/                  # Documentation
```

## Token-2022 Extensions

### PermanentDelegate (SSS-2, SSS-3)
Allows the stablecoin authority to seize tokens from any account. Used for regulatory compliance (e.g., OFAC sanctions enforcement).

### TransferHook (SSS-2)
Executes the `sss-transfer-hook` program on every transfer to enforce blacklist rules. Blocked addresses cannot send or receive tokens.

### DefaultAccountState (SSS-2, SSS-3)
New token accounts are created in a frozen state by default. Requires explicit approval (thaw) before use — "opt-in" compliance model.

### ConfidentialTransferMint (SSS-3)
Enables privacy-preserving transfers using zero-knowledge proofs. Transaction amounts are encrypted while maintaining regulatory auditability via the auditor key.

## RBAC Model

| Role | Capabilities |
|------|-------------|
| **Master** | Grant/revoke all roles, transfer authority |
| **Minter** | Mint tokens (subject to quota) |
| **Burner** | Burn tokens |
| **Freezer** | Freeze/thaw token accounts |
| **Pauser** | Pause/unpause all operations |
| **Blacklister** | Add/remove from blacklist |
| **Seizer** | Seize tokens (requires PermanentDelegate) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [SDK Reference](docs/SDK.md)
- [Operations Guide](docs/OPERATIONS.md)
- [SSS-1 Spec](docs/SSS-1.md)
- [SSS-2 Spec](docs/SSS-2.md)
- [Compliance Guide](docs/COMPLIANCE.md)
- [API Reference](docs/API.md)

## Testing

```bash
# Run all tests
anchor test

# Run SDK unit tests
cd sdk && npx mocha tests/**/*.test.ts --require ts-node/register

# Run specific preset tests
anchor test -- --grep "SSS-1"
anchor test -- --grep "SSS-2"
```

## Security Considerations

- **PermanentDelegate is powerful** — the stablecoin PDA has permanent delegate authority over all token accounts. This is by design for regulatory compliance but means the master authority has ultimate control.
- **Transfer hooks + confidential transfers are incompatible** in Token-2022. SSS-2 uses hooks for compliance; SSS-3 uses auditor keys instead.
- **Seize requires frozen accounts** — prevents front-running by requiring the account to be frozen before seizure.
- **Epoch-based minter quotas** — rate limits prevent unlimited minting even by authorized minters.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/awesome`)
3. Run tests (`anchor test`)
4. Submit a Pull Request

## License

MIT — see [LICENSE](LICENSE)
