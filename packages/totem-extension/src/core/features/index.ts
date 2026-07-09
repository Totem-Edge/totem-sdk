/**
 * @module features
 * Feature flag and migration safety infrastructure
 */

export {
  featureFlags,
  withInitModeSwitch,
  useFeatureFlags,
  type WalletInitMode,
  type FeatureFlagConfig,
  type InitTelemetryEvent,
} from './FeatureFlags';
