/**
 * @totemsdk/qvac/plugins — Plugin domain adapter (invokePlugin / invokePluginStream).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { InvokePluginOptions } from '@qvac/sdk';

export const pluginsDomain = 'plugins' as const;

export type { InvokePluginOptions } from '@qvac/sdk';

export interface QvacPluginsOps {
  invokePlugin: QvacOp<InvokePluginOptions, unknown>;
  invokePluginStream: QvacOp<InvokePluginOptions, unknown>;
}

export function pluginsAdapter(provider: IntelligenceProvider): QvacPluginsOps {
  return {
    invokePlugin: bindDomain(provider, pluginsDomain, 'invokePlugin'),
    invokePluginStream: bindDomain(provider, pluginsDomain, 'invokePluginStream'),
  };
}