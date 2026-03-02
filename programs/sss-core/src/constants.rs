/// PDA seed prefixes
pub const STABLECOIN_SEED: &[u8] = b"stablecoin";
pub const ROLE_SEED: &[u8] = b"role";
pub const MINTER_QUOTA_SEED: &[u8] = b"minter_quota";
pub const BLACKLIST_SEED: &[u8] = b"blacklist";

/// String length limits
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 200;
pub const MAX_REASON_LEN: usize = 128;

/// Default epoch duration: 24 hours
pub const DEFAULT_EPOCH_DURATION: i64 = 86_400;

/// Maximum decimals allowed
pub const MAX_DECIMALS: u8 = 9;
