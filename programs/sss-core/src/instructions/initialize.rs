use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;
use spl_token_2022::extension::ExtensionType;

use crate::constants::*;
use crate::error::SSSError;
use crate::events::StablecoinInitialized;
use crate::state::*;

/// Parameters for initializing a new stablecoin.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub supply_cap: u64,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub enable_default_frozen: bool,
    pub enable_confidential_transfers: bool,
    pub transfer_hook_program: Option<Pubkey>,
}

impl InitializeParams {
    /// Compute the feature bitflags from the params.
    pub fn features(&self) -> u16 {
        let mut f: u16 = 0;
        if self.enable_permanent_delegate {
            f |= FEATURE_PERMANENT_DELEGATE;
        }
        if self.enable_transfer_hook {
            f |= FEATURE_TRANSFER_HOOK;
        }
        if self.enable_default_frozen {
            f |= FEATURE_DEFAULT_FROZEN;
        }
        if self.enable_confidential_transfers {
            f |= FEATURE_CONFIDENTIAL_TRANSFERS;
        }
        f
    }

    pub fn validate(&self) -> Result<()> {
        require!(self.decimals <= MAX_DECIMALS, SSSError::InvalidDecimals);
        require!(self.name.len() <= MAX_NAME_LEN, SSSError::StringTooLong);
        require!(self.symbol.len() <= MAX_SYMBOL_LEN, SSSError::StringTooLong);
        require!(self.uri.len() <= MAX_URI_LEN, SSSError::StringTooLong);

        // Transfer hook requires permanent delegate
        if self.enable_transfer_hook {
            require!(
                self.enable_permanent_delegate,
                SSSError::InvalidFeatureCombination
            );
        }

        // Confidential transfers are incompatible with transfer hooks
        if self.enable_confidential_transfers && self.enable_transfer_hook {
            return Err(error!(SSSError::IncompatibleFeatures));
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    /// The authority who will become the master of this stablecoin.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The stablecoin state PDA.
    #[account(
        init,
        payer = authority,
        space = 8 + StablecoinState::INIT_SPACE,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump,
    )]
    pub stablecoin: Account<'info, StablecoinState>,

    /// The Token-2022 mint to be created.
    /// CHECK: Initialized in the handler via CPI.
    #[account(mut)]
    pub mint: Signer<'info>,

    /// The master role PDA — auto-created for the authority.
    #[account(
        init,
        payer = authority,
        space = 8 + RoleAccount::INIT_SPACE,
        seeds = [ROLE_SEED, stablecoin.key().as_ref(), authority.key().as_ref(), b"master"],
        bump,
    )]
    pub master_role: Account<'info, RoleAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    params.validate()?;

    let features = params.features();
    let clock = Clock::get()?;
    let stablecoin = &mut ctx.accounts.stablecoin;
    let bump = ctx.bumps.stablecoin;

    // ─── Determine required extensions ───────────────────────────────
    let mut extensions: Vec<ExtensionType> = vec![
        ExtensionType::MetadataPointer,
    ];

    if params.enable_permanent_delegate {
        extensions.push(ExtensionType::PermanentDelegate);
    }

    if params.enable_transfer_hook {
        extensions.push(ExtensionType::TransferHook);
    }

    if params.enable_default_frozen {
        extensions.push(ExtensionType::DefaultAccountState);
    }

    if params.enable_confidential_transfers {
        extensions.push(ExtensionType::ConfidentialTransferMint);
    }

    // ─── Calculate mint account size with extensions ─────────────────
    let mint_account_size =
        ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(&extensions)
            .map_err(|_| SSSError::MathOverflow)?;

    // The metadata content (name, symbol, URI) is stored inline in the
    // mint account as a TLV record.  add the content length plus a
    // fixed overhead for the TLV discriminator + length fields.
    //   TLV header: 4 (type) + 4 (length) = 8
    //   TokenMetadata fixed overhead: update_authority(32) + mint(32)
    //                                  + 4+len(name) + 4+len(symbol)
    //                                  + 4+len(uri) + 4 (additional_metadata vec len)
    let metadata_content_size: usize = 8  // TLV header
        + 32  // update_authority
        + 32  // mint
        + 4 + params.name.len()
        + 4 + params.symbol.len()
        + 4 + params.uri.len()
        + 4;  // additional_metadata (empty vec)

    let total_mint_size = mint_account_size + metadata_content_size;

    let lamports = Rent::get()?.minimum_balance(total_mint_size);

    // ─── Create mint account ─────────────────────────────────────────
    anchor_lang::system_program::create_account(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.mint.to_account_info(),
            },
        ),
        lamports,
        total_mint_size as u64,
        ctx.accounts.token_program.key,
    )?;

    // ─── Initialize extensions before mint ────────────────────────────
    // MetadataPointer: point to the mint itself
    spl_token_2022::extension::metadata_pointer::instruction::initialize(
        ctx.accounts.token_program.key,
        &ctx.accounts.mint.key(),
        Some(stablecoin.key()),
        Some(ctx.accounts.mint.key()),
    )
    .map(|ix| {
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.mint.to_account_info(),
            ],
        )
    })
    .map_err(|_| SSSError::MathOverflow)??;

    // Permanent Delegate
    if params.enable_permanent_delegate {
        let ix = spl_token_2022::instruction::initialize_permanent_delegate(
            ctx.accounts.token_program.key,
            &ctx.accounts.mint.key(),
            &stablecoin.key(),
        )?;
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    // Transfer Hook
    if params.enable_transfer_hook {
        let hook_program = params
            .transfer_hook_program
            .ok_or(SSSError::TransferHookNotConfigured)?;

        let ix = spl_token_2022::extension::transfer_hook::instruction::initialize(
            ctx.accounts.token_program.key,
            &ctx.accounts.mint.key(),
            Some(stablecoin.key()),
            Some(hook_program),
        )?;
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    // Default Account State (Frozen)
    if params.enable_default_frozen {
        let ix = spl_token_2022::extension::default_account_state::instruction::initialize_default_account_state(
            ctx.accounts.token_program.key,
            &ctx.accounts.mint.key(),
            &spl_token_2022::state::AccountState::Frozen,
        )?;
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    // ─── Initialize Mint ─────────────────────────────────────────────
    let ix = spl_token_2022::instruction::initialize_mint2(
        ctx.accounts.token_program.key,
        &ctx.accounts.mint.key(),
        &stablecoin.key(),     // mint authority = stablecoin PDA
        Some(&stablecoin.key()), // freeze authority = stablecoin PDA
        params.decimals,
    )?;
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[ctx.accounts.mint.to_account_info()],
    )?;

    // ─── Initialize Metadata ─────────────────────────────────────────
    let signer_seeds: &[&[u8]] = &[
        STABLECOIN_SEED,
        ctx.accounts.mint.key.as_ref(),
        &[bump],
    ];

    let ix = spl_token_metadata_interface::instruction::initialize(
        ctx.accounts.token_program.key,
        &ctx.accounts.mint.key(),
        &stablecoin.key(),
        &ctx.accounts.mint.key(),
        &stablecoin.key(),
        params.name.clone(),
        params.symbol.clone(),
        params.uri.clone(),
    );
    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.mint.to_account_info(),
            stablecoin.to_account_info(),
        ],
        &[signer_seeds],
    )?;

    // ─── Set stablecoin state ────────────────────────────────────────
    stablecoin.authority = ctx.accounts.authority.key();
    stablecoin.mint = ctx.accounts.mint.key();
    stablecoin.name = params.name.clone();
    stablecoin.symbol = params.symbol.clone();
    stablecoin.uri = params.uri;
    stablecoin.decimals = params.decimals;
    stablecoin.features = features;
    stablecoin.is_paused = false;
    stablecoin.total_minted = 0;
    stablecoin.total_burned = 0;
    stablecoin.supply_cap = params.supply_cap;
    stablecoin.transfer_hook_program = params.transfer_hook_program.unwrap_or_default();
    stablecoin.bump = bump;
    stablecoin.version = 1;
    stablecoin._reserved = [0u8; 64];

    // ─── Create master role ──────────────────────────────────────────
    let master_role = &mut ctx.accounts.master_role;
    master_role.stablecoin = stablecoin.key();
    master_role.holder = ctx.accounts.authority.key();
    master_role.role_type = 0; // Master
    master_role.is_active = true;
    master_role.granted_at = clock.unix_timestamp;
    master_role.granted_by = ctx.accounts.authority.key();
    master_role.bump = ctx.bumps.master_role;

    // ─── Emit event ──────────────────────────────────────────────────
    emit!(StablecoinInitialized {
        mint: ctx.accounts.mint.key(),
        authority: ctx.accounts.authority.key(),
        name: params.name,
        symbol: params.symbol,
        decimals: params.decimals,
        features,
        supply_cap: params.supply_cap,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
