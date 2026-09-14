/**
 * @totemsdk/qvac/plugins — Plugin domain adapter (invokePlugin / invokePluginStream).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const pluginsDomain = 'plugins' as const;

export interface InvokePluginParams {
  plugin?: string;
  args?: unknown;
}

export interface QvacPluginsOps {
  invokePlugin: QvacOp<InvokePluginParams, { plugin?: string; ok?: boolean }>;
  invokePluginStream: QvacOp<InvokePluginParams, unknown>;
}

export function pluginsAdapter(provider: IntelligenceProvider): QvacPluginsOps {
  return {
    invokePlugin: bindDomain(provider, pluginsDomain, 'invokePlugin'),
    invokePluginStream: bindDomain(provider, pluginsDomain, 'invokePluginStream'),
  };
}