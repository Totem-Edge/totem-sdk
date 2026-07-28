/**
 * RootIdentityWallet — backward-compatibility re-export.
 *
 * The implementation has moved to UnifiedIdentityWallet which uses genuine
 * hierarchical key derivation (root_priv_seed → child_seed_i).
 *
 * All existing call sites should be updated to import UnifiedIdentityWallet
 * directly. This shim is kept only to avoid hard import errors during migration.
 */
export { UnifiedIdentityWallet as RootIdentityWallet, MAX_CHILD_COUNT } from './UnifiedIdentityWallet.js';
