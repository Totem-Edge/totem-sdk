import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', 'e5f'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', '220'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', 'a74'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '683'),
            routes: [
              {
                path: '/api/',
                component: ComponentCreator('/api/', '10f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/axia-totem-dex/',
                component: ComponentCreator('/api/axia-totem-dex/', 'f75'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/axia-totem-dex/classes/AxiaDex',
                component: ComponentCreator('/api/axia-totem-dex/classes/AxiaDex', 'e1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/axia-totem-dex/type-aliases/DexConfig',
                component: ComponentCreator('/api/axia-totem-dex/type-aliases/DexConfig', '3f5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/axia-totem-dex/type-aliases/QuoteReq',
                component: ComponentCreator('/api/axia-totem-dex/type-aliases/QuoteReq', 'c17'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/axia-totem-dex/type-aliases/QuoteResp',
                component: ComponentCreator('/api/axia-totem-dex/type-aliases/QuoteResp', '078'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/',
                component: ComponentCreator('/api/totem-extension-keyring/', 'de6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/functions/computeManifestBlobHash',
                component: ComponentCreator('/api/totem-extension-keyring/functions/computeManifestBlobHash', '0f9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/functions/normalizeAddrToHex',
                component: ComponentCreator('/api/totem-extension-keyring/functions/normalizeAddrToHex', '86f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/type-aliases/SignDataManifest',
                component: ComponentCreator('/api/totem-extension-keyring/type-aliases/SignDataManifest', '547'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/type-aliases/SignDataManifestInput',
                component: ComponentCreator('/api/totem-extension-keyring/type-aliases/SignDataManifestInput', 'c6a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/type-aliases/SignDataValidationError',
                component: ComponentCreator('/api/totem-extension-keyring/type-aliases/SignDataValidationError', '466'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/type-aliases/SignDataValidationOk',
                component: ComponentCreator('/api/totem-extension-keyring/type-aliases/SignDataValidationOk', '5d1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-extension-keyring/type-aliases/SignDataValidationResult',
                component: ComponentCreator('/api/totem-extension-keyring/type-aliases/SignDataValidationResult', '51d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-observability/',
                component: ComponentCreator('/api/totem-observability/', '447'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/',
                component: ComponentCreator('/api/totem-sdk-browser/', 'e15'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/BrowserConfigProvider',
                component: ComponentCreator('/api/totem-sdk-browser/classes/BrowserConfigProvider', 'ebd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/BrowserCryptoAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/classes/BrowserCryptoAdapter', '90d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/BrowserWebSocketFactory',
                component: ComponentCreator('/api/totem-sdk-browser/classes/BrowserWebSocketFactory', '547'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/ChromeExtensionLifecycleAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/classes/ChromeExtensionLifecycleAdapter', '342'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/ChromeStorageAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/classes/ChromeStorageAdapter', 'a1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/ConsoleLogger',
                component: ComponentCreator('/api/totem-sdk-browser/classes/ConsoleLogger', '93e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/DefaultTimerAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/classes/DefaultTimerAdapter', '9d3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/FetchHttpClient',
                component: ComponentCreator('/api/totem-sdk-browser/classes/FetchHttpClient', '282'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/InMemoryAuthProvider',
                component: ComponentCreator('/api/totem-sdk-browser/classes/InMemoryAuthProvider', '9be'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/InMemoryStorageAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/classes/InMemoryStorageAdapter', '69e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/LocalStorageAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/classes/LocalStorageAdapter', '13e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/NoopLogger',
                component: ComponentCreator('/api/totem-sdk-browser/classes/NoopLogger', '837'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/NoopMetrics',
                component: ComponentCreator('/api/totem-sdk-browser/classes/NoopMetrics', '25b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/PageVisibilityLifecycleAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/classes/PageVisibilityLifecycleAdapter', '7ab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/classes/StorageAuthProvider',
                component: ComponentCreator('/api/totem-sdk-browser/classes/StorageAuthProvider', 'f57'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/functions/createAuthedHttpClient',
                component: ComponentCreator('/api/totem-sdk-browser/functions/createAuthedHttpClient', '8d7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/functions/createBrowserAdapters',
                component: ComponentCreator('/api/totem-sdk-browser/functions/createBrowserAdapters', '870'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/functions/createChromeExtensionAdapters',
                component: ComponentCreator('/api/totem-sdk-browser/functions/createChromeExtensionAdapters', '184'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/functions/createConfigFromEnv',
                component: ComponentCreator('/api/totem-sdk-browser/functions/createConfigFromEnv', '1ea'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/functions/createLifecycleAdapter',
                component: ComponentCreator('/api/totem-sdk-browser/functions/createLifecycleAdapter', 'bd5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/functions/isSubtleCryptoAvailable',
                component: ComponentCreator('/api/totem-sdk-browser/functions/isSubtleCryptoAvailable', 'eaf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/interfaces/BrowserConfigOptions',
                component: ComponentCreator('/api/totem-sdk-browser/interfaces/BrowserConfigOptions', 'bc1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/interfaces/ChromeStorageAdapterOptions',
                component: ComponentCreator('/api/totem-sdk-browser/interfaces/ChromeStorageAdapterOptions', 'e65'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/interfaces/CreateBrowserAdaptersOptions',
                component: ComponentCreator('/api/totem-sdk-browser/interfaces/CreateBrowserAdaptersOptions', '410'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/interfaces/FetchHttpClientOptions',
                component: ComponentCreator('/api/totem-sdk-browser/interfaces/FetchHttpClientOptions', 'be0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/interfaces/LocalStorageAdapterOptions',
                component: ComponentCreator('/api/totem-sdk-browser/interfaces/LocalStorageAdapterOptions', 'd7d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totem-sdk-browser/interfaces/StorageAuthProviderOptions',
                component: ComponentCreator('/api/totem-sdk-browser/interfaces/StorageAuthProviderOptions', '000'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-agent-policy/',
                component: ComponentCreator('/api/totemsdk-agent-policy/', '540'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-agent-policy/interfaces/AgentIdentity',
                component: ComponentCreator('/api/totemsdk-agent-policy/interfaces/AgentIdentity', 'dbf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-agent-policy/interfaces/AgentPolicy',
                component: ComponentCreator('/api/totemsdk-agent-policy/interfaces/AgentPolicy', '7d1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-agent-policy/interfaces/AgentProposal',
                component: ComponentCreator('/api/totemsdk-agent-policy/interfaces/AgentProposal', '5ba'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-agent-policy/interfaces/AgentReceipt',
                component: ComponentCreator('/api/totemsdk-agent-policy/interfaces/AgentReceipt', 'ff4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-agent-policy/interfaces/PaymentIntent',
                component: ComponentCreator('/api/totemsdk-agent-policy/interfaces/PaymentIntent', 'f6d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/',
                component: ComponentCreator('/api/totemsdk-chain-provider/', 'f3a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/classes/CompositeProvider',
                component: ComponentCreator('/api/totemsdk-chain-provider/classes/CompositeProvider', '7e1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/classes/HostedProvider',
                component: ComponentCreator('/api/totemsdk-chain-provider/classes/HostedProvider', 'bf4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/classes/LookupNodeNotImplementedError',
                component: ComponentCreator('/api/totemsdk-chain-provider/classes/LookupNodeNotImplementedError', '1dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/classes/LookupNodeProvider',
                component: ComponentCreator('/api/totemsdk-chain-provider/classes/LookupNodeProvider', '3b1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/classes/PureMinimaRpcProvider',
                component: ComponentCreator('/api/totemsdk-chain-provider/classes/PureMinimaRpcProvider', '89d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/BroadcastResult',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/BroadcastResult', '593'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/ChainStateProvider',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/ChainStateProvider', '818'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/ChainTip',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/ChainTip', '031'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/Coin',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/Coin', '0a0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/CoinsQuery',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/CoinsQuery', '17e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/HostedProviderConfig',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/HostedProviderConfig', '757'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/MMRProof',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/MMRProof', '618'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/TokenInfo',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/TokenInfo', '5c1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-chain-provider/interfaces/TokenSearchQuery',
                component: ComponentCreator('/api/totemsdk-chain-provider/interfaces/TokenSearchQuery', '7cf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/',
                component: ComponentCreator('/api/totemsdk-connect/', '930'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/classes/TotemConnectionError',
                component: ComponentCreator('/api/totemsdk-connect/classes/TotemConnectionError', '2e2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/classes/TotemNotInstalledError',
                component: ComponentCreator('/api/totemsdk-connect/classes/TotemNotInstalledError', '94d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/agentCreateReceipt',
                component: ComponentCreator('/api/totemsdk-connect/functions/agentCreateReceipt', '6dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/agentExplainTransaction',
                component: ComponentCreator('/api/totemsdk-connect/functions/agentExplainTransaction', '9d3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/agentProposePayment',
                component: ComponentCreator('/api/totemsdk-connect/functions/agentProposePayment', 'ea5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/broadcastHex',
                component: ComponentCreator('/api/totemsdk-connect/functions/broadcastHex', 'ab5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/broadcastTxPoW',
                component: ComponentCreator('/api/totemsdk-connect/functions/broadcastTxPoW', 'd50'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/connect',
                component: ComponentCreator('/api/totemsdk-connect/functions/connect', '6b1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/createPaymentRequest',
                component: ComponentCreator('/api/totemsdk-connect/functions/createPaymentRequest', '431'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getAccounts',
                component: ComponentCreator('/api/totemsdk-connect/functions/getAccounts', 'b0b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getCapabilities',
                component: ComponentCreator('/api/totemsdk-connect/functions/getCapabilities', '92f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getCoins',
                component: ComponentCreator('/api/totemsdk-connect/functions/getCoins', '802'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getProvider',
                component: ComponentCreator('/api/totemsdk-connect/functions/getProvider', '2ab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getProviderStatus',
                component: ComponentCreator('/api/totemsdk-connect/functions/getProviderStatus', 'ded'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getReceipt',
                component: ComponentCreator('/api/totemsdk-connect/functions/getReceipt', 'b8f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getTransactionStatus',
                component: ComponentCreator('/api/totemsdk-connect/functions/getTransactionStatus', '7eb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getTxPermissions',
                component: ComponentCreator('/api/totemsdk-connect/functions/getTxPermissions', 'dc4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/getWotsStatus',
                component: ComponentCreator('/api/totemsdk-connect/functions/getWotsStatus', 'dd5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/grantTxPermission',
                component: ComponentCreator('/api/totemsdk-connect/functions/grantTxPermission', '43a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/isTotemInstalled',
                component: ComponentCreator('/api/totemsdk-connect/functions/isTotemInstalled', '113'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/kissvmSimulate',
                component: ComponentCreator('/api/totemsdk-connect/functions/kissvmSimulate', '4b1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/kissvmValidate',
                component: ComponentCreator('/api/totemsdk-connect/functions/kissvmValidate', '388'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/mineTxPoW',
                component: ComponentCreator('/api/totemsdk-connect/functions/mineTxPoW', 'a6a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaCloseChannel',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaCloseChannel', '16b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaCloseFactory',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaCloseFactory', '524'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaCreateFactory',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaCreateFactory', '81d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaGetChannels',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaGetChannels', '553'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaGetRoute',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaGetRoute', 'b1e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaGetSwapRate',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaGetSwapRate', '7c0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaOpenChannel',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaOpenChannel', 'a55'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaOpenVirtualChannel',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaOpenVirtualChannel', 'e8b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaPay',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaPay', '306'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaPayMultiHop',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaPayMultiHop', '0b7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaSettle',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaSettle', '91a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaSpliceIn',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaSpliceIn', '466'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/omniaSpliceOut',
                component: ComponentCreator('/api/totemsdk-connect/functions/omniaSpliceOut', 'ace'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/onEvent',
                component: ComponentCreator('/api/totemsdk-connect/functions/onEvent', 'a82'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/payPaymentRequest',
                component: ComponentCreator('/api/totemsdk-connect/functions/payPaymentRequest', '957'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/releaseWotsLease',
                component: ComponentCreator('/api/totemsdk-connect/functions/releaseWotsLease', 'd46'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/reserveWotsLease',
                component: ComponentCreator('/api/totemsdk-connect/functions/reserveWotsLease', 'ed7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/revokeTxPermission',
                component: ComponentCreator('/api/totemsdk-connect/functions/revokeTxPermission', '2b5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/sendComplex',
                component: ComponentCreator('/api/totemsdk-connect/functions/sendComplex', '91f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/sendTransaction',
                component: ComponentCreator('/api/totemsdk-connect/functions/sendTransaction', '123'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/setChainProvider',
                component: ComponentCreator('/api/totemsdk-connect/functions/setChainProvider', 'c28'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/signData',
                component: ComponentCreator('/api/totemsdk-connect/functions/signData', 'aff'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/signTransaction',
                component: ComponentCreator('/api/totemsdk-connect/functions/signTransaction', 'b4b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/statechainClaim',
                component: ComponentCreator('/api/totemsdk-connect/functions/statechainClaim', '343'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/statechainCreate',
                component: ComponentCreator('/api/totemsdk-connect/functions/statechainCreate', 'dd7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/statechainTransfer',
                component: ComponentCreator('/api/totemsdk-connect/functions/statechainTransfer', '976'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/statechainVerify',
                component: ComponentCreator('/api/totemsdk-connect/functions/statechainVerify', '54b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/functions/verify',
                component: ComponentCreator('/api/totemsdk-connect/functions/verify', 'd8a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/EnhancedBuildParams',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/EnhancedBuildParams', 'ae6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/InputCoinProof',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/InputCoinProof', '79d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/InputScriptDescriptor',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/InputScriptDescriptor', '10b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/KissvmCoinData',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/KissvmCoinData', '3c9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/KissvmOutputData',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/KissvmOutputData', '50f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/KissvmTxContext',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/KissvmTxContext', 'b80'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/KissvmWitness',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/KissvmWitness', '974'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/OmniaChannelSummary',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/OmniaChannelSummary', 'c90'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/ResponseScriptDescriptor',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/ResponseScriptDescriptor', '793'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/Route',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/Route', 'ec1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/RoutingHop',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/RoutingHop', 'f1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/SitePermissionEntry',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/SitePermissionEntry', '729'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/StatechainTransferEntry',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/StatechainTransferEntry', '3cc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/StateVariable',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/StateVariable', '6f4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/SwapAnnouncement',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/SwapAnnouncement', '003'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/SwapHop',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/SwapHop', 'bf6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TokenSpendingLimit',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TokenSpendingLimit', '316'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemAgentCreateReceiptRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemAgentCreateReceiptRequest', '952'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemAgentCreateReceiptResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemAgentCreateReceiptResponse', '187'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemAgentExplainTransactionRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemAgentExplainTransactionRequest', '4cf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemAgentExplainTransactionResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemAgentExplainTransactionResponse', 'ae3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemAgentProposePaymentRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemAgentProposePaymentRequest', 'c84'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemAgentProposePaymentResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemAgentProposePaymentResponse', '837'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemBroadcastHexErrorResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemBroadcastHexErrorResponse', '0e9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemBroadcastHexRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemBroadcastHexRequest', 'e33'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemBroadcastHexSuccessResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemBroadcastHexSuccessResponse', '409'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemBroadcastTxPoWRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemBroadcastTxPoWRequest', '4d9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemBroadcastTxPoWResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemBroadcastTxPoWResponse', 'c1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemCapabilities',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemCapabilities', '583'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemConnectRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemConnectRequest', 'd9e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemConnectResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemConnectResponse', '9d6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemCreatePaymentRequestRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemCreatePaymentRequestRequest', '765'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemCreatePaymentRequestResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemCreatePaymentRequestResponse', '3f0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetAccountsRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetAccountsRequest', 'd62'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetAccountsResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetAccountsResponse', 'f44'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetCapabilitiesRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetCapabilitiesRequest', 'a41'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetCoinsErrorResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetCoinsErrorResponse', '81c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetCoinsRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetCoinsRequest', 'e88'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetCoinsSuccessResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetCoinsSuccessResponse', '630'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetProviderStatusRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetProviderStatusRequest', '8b2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetReceiptRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetReceiptRequest', '698'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetReceiptResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetReceiptResponse', 'd05'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetTransactionStatusRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetTransactionStatusRequest', 'f0d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetTransactionStatusResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetTransactionStatusResponse', 'b0c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetTxPermissionsRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetTxPermissionsRequest', 'e04'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetWotsStatusRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetWotsStatusRequest', '856'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGetWotsStatusResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGetWotsStatusResponse', '3a5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGrantTxPermissionRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGrantTxPermissionRequest', '97b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemGrantTxPermissionResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemGrantTxPermissionResponse', '711'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemKissvmSimulateRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemKissvmSimulateRequest', 'ecf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemKissvmSimulateResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemKissvmSimulateResponse', '571'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemKissvmValidateRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemKissvmValidateRequest', '2bd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemKissvmValidateResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemKissvmValidateResponse', '5d7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemMineTxPoWRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemMineTxPoWRequest', '5e2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemMineTxPoWResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemMineTxPoWResponse', '83b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaCloseChannelRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaCloseChannelRequest', '81f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaCloseChannelResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaCloseChannelResponse', '1bc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaCloseFactoryRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaCloseFactoryRequest', 'c84'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaCloseFactoryResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaCloseFactoryResponse', 'ef0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaCreateFactoryRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaCreateFactoryRequest', 'e3e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaCreateFactoryResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaCreateFactoryResponse', '967'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaGetChannelsRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaGetChannelsRequest', '4d7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaGetChannelsResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaGetChannelsResponse', 'b29'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaGetRouteRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaGetRouteRequest', 'fd6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaGetRouteResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaGetRouteResponse', 'f58'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaGetSwapRateRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaGetSwapRateRequest', '1c5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaGetSwapRateResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaGetSwapRateResponse', '0cf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaOpenChannelRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaOpenChannelRequest', '13d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaOpenChannelResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaOpenChannelResponse', '680'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaOpenVirtualChannelRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaOpenVirtualChannelRequest', '633'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaOpenVirtualChannelResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaOpenVirtualChannelResponse', '4d4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaPayMultiHopRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaPayMultiHopRequest', 'a6d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaPayMultiHopResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaPayMultiHopResponse', '66f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaPayRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaPayRequest', '510'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaPayResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaPayResponse', 'cdc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaSettleRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaSettleRequest', '8c7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaSettleResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaSettleResponse', '2f8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaSpliceInRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaSpliceInRequest', '88a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaSpliceInResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaSpliceInResponse', 'ce3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaSpliceOutRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaSpliceOutRequest', '6f3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemOmniaSpliceOutResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemOmniaSpliceOutResponse', 'cf2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemPayPaymentRequestRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemPayPaymentRequestRequest', '923'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemPayPaymentRequestResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemPayPaymentRequestResponse', '803'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemProvider',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemProvider', '5b1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemProviderStatus',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemProviderStatus', 'ead'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemReleaseWotsLeaseRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemReleaseWotsLeaseRequest', '2cf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemReleaseWotsLeaseResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemReleaseWotsLeaseResponse', '07a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemRequest', '3ab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemReserveWotsLeaseRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemReserveWotsLeaseRequest', '953'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemReserveWotsLeaseResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemReserveWotsLeaseResponse', '53e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemRevokeTxPermissionRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemRevokeTxPermissionRequest', '312'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemRevokeTxPermissionResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemRevokeTxPermissionResponse', '280'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSendComplexBuildResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSendComplexBuildResponse', 'ad2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSendComplexErrorResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSendComplexErrorResponse', '82d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSendComplexRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSendComplexRequest', '7a2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSendComplexSubmitResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSendComplexSubmitResponse', '200'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSendTransactionErrorResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSendTransactionErrorResponse', '73b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSendTransactionRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSendTransactionRequest', '040'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSendTransactionSuccessResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSendTransactionSuccessResponse', 'fc2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSetChainProviderRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSetChainProviderRequest', 'e34'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSetChainProviderResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSetChainProviderResponse', 'dff'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSignDataErrorResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSignDataErrorResponse', '997'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSignDataRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSignDataRequest', '434'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSignDataSuccessResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSignDataSuccessResponse', '2bc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSignTransactionRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSignTransactionRequest', '54e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemSignTransactionResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemSignTransactionResponse', 'd2e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainClaimRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainClaimRequest', '8cf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainClaimResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainClaimResponse', 'c9f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainCreateRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainCreateRequest', 'a88'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainCreateResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainCreateResponse', 'e4e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainTransferRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainTransferRequest', 'f96'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainTransferResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainTransferResponse', '21b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainVerifyRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainVerifyRequest', '105'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemStatechainVerifyResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemStatechainVerifyResponse', '1d2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemVerifyRequest',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemVerifyRequest', 'f37'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TotemVerifyResponse',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TotemVerifyResponse', '662'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/interfaces/TransactionPlan',
                component: ComponentCreator('/api/totemsdk-connect/interfaces/TransactionPlan', '1f7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/DAppTransactionIntent',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/DAppTransactionIntent', '515'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/ScriptType',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/ScriptType', '273'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/StateVariableType',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/StateVariableType', 'ce7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemBroadcastHexResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemBroadcastHexResponse', '013'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemGetCapabilitiesResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemGetCapabilitiesResponse', '53b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemGetCoinsResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemGetCoinsResponse', '79a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemGetProviderStatusResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemGetProviderStatusResponse', '8c9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemGetTxPermissionsResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemGetTxPermissionsResponse', '7a8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemSendComplexResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemSendComplexResponse', '3c7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemSendTransactionResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemSendTransactionResponse', 'b33'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/type-aliases/TotemSignDataResponse',
                component: ComponentCreator('/api/totemsdk-connect/type-aliases/TotemSignDataResponse', '45a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-connect/variables/requestSignature',
                component: ComponentCreator('/api/totemsdk-connect/variables/requestSignature', '122'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/',
                component: ComponentCreator('/api/totemsdk-core/', '42f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/ConsoleLogger',
                component: ComponentCreator('/api/totemsdk-core/classes/ConsoleLogger', '2e5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/DefaultTimerAdapter',
                component: ComponentCreator('/api/totemsdk-core/classes/DefaultTimerAdapter', 'b65'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/ExchangeHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/ExchangeHelper', '4ab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/FlashCashHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/FlashCashHelper', '437'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/HTLCHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/HTLCHelper', 'a0a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/LeaseMonitor',
                component: ComponentCreator('/api/totemsdk-core/classes/LeaseMonitor', '7c7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/LeaseStore',
                component: ComponentCreator('/api/totemsdk-core/classes/LeaseStore', '77d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/MASTHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/MASTHelper', 'fcd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/MMRTree',
                component: ComponentCreator('/api/totemsdk-core/classes/MMRTree', 'f91'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/NoopLifecycleAdapter',
                component: ComponentCreator('/api/totemsdk-core/classes/NoopLifecycleAdapter', '2d7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/NoopLogger',
                component: ComponentCreator('/api/totemsdk-core/classes/NoopLogger', '58d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/NoopMetrics',
                component: ComponentCreator('/api/totemsdk-core/classes/NoopMetrics', '9e2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/SlowCashHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/SlowCashHelper', '3de'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/StatefulGameHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/StatefulGameHelper', 'bbc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/TimelockHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/TimelockHelper', '92e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/TransactionLifecycle',
                component: ComponentCreator('/api/totemsdk-core/classes/TransactionLifecycle', 'd8d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/TransactionLifecycleError',
                component: ComponentCreator('/api/totemsdk-core/classes/TransactionLifecycleError', '973'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/TransactionReceiptStore',
                component: ComponentCreator('/api/totemsdk-core/classes/TransactionReceiptStore', '7e5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/TransactionService',
                component: ComponentCreator('/api/totemsdk-core/classes/TransactionService', '267'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/TreeKey',
                component: ComponentCreator('/api/totemsdk-core/classes/TreeKey', '5d8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/TreeKeyNode',
                component: ComponentCreator('/api/totemsdk-core/classes/TreeKeyNode', '3fb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/VaultHelper',
                component: ComponentCreator('/api/totemsdk-core/classes/VaultHelper', 'c78'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/WatermarkExhaustedError',
                component: ComponentCreator('/api/totemsdk-core/classes/WatermarkExhaustedError', '89e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/classes/WatermarkStore',
                component: ComponentCreator('/api/totemsdk-core/classes/WatermarkStore', 'cad'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/addressToRoot',
                component: ComponentCreator('/api/totemsdk-core/functions/addressToRoot', '1f2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/aggregateSignatures',
                component: ComponentCreator('/api/totemsdk-core/functions/aggregateSignatures', 'c6f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/assert32',
                component: ComponentCreator('/api/totemsdk-core/functions/assert32', 'e04'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/baseWWithChecksum',
                component: ComponentCreator('/api/totemsdk-core/functions/baseWWithChecksum', '55e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/bigIntToByteArray',
                component: ComponentCreator('/api/totemsdk-core/functions/bigIntToByteArray', '5e8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/buildMinimaCoin',
                component: ComponentCreator('/api/totemsdk-core/functions/buildMinimaCoin', 'dc2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/buildScriptProofFromDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/buildScriptProofFromDescriptor', '6db'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/bytesToHex',
                component: ComponentCreator('/api/totemsdk-core/functions/bytesToHex', 'ffd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/bytesToUtf8',
                component: ComponentCreator('/api/totemsdk-core/functions/bytesToUtf8', '560'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/calculateProofRoot',
                component: ComponentCreator('/api/totemsdk-core/functions/calculateProofRoot', '33c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/cleanSeedPhrase',
                component: ComponentCreator('/api/totemsdk-core/functions/cleanSeedPhrase', '5c3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/computeScriptAddress',
                component: ComponentCreator('/api/totemsdk-core/functions/computeScriptAddress', '848'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/computeTransactionDigest',
                component: ComponentCreator('/api/totemsdk-core/functions/computeTransactionDigest', 'f33'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/concat',
                component: ComponentCreator('/api/totemsdk-core/functions/concat', '6f1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/concatBytes',
                component: ComponentCreator('/api/totemsdk-core/functions/concatBytes', 'b45'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/convertFlatChunkToSDK',
                component: ComponentCreator('/api/totemsdk-core/functions/convertFlatChunkToSDK', '1e0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/convertLegacyProofToSDK',
                component: ComponentCreator('/api/totemsdk-core/functions/convertLegacyProofToSDK', 'd6a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/convertStringToSeed',
                component: ComponentCreator('/api/totemsdk-core/functions/convertStringToSeed', '628'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/convertWordListToSeed',
                component: ComponentCreator('/api/totemsdk-core/functions/convertWordListToSeed', '905'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createAdapterRegistry',
                component: ComponentCreator('/api/totemsdk-core/functions/createAdapterRegistry', 'edb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createCancellationToken',
                component: ComponentCreator('/api/totemsdk-core/functions/createCancellationToken', 'dcd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createChallenge',
                component: ComponentCreator('/api/totemsdk-core/functions/createChallenge', '911'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createDefaultTransaction',
                component: ComponentCreator('/api/totemsdk-core/functions/createDefaultTransaction', 'eb8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createEmptyMMRProof',
                component: ComponentCreator('/api/totemsdk-core/functions/createEmptyMMRProof', '5cd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createExchangeDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createExchangeDescriptor', '67d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createFlashCashDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createFlashCashDescriptor', 'ea3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createHTLCDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createHTLCDescriptor', '177'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createMASTDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createMASTDescriptor', '2b1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createMMRDataLeafNode',
                component: ComponentCreator('/api/totemsdk-core/functions/createMMRDataLeafNode', 'b7f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createMMRDataParentNode',
                component: ComponentCreator('/api/totemsdk-core/functions/createMMRDataParentNode', 'c42'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-core/functions/createMMREntryNumber', 'e48'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createMofNMultisigDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createMofNMultisigDescriptor', '523'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createMultisigDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createMultisigDescriptor', 'b5a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createPerAddressTreeKey',
                component: ComponentCreator('/api/totemsdk-core/functions/createPerAddressTreeKey', '653'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createPerAddressTreeKeyAsync',
                component: ComponentCreator('/api/totemsdk-core/functions/createPerAddressTreeKeyAsync', '9f8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createSignedByDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createSignedByDescriptor', '52d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createSlowCashDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createSlowCashDescriptor', 'df2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/createTimelockDescriptor',
                component: ComponentCreator('/api/totemsdk-core/functions/createTimelockDescriptor', 'd2c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/decodeMxRadix32Frame',
                component: ComponentCreator('/api/totemsdk-core/functions/decodeMxRadix32Frame', 'c9a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/deduplicateScriptDescriptors',
                component: ComponentCreator('/api/totemsdk-core/functions/deduplicateScriptDescriptors', 'ed2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/deriveAddressFromPublicKey',
                component: ComponentCreator('/api/totemsdk-core/functions/deriveAddressFromPublicKey', '2a2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/deriveAddressPublicKey',
                component: ComponentCreator('/api/totemsdk-core/functions/deriveAddressPublicKey', 'a0d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/deriveChainSeedJava',
                component: ComponentCreator('/api/totemsdk-core/functions/deriveChainSeedJava', 'c5e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/deriveChildTreeSeedJava',
                component: ComponentCreator('/api/totemsdk-core/functions/deriveChildTreeSeedJava', 'f00'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/derivePerAddressSeed',
                component: ComponentCreator('/api/totemsdk-core/functions/derivePerAddressSeed', '631'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/derivePKdigest',
                component: ComponentCreator('/api/totemsdk-core/functions/derivePKdigest', 'f1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/deserializeTreeSignature',
                component: ComponentCreator('/api/totemsdk-core/functions/deserializeTreeSignature', '8e6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/encodeMiniData',
                component: ComponentCreator('/api/totemsdk-core/functions/encodeMiniData', '7ff'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/encodeMiniNumber',
                component: ComponentCreator('/api/totemsdk-core/functions/encodeMiniNumber', 'a4c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/encodeMiniString',
                component: ComponentCreator('/api/totemsdk-core/functions/encodeMiniString', '51a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/encodeMxRadix32Frame',
                component: ComponentCreator('/api/totemsdk-core/functions/encodeMxRadix32Frame', 'ebf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/encodeStateValue',
                component: ComponentCreator('/api/totemsdk-core/functions/encodeStateValue', 'fe1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/F',
                component: ComponentCreator('/api/totemsdk-core/functions/F', '669'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/finalizeLease',
                component: ComponentCreator('/api/totemsdk-core/functions/finalizeLease', '73a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/flatIndexFromLanes',
                component: ComponentCreator('/api/totemsdk-core/functions/flatIndexFromLanes', 'fbb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/fromHex',
                component: ComponentCreator('/api/totemsdk-core/functions/fromHex', '469'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/generateSeedPhrase',
                component: ComponentCreator('/api/totemsdk-core/functions/generateSeedPhrase', '1f9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/generateWordList',
                component: ComponentCreator('/api/totemsdk-core/functions/generateWordList', 'c1d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/getParamSet',
                component: ComponentCreator('/api/totemsdk-core/functions/getParamSet', 'd6d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/getPerAddressPublicKey',
                component: ComponentCreator('/api/totemsdk-core/functions/getPerAddressPublicKey', 'dd1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/getRootPublicKey',
                component: ComponentCreator('/api/totemsdk-core/functions/getRootPublicKey', '1e3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/hashAllObjects',
                component: ComponentCreator('/api/totemsdk-core/functions/hashAllObjects', 'c1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/hashObject',
                component: ComponentCreator('/api/totemsdk-core/functions/hashObject', '0c8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/hex',
                component: ComponentCreator('/api/totemsdk-core/functions/hex', 'd35'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/hexToBytes',
                component: ComponentCreator('/api/totemsdk-core/functions/hexToBytes', '738'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/hexToMx',
                component: ComponentCreator('/api/totemsdk-core/functions/hexToMx', '95a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/indexToMiniDataBytes',
                component: ComponentCreator('/api/totemsdk-core/functions/indexToMiniDataBytes', 'acc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/javaHashAllObjects',
                component: ComponentCreator('/api/totemsdk-core/functions/javaHashAllObjects', 'f54'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/makeMxAddress',
                component: ComponentCreator('/api/totemsdk-core/functions/makeMxAddress', '514'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/mmrLeafExact',
                component: ComponentCreator('/api/totemsdk-core/functions/mmrLeafExact', 'fcd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/mmrRootFromSingleLeaf',
                component: ComponentCreator('/api/totemsdk-core/functions/mmrRootFromSingleLeaf', 'b46'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/mxToHex',
                component: ComponentCreator('/api/totemsdk-core/functions/mxToHex', '79a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/normalizeHex',
                component: ComponentCreator('/api/totemsdk-core/functions/normalizeHex', '8ec'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/parseDecimalToMiniNumber',
                component: ComponentCreator('/api/totemsdk-core/functions/parseDecimalToMiniNumber', 'cb5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/parseMMRProofFromHex',
                component: ComponentCreator('/api/totemsdk-core/functions/parseMMRProofFromHex', '7f4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/parseMxAddress',
                component: ComponentCreator('/api/totemsdk-core/functions/parseMxAddress', 'f1a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/phraseToSeed',
                component: ComponentCreator('/api/totemsdk-core/functions/phraseToSeed', 'b84'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/precomputeTransactionCoinID',
                component: ComponentCreator('/api/totemsdk-core/functions/precomputeTransactionCoinID', '8fe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/precomputeTransactionCoinIDTx',
                component: ComponentCreator('/api/totemsdk-core/functions/precomputeTransactionCoinIDTx', '600'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/prepareLease',
                component: ComponentCreator('/api/totemsdk-core/functions/prepareLease', 'c19'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/prfChainSeed',
                component: ComponentCreator('/api/totemsdk-core/functions/prfChainSeed', '33b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/scriptFromWotsPk',
                component: ComponentCreator('/api/totemsdk-core/functions/scriptFromWotsPk', '480'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/scriptToAddress',
                component: ComponentCreator('/api/totemsdk-core/functions/scriptToAddress', 'ffb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeCoin',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeCoin', '9dd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeExtraScripts',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeExtraScripts', '07c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMiniData',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMiniData', '585'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMiniNumber',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMiniNumber', 'fa5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMiniNumberONE',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMiniNumberONE', 'abf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMiniNumberZERO',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMiniNumberZERO', '003'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMMRData',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMMRData', '214'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMMREntry',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMMREntry', '30b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMMREntryNumber', '686'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMMRProof',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMMRProof', '66f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeMMRProofChunk',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeMMRProofChunk', '9fc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeScriptProofWithProof',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeScriptProofWithProof', '6a2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeStateVariables',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeStateVariables', '71a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeTransaction',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeTransaction', 'ad1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/serializeTreeSignature',
                component: ComponentCreator('/api/totemsdk-core/functions/serializeTreeSignature', '038'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/simpleTotemSendRequest',
                component: ComponentCreator('/api/totemsdk-core/functions/simpleTotemSendRequest', '307'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/toWinternitzDigits',
                component: ComponentCreator('/api/totemsdk-core/functions/toWinternitzDigits', 'f3d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/u16be',
                component: ComponentCreator('/api/totemsdk-core/functions/u16be', '9a7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/u32be',
                component: ComponentCreator('/api/totemsdk-core/functions/u32be', '231'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/utf8ToBytes',
                component: ComponentCreator('/api/totemsdk-core/functions/utf8ToBytes', '65c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/validateChallenge',
                component: ComponentCreator('/api/totemsdk-core/functions/validateChallenge', '991'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/validateExternalSignature',
                component: ComponentCreator('/api/totemsdk-core/functions/validateExternalSignature', '4ba'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/validatePhrase',
                component: ComponentCreator('/api/totemsdk-core/functions/validatePhrase', 'bed'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/validateSendTransactionRequest',
                component: ComponentCreator('/api/totemsdk-core/functions/validateSendTransactionRequest', '386'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/verifyMMRProof',
                component: ComponentCreator('/api/totemsdk-core/functions/verifyMMRProof', 'a39'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/verifySignature',
                component: ComponentCreator('/api/totemsdk-core/functions/verifySignature', '703'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/verifySignatureDetailed',
                component: ComponentCreator('/api/totemsdk-core/functions/verifySignatureDetailed', '749'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/verifyTreeSignature',
                component: ComponentCreator('/api/totemsdk-core/functions/verifyTreeSignature', '4b2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/verifyTreeSignatureDetailed',
                component: ComponentCreator('/api/totemsdk-core/functions/verifyTreeSignatureDetailed', '112'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsAddressFromKeypair',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsAddressFromKeypair', '335'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsKeypairFromSeed',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsKeypairFromSeed', '9d1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsPkFromSig',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsPkFromSig', '9af'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsPublicKeyFromSeed',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsPublicKeyFromSeed', '82a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsSign',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsSign', 'afe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsSignLegacy',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsSignLegacy', '6b2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsVerify',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsVerify', 'd07'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/wotsVerifyDigest',
                component: ComponentCreator('/api/totemsdk-core/functions/wotsVerifyDigest', '7a6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/writeHashToStream',
                component: ComponentCreator('/api/totemsdk-core/functions/writeHashToStream', '0d0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/writeMiniByte',
                component: ComponentCreator('/api/totemsdk-core/functions/writeMiniByte', 'cb3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/writeMiniData',
                component: ComponentCreator('/api/totemsdk-core/functions/writeMiniData', '904'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/writeMiniNumber',
                component: ComponentCreator('/api/totemsdk-core/functions/writeMiniNumber', '334'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/writeMiniString',
                component: ComponentCreator('/api/totemsdk-core/functions/writeMiniString', '494'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/functions/writeMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-core/functions/writeMMREntryNumber', 'dc0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/AdapterRegistry',
                component: ComponentCreator('/api/totemsdk-core/interfaces/AdapterRegistry', 'c8e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/AuthTokenProvider',
                component: ComponentCreator('/api/totemsdk-core/interfaces/AuthTokenProvider', '224'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/CancellationToken',
                component: ComponentCreator('/api/totemsdk-core/interfaces/CancellationToken', '609'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/CancellationTokenSource',
                component: ComponentCreator('/api/totemsdk-core/interfaces/CancellationTokenSource', 'cd6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/CoinProofData',
                component: ComponentCreator('/api/totemsdk-core/interfaces/CoinProofData', 'ea9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/ConfigProvider',
                component: ComponentCreator('/api/totemsdk-core/interfaces/ConfigProvider', 'cbc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/CryptoAdapter',
                component: ComponentCreator('/api/totemsdk-core/interfaces/CryptoAdapter', '51d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppContractCallParams',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppContractCallParams', '37e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppHtlcParams',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppHtlcParams', '2e4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppLiquidityParams',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppLiquidityParams', '852'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppMultisigParams',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppMultisigParams', '03d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppStateVariable',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppStateVariable', '53e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppSwapParams',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppSwapParams', 'ccc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppTimelockParams',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppTimelockParams', '202'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppTransactionInput',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppTransactionInput', '329'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/DAppTransactionOutput',
                component: ComponentCreator('/api/totemsdk-core/interfaces/DAppTransactionOutput', 'a25'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/ExternalSignature',
                component: ComponentCreator('/api/totemsdk-core/interfaces/ExternalSignature', '6c1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/FinalizeRequest',
                component: ComponentCreator('/api/totemsdk-core/interfaces/FinalizeRequest', '301'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/FinalizeResponse',
                component: ComponentCreator('/api/totemsdk-core/interfaces/FinalizeResponse', '973'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/FlatMMRProofChunk',
                component: ComponentCreator('/api/totemsdk-core/interfaces/FlatMMRProofChunk', '91a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/HierarchicalWitnessBundle',
                component: ComponentCreator('/api/totemsdk-core/interfaces/HierarchicalWitnessBundle', '8e3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/HttpClient',
                component: ComponentCreator('/api/totemsdk-core/interfaces/HttpClient', '1cd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/HttpRequestOptions',
                component: ComponentCreator('/api/totemsdk-core/interfaces/HttpRequestOptions', '547'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/HttpResponse',
                component: ComponentCreator('/api/totemsdk-core/interfaces/HttpResponse', '83a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/JavaMMRData',
                component: ComponentCreator('/api/totemsdk-core/interfaces/JavaMMRData', '1a5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/JavaMMREntry',
                component: ComponentCreator('/api/totemsdk-core/interfaces/JavaMMREntry', 'fbe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/JavaMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-core/interfaces/JavaMMREntryNumber', '90d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/KeyGenProgress',
                component: ComponentCreator('/api/totemsdk-core/interfaces/KeyGenProgress', '50e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/LeaseExpiryEvent',
                component: ComponentCreator('/api/totemsdk-core/interfaces/LeaseExpiryEvent', '065'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/LeaseMonitorConfig',
                component: ComponentCreator('/api/totemsdk-core/interfaces/LeaseMonitorConfig', '7b6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/LeaseStoreConfig',
                component: ComponentCreator('/api/totemsdk-core/interfaces/LeaseStoreConfig', 'e9a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/LeaseWotsIndices',
                component: ComponentCreator('/api/totemsdk-core/interfaces/LeaseWotsIndices', 'a10'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/LegacyMMRProof',
                component: ComponentCreator('/api/totemsdk-core/interfaces/LegacyMMRProof', '4e0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/LifecycleAdapter',
                component: ComponentCreator('/api/totemsdk-core/interfaces/LifecycleAdapter', '9a4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/LoggerAdapter',
                component: ComponentCreator('/api/totemsdk-core/interfaces/LoggerAdapter', 'efb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MetricsAdapter',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MetricsAdapter', 'd86'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MinimaCoin',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MinimaCoin', '7ce'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MinimaToken',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MinimaToken', '782'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MinimaTransaction',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MinimaTransaction', '651'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MMRData',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MMRData', '0dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MMREntry',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MMREntry', '2d7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MMRProof',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MMRProof', '14c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/MMRProofChunk',
                component: ComponentCreator('/api/totemsdk-core/interfaces/MMRProofChunk', '4ac'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/ParsedMiniNumber',
                component: ComponentCreator('/api/totemsdk-core/interfaces/ParsedMiniNumber', '835'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/PrepareRequest',
                component: ComponentCreator('/api/totemsdk-core/interfaces/PrepareRequest', '9c9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/PrepareResponse',
                component: ComponentCreator('/api/totemsdk-core/interfaces/PrepareResponse', 'eae'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/PrepareResult',
                component: ComponentCreator('/api/totemsdk-core/interfaces/PrepareResult', '329'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/RawStateVariable',
                component: ComponentCreator('/api/totemsdk-core/interfaces/RawStateVariable', 'b04'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/ScriptCatalogEntry',
                component: ComponentCreator('/api/totemsdk-core/interfaces/ScriptCatalogEntry', 'b9d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/ScriptDescriptor',
                component: ComponentCreator('/api/totemsdk-core/interfaces/ScriptDescriptor', 'dec'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/ScriptProofResult',
                component: ComponentCreator('/api/totemsdk-core/interfaces/ScriptProofResult', 'aed'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/SignatureProof',
                component: ComponentCreator('/api/totemsdk-core/interfaces/SignatureProof', '4da'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/SignRequest',
                component: ComponentCreator('/api/totemsdk-core/interfaces/SignRequest', '627'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/SignResult',
                component: ComponentCreator('/api/totemsdk-core/interfaces/SignResult', 'a67'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/SiteTransactionPermission',
                component: ComponentCreator('/api/totemsdk-core/interfaces/SiteTransactionPermission', 'd1b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/SpendableCoinInput',
                component: ComponentCreator('/api/totemsdk-core/interfaces/SpendableCoinInput', '27b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/StateValue',
                component: ComponentCreator('/api/totemsdk-core/interfaces/StateValue', '457'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/StateVariable',
                component: ComponentCreator('/api/totemsdk-core/interfaces/StateVariable', 'a09'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/StorageAdapter',
                component: ComponentCreator('/api/totemsdk-core/interfaces/StorageAdapter', 'cad'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/StoredLease',
                component: ComponentCreator('/api/totemsdk-core/interfaces/StoredLease', '761'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/SyncResult',
                component: ComponentCreator('/api/totemsdk-core/interfaces/SyncResult', '16b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TimerAdapter',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TimerAdapter', '811'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TotemSendTransactionRequest',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TotemSendTransactionRequest', '45d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TotemSendTransactionResponse',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TotemSendTransactionResponse', 'e5b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionBuildResult',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionBuildResult', '09c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionError',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionError', '696'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionLifecycleConfig',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionLifecycleConfig', '010'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionMetadata',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionMetadata', '726'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionReceipt',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionReceipt', '0aa'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionReceiptStoreConfig',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionReceiptStoreConfig', 'c73'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionRoundState',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionRoundState', '1a4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionScope',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionScope', '6be'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TransactionServiceConfig',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TransactionServiceConfig', '431'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/TreeSignature',
                component: ComponentCreator('/api/totemsdk-core/interfaces/TreeSignature', '204'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/VerificationResult',
                component: ComponentCreator('/api/totemsdk-core/interfaces/VerificationResult', '89e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/VerifyOutExpectation',
                component: ComponentCreator('/api/totemsdk-core/interfaces/VerifyOutExpectation', '851'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WatermarkState',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WatermarkState', 'bce'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WatermarkStoreConfig',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WatermarkStoreConfig', '55f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WatermarkSyncFunction',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WatermarkSyncFunction', '18f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WebSocketClient',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WebSocketClient', '01c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WebSocketCloseEvent',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WebSocketCloseEvent', '512'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WebSocketErrorEvent',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WebSocketErrorEvent', '537'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WebSocketFactory',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WebSocketFactory', '512'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WebSocketFactoryOptions',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WebSocketFactoryOptions', 'd58'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WebSocketMessageEvent',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WebSocketMessageEvent', '084'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WebSocketOpenEvent',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WebSocketOpenEvent', '31a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WitnessBundle',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WitnessBundle', '48b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WotsIndices',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WotsIndices', 'c81'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/interfaces/WotsSigningDependencies',
                component: ComponentCreator('/api/totemsdk-core/interfaces/WotsSigningDependencies', '7f1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/BinaryData',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/BinaryData', 'f36'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/Bytes',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/Bytes', 'c7f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/DAppTransactionIntent',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/DAppTransactionIntent', '376'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/LeaseExpiryCallback',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/LeaseExpiryCallback', 'e3e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/LeaseStatus',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/LeaseStatus', '211'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/ParamSet',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/ParamSet', '6e3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/PrepareArgs',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/PrepareArgs', '2a7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/PrepareResp',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/PrepareResp', 'b6f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/ProgressCallback',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/ProgressCallback', 'b21'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/ScriptType',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/ScriptType', 'f3c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/StateVariableType',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/StateVariableType', '2da'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/TimerHandle',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/TimerHandle', '4d1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/TotemTransactionErrorCode',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/TotemTransactionErrorCode', '595'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/WebSocketEventMap',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/WebSocketEventMap', '852'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/WotsKeypair',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/WotsKeypair', 'fc6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/type-aliases/WotsSignature',
                component: ComponentCreator('/api/totemsdk-core/type-aliases/WotsSignature', 'a46'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/convertMinimaAddress',
                component: ComponentCreator('/api/totemsdk-core/variables/convertMinimaAddress', 'cfd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/CORE_BUILD_ID',
                component: ComponentCreator('/api/totemsdk-core/variables/CORE_BUILD_ID', '8a8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/CORE_VERSION',
                component: ComponentCreator('/api/totemsdk-core/variables/CORE_VERSION', '9f7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/decodeMx',
                component: ComponentCreator('/api/totemsdk-core/variables/decodeMx', '81b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/DEFAULT_KEYS_PER_LEVEL',
                component: ComponentCreator('/api/totemsdk-core/variables/DEFAULT_KEYS_PER_LEVEL', 'abb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/DEFAULT_LEVELS',
                component: ComponentCreator('/api/totemsdk-core/variables/DEFAULT_LEVELS', '924'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/deserializeMMRProof',
                component: ComponentCreator('/api/totemsdk-core/variables/deserializeMMRProof', 'f9b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/encodeMx',
                component: ComponentCreator('/api/totemsdk-core/variables/encodeMx', '81f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/h',
                component: ComponentCreator('/api/totemsdk-core/variables/h', 'b61'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/makeMinimaAddress',
                component: ComponentCreator('/api/totemsdk-core/variables/makeMinimaAddress', '9ee'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/MINIMA_CONSTANTS',
                component: ComponentCreator('/api/totemsdk-core/variables/MINIMA_CONSTANTS', '3f4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/serializeRealMMRProof',
                component: ComponentCreator('/api/totemsdk-core/variables/serializeRealMMRProof', '0bd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/STATETYPE_BOOL',
                component: ComponentCreator('/api/totemsdk-core/variables/STATETYPE_BOOL', '4ed'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/STATETYPE_HEX',
                component: ComponentCreator('/api/totemsdk-core/variables/STATETYPE_HEX', '6c4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/STATETYPE_NUMBER',
                component: ComponentCreator('/api/totemsdk-core/variables/STATETYPE_NUMBER', 'af5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/STATETYPE_STRING',
                component: ComponentCreator('/api/totemsdk-core/variables/STATETYPE_STRING', '8d3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/TOTEM_SEND_TRANSACTION_VERSION',
                component: ComponentCreator('/api/totemsdk-core/variables/TOTEM_SEND_TRANSACTION_VERSION', '629'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/WebSocketReadyState',
                component: ComponentCreator('/api/totemsdk-core/variables/WebSocketReadyState', 'a93'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/WORD_LIST',
                component: ComponentCreator('/api/totemsdk-core/variables/WORD_LIST', 'c8a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/WOTS_MINIMA',
                component: ComponentCreator('/api/totemsdk-core/variables/WOTS_MINIMA', 'fc8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/WOTS_V1_DEV',
                component: ComponentCreator('/api/totemsdk-core/variables/WOTS_V1_DEV', 'd47'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-core/variables/WOTS_V2_SPEC',
                component: ComponentCreator('/api/totemsdk-core/variables/WOTS_V2_SPEC', '998'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/',
                component: ComponentCreator('/api/totemsdk-kissvm/', '343'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/classes/KissvmLimitError',
                component: ComponentCreator('/api/totemsdk-kissvm/classes/KissvmLimitError', '6d9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/classes/KissvmRuntimeError',
                component: ComponentCreator('/api/totemsdk-kissvm/classes/KissvmRuntimeError', 'a64'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/functions/buildWitness',
                component: ComponentCreator('/api/totemsdk-kissvm/functions/buildWitness', '67b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/functions/evaluateScript',
                component: ComponentCreator('/api/totemsdk-kissvm/functions/evaluateScript', '8e8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/functions/parseScript',
                component: ComponentCreator('/api/totemsdk-kissvm/functions/parseScript', 'e20'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/functions/sigdig',
                component: ComponentCreator('/api/totemsdk-kissvm/functions/sigdig', '6ac'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/functions/simulateSpend',
                component: ComponentCreator('/api/totemsdk-kissvm/functions/simulateSpend', '3c1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/interfaces/CoinData',
                component: ComponentCreator('/api/totemsdk-kissvm/interfaces/CoinData', '1ac'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/interfaces/EvalResult',
                component: ComponentCreator('/api/totemsdk-kissvm/interfaces/EvalResult', 'cce'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/interfaces/OutputData',
                component: ComponentCreator('/api/totemsdk-kissvm/interfaces/OutputData', '50c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/interfaces/ScriptWitness',
                component: ComponentCreator('/api/totemsdk-kissvm/interfaces/ScriptWitness', '7e0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/interfaces/TxContext',
                component: ComponentCreator('/api/totemsdk-kissvm/interfaces/TxContext', 'f81'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/interfaces/WitnessInput',
                component: ComponentCreator('/api/totemsdk-kissvm/interfaces/WitnessInput', '03c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/type-aliases/ASTNode',
                component: ComponentCreator('/api/totemsdk-kissvm/type-aliases/ASTNode', 'e12'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-kissvm/type-aliases/Value',
                component: ComponentCreator('/api/totemsdk-kissvm/type-aliases/Value', 'ca8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/',
                component: ComponentCreator('/api/totemsdk-lookup-client/', 'ac4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/classes/FrameParser',
                component: ComponentCreator('/api/totemsdk-lookup-client/classes/FrameParser', '7c8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/classes/LookupClient',
                component: ComponentCreator('/api/totemsdk-lookup-client/classes/LookupClient', '064'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/classes/LookupClientError',
                component: ComponentCreator('/api/totemsdk-lookup-client/classes/LookupClientError', 'c04'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/classes/LookupClientProvider',
                component: ComponentCreator('/api/totemsdk-lookup-client/classes/LookupClientProvider', 'd93'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/functions/connectLookupNode',
                component: ComponentCreator('/api/totemsdk-lookup-client/functions/connectLookupNode', '2ed'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/functions/createInMemoryPair',
                component: ComponentCreator('/api/totemsdk-lookup-client/functions/createInMemoryPair', '9d8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/interfaces/CoinUpdateEvent',
                component: ComponentCreator('/api/totemsdk-lookup-client/interfaces/CoinUpdateEvent', 'c7c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/interfaces/ITransport',
                component: ComponentCreator('/api/totemsdk-lookup-client/interfaces/ITransport', '8e6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/interfaces/LookupClientConfig',
                component: ComponentCreator('/api/totemsdk-lookup-client/interfaces/LookupClientConfig', 'a19'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/type-aliases/CoinUpdateCallback',
                component: ComponentCreator('/api/totemsdk-lookup-client/type-aliases/CoinUpdateCallback', '302'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-client/type-aliases/Unsubscribe',
                component: ComponentCreator('/api/totemsdk-lookup-client/type-aliases/Unsubscribe', '0d1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/',
                component: ComponentCreator('/api/totemsdk-lookup-node/', '806'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/AgentRegistry',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/AgentRegistry', 'b0b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/AppRegistry',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/AppRegistry', 'd92'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/HyperswarmManager',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/HyperswarmManager', '350'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/HyperswarmTransport',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/HyperswarmTransport', '946'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/LeaseCoordinator',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/LeaseCoordinator', '569'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/LookupNode',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/LookupNode', '6fa'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/SqliteStorageAdapter',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/SqliteStorageAdapter', 'ade'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/SqliteStore',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/SqliteStore', '5a6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/TrustIndex',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/TrustIndex', '7fe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/TxPoWRelay',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/TxPoWRelay', '8fd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/classes/WatchlistManager',
                component: ComponentCreator('/api/totemsdk-lookup-node/classes/WatchlistManager', '5c0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/functions/createLookupNode',
                component: ComponentCreator('/api/totemsdk-lookup-node/functions/createLookupNode', '395'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/AgentRegistryConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/AgentRegistryConfig', 'e81'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/AgentRow',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/AgentRow', '068'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/AppRegistryConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/AppRegistryConfig', '403'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/AppRow',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/AppRow', '38e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/HyperswarmManagerConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/HyperswarmManagerConfig', 'ed9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/ITransport',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/ITransport', '046'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/LeaseConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/LeaseConfig', '6df'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/LookupNodeConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/LookupNodeConfig', 'd0f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/MegaMMRConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/MegaMMRConfig', 'fd1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/NodeDispatcher',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/NodeDispatcher', '2c2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/RelayConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/RelayConfig', 'ac1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/SqliteConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/SqliteConfig', 'bab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/TrustIndexConfig',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/TrustIndexConfig', '661'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-node/interfaces/TrustRow',
                component: ComponentCreator('/api/totemsdk-lookup-node/interfaces/TrustRow', '013'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/', '2a8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/classes/FramingError',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/classes/FramingError', '8cc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/functions/checkVersion',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/functions/checkVersion', 'c71'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/functions/decodeMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/functions/decodeMessage', '19c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/functions/encodeMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/functions/encodeMessage', '346'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/functions/messageDigest',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/functions/messageDigest', 'a38'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/functions/peekFrameLength',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/functions/peekFrameLength', '529'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/functions/signMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/functions/signMessage', '75a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/functions/verifyMessageAuth',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/functions/verifyMessageAuth', '8c8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AgentAnnounceMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AgentAnnounceMessage', '798'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AgentQueryMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AgentQueryMessage', '8d4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AgentResultMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AgentResultMessage', 'e1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AppAnnounceMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AppAnnounceMessage', 'd5e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AppQueryMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AppQueryMessage', 'a3e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AppResultMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AppResultMessage', '590'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AuthChallengeMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AuthChallengeMessage', '235'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/AuthResponseMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/AuthResponseMessage', '4ea'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/BroadcastTxPoWMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/BroadcastTxPoWMessage', '91b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/CoinUpdateMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/CoinUpdateMessage', '3e6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/ErrorMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/ErrorMessage', '386'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/GetCoinMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/GetCoinMessage', 'a08'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/GetCoinsMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/GetCoinsMessage', 'cf9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/GetProofMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/GetProofMessage', '607'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/GetTipMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/GetTipMessage', 'ee9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/GetTokenMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/GetTokenMessage', '07f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/HelloMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/HelloMessage', 'e4c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/LeaseBurnMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/LeaseBurnMessage', '02d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/LeaseCommitMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/LeaseCommitMessage', 'a4a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/LeaseReserveMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/LeaseReserveMessage', '5eb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/LeaseWatermarkMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/LeaseWatermarkMessage', 'aa7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/PingMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/PingMessage', '636'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/PongMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/PongMessage', 'd63'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/ProofResponseMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/ProofResponseMessage', '161'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/SignFn',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/SignFn', '518'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/TrustQueryMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/TrustQueryMessage', '9dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/TrustRecordMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/TrustRecordMessage', 'df7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/VerifyFn',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/VerifyFn', '748'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/VersionCheckResult',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/VersionCheckResult', 'e7c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/VersionMismatchMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/VersionMismatchMessage', '0e4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/WatchRegisterMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/WatchRegisterMessage', 'b40'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/interfaces/WatchRemoveMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/interfaces/WatchRemoveMessage', 'b7d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/type-aliases/LookupMessage',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/type-aliases/LookupMessage', 'fca'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/type-aliases/MessageType',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/type-aliases/MessageType', '593'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-lookup-protocol/variables/PROTOCOL_VERSION',
                component: ComponentCreator('/api/totemsdk-lookup-protocol/variables/PROTOCOL_VERSION', 'c54'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/',
                component: ComponentCreator('/api/totemsdk-node/', 'a2d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/ConsoleLogger',
                component: ComponentCreator('/api/totemsdk-node/classes/ConsoleLogger', 'aa9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/DefaultTimerAdapter',
                component: ComponentCreator('/api/totemsdk-node/classes/DefaultTimerAdapter', 'f02'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/EnvironmentAuthProvider',
                component: ComponentCreator('/api/totemsdk-node/classes/EnvironmentAuthProvider', 'e60'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/ExchangeHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/ExchangeHelper', 'f98'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/FileStorageAdapter',
                component: ComponentCreator('/api/totemsdk-node/classes/FileStorageAdapter', 'e31'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/FlashCashHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/FlashCashHelper', 'cd6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/HTLCHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/HTLCHelper', '267'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/InMemoryAuthProvider',
                component: ComponentCreator('/api/totemsdk-node/classes/InMemoryAuthProvider', 'e53'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/LeaseMonitor',
                component: ComponentCreator('/api/totemsdk-node/classes/LeaseMonitor', '19b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/LeaseStore',
                component: ComponentCreator('/api/totemsdk-node/classes/LeaseStore', '6ab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/MASTHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/MASTHelper', '535'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/MemoryStorageAdapter',
                component: ComponentCreator('/api/totemsdk-node/classes/MemoryStorageAdapter', '1ba'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/MinimaClient',
                component: ComponentCreator('/api/totemsdk-node/classes/MinimaClient', '115'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/MinimaProvider',
                component: ComponentCreator('/api/totemsdk-node/classes/MinimaProvider', '8b4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/MinimaWallet',
                component: ComponentCreator('/api/totemsdk-node/classes/MinimaWallet', '1a5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/MMRTree',
                component: ComponentCreator('/api/totemsdk-node/classes/MMRTree', 'ef0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/NodeConfigProvider',
                component: ComponentCreator('/api/totemsdk-node/classes/NodeConfigProvider', 'd93'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/NodeCryptoAdapter',
                component: ComponentCreator('/api/totemsdk-node/classes/NodeCryptoAdapter', '2f0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/NodeHttpClient',
                component: ComponentCreator('/api/totemsdk-node/classes/NodeHttpClient', '0dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/NodeWebSocketFactory',
                component: ComponentCreator('/api/totemsdk-node/classes/NodeWebSocketFactory', 'da1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/NoopLifecycleAdapter',
                component: ComponentCreator('/api/totemsdk-node/classes/NoopLifecycleAdapter', '121'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/NoopLogger',
                component: ComponentCreator('/api/totemsdk-node/classes/NoopLogger', '918'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/NoopMetrics',
                component: ComponentCreator('/api/totemsdk-node/classes/NoopMetrics', 'e77'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/SlowCashHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/SlowCashHelper', 'be7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/StatefulGameHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/StatefulGameHelper', '701'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/StorageAuthProvider',
                component: ComponentCreator('/api/totemsdk-node/classes/StorageAuthProvider', '77a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/TimelockHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/TimelockHelper', 'a1f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/TransactionLifecycle',
                component: ComponentCreator('/api/totemsdk-node/classes/TransactionLifecycle', '200'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/TransactionLifecycleError',
                component: ComponentCreator('/api/totemsdk-node/classes/TransactionLifecycleError', '755'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/TransactionReceiptStore',
                component: ComponentCreator('/api/totemsdk-node/classes/TransactionReceiptStore', '855'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/TransactionService',
                component: ComponentCreator('/api/totemsdk-node/classes/TransactionService', '766'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/TreeKey',
                component: ComponentCreator('/api/totemsdk-node/classes/TreeKey', 'fe8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/TreeKeyNode',
                component: ComponentCreator('/api/totemsdk-node/classes/TreeKeyNode', '5cb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/VaultHelper',
                component: ComponentCreator('/api/totemsdk-node/classes/VaultHelper', '0a3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/WatermarkExhaustedError',
                component: ComponentCreator('/api/totemsdk-node/classes/WatermarkExhaustedError', 'b35'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/classes/WatermarkStore',
                component: ComponentCreator('/api/totemsdk-node/classes/WatermarkStore', '1f2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/addressToRoot',
                component: ComponentCreator('/api/totemsdk-node/functions/addressToRoot', '236'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/aggregateSignatures',
                component: ComponentCreator('/api/totemsdk-node/functions/aggregateSignatures', 'f47'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/assert32',
                component: ComponentCreator('/api/totemsdk-node/functions/assert32', 'ad6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/baseWWithChecksum',
                component: ComponentCreator('/api/totemsdk-node/functions/baseWWithChecksum', 'ca3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/bigIntToByteArray',
                component: ComponentCreator('/api/totemsdk-node/functions/bigIntToByteArray', 'ca6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/buildMinimaCoin',
                component: ComponentCreator('/api/totemsdk-node/functions/buildMinimaCoin', '4c4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/buildScriptProofFromDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/buildScriptProofFromDescriptor', 'caa'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/bytesToHex',
                component: ComponentCreator('/api/totemsdk-node/functions/bytesToHex', 'bd0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/bytesToUtf8',
                component: ComponentCreator('/api/totemsdk-node/functions/bytesToUtf8', '944'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/calculateProofRoot',
                component: ComponentCreator('/api/totemsdk-node/functions/calculateProofRoot', '1be'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/cleanSeedPhrase',
                component: ComponentCreator('/api/totemsdk-node/functions/cleanSeedPhrase', 'd94'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/computeScriptAddress',
                component: ComponentCreator('/api/totemsdk-node/functions/computeScriptAddress', '5b7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/computeTransactionDigest',
                component: ComponentCreator('/api/totemsdk-node/functions/computeTransactionDigest', 'a46'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/concat',
                component: ComponentCreator('/api/totemsdk-node/functions/concat', 'da2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/concatBytes',
                component: ComponentCreator('/api/totemsdk-node/functions/concatBytes', 'f49'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/convertFlatChunkToSDK',
                component: ComponentCreator('/api/totemsdk-node/functions/convertFlatChunkToSDK', 'f75'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/convertLegacyProofToSDK',
                component: ComponentCreator('/api/totemsdk-node/functions/convertLegacyProofToSDK', '070'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/convertStringToSeed',
                component: ComponentCreator('/api/totemsdk-node/functions/convertStringToSeed', '05b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/convertWordListToSeed',
                component: ComponentCreator('/api/totemsdk-node/functions/convertWordListToSeed', '0bd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createAdapterRegistry',
                component: ComponentCreator('/api/totemsdk-node/functions/createAdapterRegistry', '6ee'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createAuthedNodeHttpClient',
                component: ComponentCreator('/api/totemsdk-node/functions/createAuthedNodeHttpClient', '2bc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createCancellationToken',
                component: ComponentCreator('/api/totemsdk-node/functions/createCancellationToken', '36a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createChallenge',
                component: ComponentCreator('/api/totemsdk-node/functions/createChallenge', 'ee0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createConfigFromEnv',
                component: ComponentCreator('/api/totemsdk-node/functions/createConfigFromEnv', '31c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createDefaultTransaction',
                component: ComponentCreator('/api/totemsdk-node/functions/createDefaultTransaction', '421'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createEmptyMMRProof',
                component: ComponentCreator('/api/totemsdk-node/functions/createEmptyMMRProof', 'ddc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createExchangeDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createExchangeDescriptor', '8fe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createFlashCashDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createFlashCashDescriptor', 'eaa'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createHTLCDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createHTLCDescriptor', 'd10'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createMASTDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createMASTDescriptor', '026'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createMMRDataLeafNode',
                component: ComponentCreator('/api/totemsdk-node/functions/createMMRDataLeafNode', '9e1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createMMRDataParentNode',
                component: ComponentCreator('/api/totemsdk-node/functions/createMMRDataParentNode', 'ff2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-node/functions/createMMREntryNumber', 'f4b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createMofNMultisigDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createMofNMultisigDescriptor', '2ef'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createMultisigDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createMultisigDescriptor', '516'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createNodeAdapters',
                component: ComponentCreator('/api/totemsdk-node/functions/createNodeAdapters', '909'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createPerAddressTreeKey',
                component: ComponentCreator('/api/totemsdk-node/functions/createPerAddressTreeKey', 'c02'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createPerAddressTreeKeyAsync',
                component: ComponentCreator('/api/totemsdk-node/functions/createPerAddressTreeKeyAsync', 'bbe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createServerAdapters',
                component: ComponentCreator('/api/totemsdk-node/functions/createServerAdapters', 'ef2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createSignedByDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createSignedByDescriptor', '52b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createSlowCashDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createSlowCashDescriptor', '4a2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/createTimelockDescriptor',
                component: ComponentCreator('/api/totemsdk-node/functions/createTimelockDescriptor', '29d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/decodeMxRadix32Frame',
                component: ComponentCreator('/api/totemsdk-node/functions/decodeMxRadix32Frame', 'af5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/deduplicateScriptDescriptors',
                component: ComponentCreator('/api/totemsdk-node/functions/deduplicateScriptDescriptors', 'dbb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/deriveAddressFromPublicKey',
                component: ComponentCreator('/api/totemsdk-node/functions/deriveAddressFromPublicKey', 'd4c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/deriveAddressPublicKey',
                component: ComponentCreator('/api/totemsdk-node/functions/deriveAddressPublicKey', '76f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/deriveChainSeedJava',
                component: ComponentCreator('/api/totemsdk-node/functions/deriveChainSeedJava', 'a5f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/deriveChildTreeSeedJava',
                component: ComponentCreator('/api/totemsdk-node/functions/deriveChildTreeSeedJava', 'fe4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/derivePerAddressSeed',
                component: ComponentCreator('/api/totemsdk-node/functions/derivePerAddressSeed', 'a13'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/derivePKdigest',
                component: ComponentCreator('/api/totemsdk-node/functions/derivePKdigest', 'fb8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/deserializeTreeSignature',
                component: ComponentCreator('/api/totemsdk-node/functions/deserializeTreeSignature', '911'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/encodeMiniData',
                component: ComponentCreator('/api/totemsdk-node/functions/encodeMiniData', '2a9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/encodeMiniNumber',
                component: ComponentCreator('/api/totemsdk-node/functions/encodeMiniNumber', '1e4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/encodeMiniString',
                component: ComponentCreator('/api/totemsdk-node/functions/encodeMiniString', '8d2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/encodeMxRadix32Frame',
                component: ComponentCreator('/api/totemsdk-node/functions/encodeMxRadix32Frame', 'e73'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/encodeStateValue',
                component: ComponentCreator('/api/totemsdk-node/functions/encodeStateValue', '61f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/finalizeLease',
                component: ComponentCreator('/api/totemsdk-node/functions/finalizeLease', '1e1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/flatIndexFromLanes',
                component: ComponentCreator('/api/totemsdk-node/functions/flatIndexFromLanes', '951'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/generateSeedPhrase',
                component: ComponentCreator('/api/totemsdk-node/functions/generateSeedPhrase', '43e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/generateWordList',
                component: ComponentCreator('/api/totemsdk-node/functions/generateWordList', '4cc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/getParamSet',
                component: ComponentCreator('/api/totemsdk-node/functions/getParamSet', '9f4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/getPerAddressPublicKey',
                component: ComponentCreator('/api/totemsdk-node/functions/getPerAddressPublicKey', '20b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/getRootPublicKey',
                component: ComponentCreator('/api/totemsdk-node/functions/getRootPublicKey', '5db'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/hashAllObjects',
                component: ComponentCreator('/api/totemsdk-node/functions/hashAllObjects', '61b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/hashObject',
                component: ComponentCreator('/api/totemsdk-node/functions/hashObject', 'bce'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/hexToBytes',
                component: ComponentCreator('/api/totemsdk-node/functions/hexToBytes', '30b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/hexToMx',
                component: ComponentCreator('/api/totemsdk-node/functions/hexToMx', '7da'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/indexToMiniDataBytes',
                component: ComponentCreator('/api/totemsdk-node/functions/indexToMiniDataBytes', '1c3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/javaHashAllObjects',
                component: ComponentCreator('/api/totemsdk-node/functions/javaHashAllObjects', 'e99'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/makeMxAddress',
                component: ComponentCreator('/api/totemsdk-node/functions/makeMxAddress', '457'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/mmrLeafExact',
                component: ComponentCreator('/api/totemsdk-node/functions/mmrLeafExact', '3d1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/mmrRootFromSingleLeaf',
                component: ComponentCreator('/api/totemsdk-node/functions/mmrRootFromSingleLeaf', '4ff'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/mxToHex',
                component: ComponentCreator('/api/totemsdk-node/functions/mxToHex', 'd50'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/normalizeHex',
                component: ComponentCreator('/api/totemsdk-node/functions/normalizeHex', 'ab9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/parseDecimalToMiniNumber',
                component: ComponentCreator('/api/totemsdk-node/functions/parseDecimalToMiniNumber', 'c09'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/parseMMRProofFromHex',
                component: ComponentCreator('/api/totemsdk-node/functions/parseMMRProofFromHex', 'edf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/parseMxAddress',
                component: ComponentCreator('/api/totemsdk-node/functions/parseMxAddress', '2b7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/phraseToSeed',
                component: ComponentCreator('/api/totemsdk-node/functions/phraseToSeed', 'e11'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/precomputeTransactionCoinID',
                component: ComponentCreator('/api/totemsdk-node/functions/precomputeTransactionCoinID', '2d6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/precomputeTransactionCoinIDTx',
                component: ComponentCreator('/api/totemsdk-node/functions/precomputeTransactionCoinIDTx', 'b30'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/prepareLease',
                component: ComponentCreator('/api/totemsdk-node/functions/prepareLease', '9a8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/prfChainSeed',
                component: ComponentCreator('/api/totemsdk-node/functions/prfChainSeed', '396'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/scriptFromWotsPk',
                component: ComponentCreator('/api/totemsdk-node/functions/scriptFromWotsPk', 'a61'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/scriptToAddress',
                component: ComponentCreator('/api/totemsdk-node/functions/scriptToAddress', '94e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeCoin',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeCoin', 'e8d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeExtraScripts',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeExtraScripts', 'bda'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMiniData',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMiniData', '3c0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMiniNumber',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMiniNumber', 'f82'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMiniNumberONE',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMiniNumberONE', '1dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMiniNumberZERO',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMiniNumberZERO', 'a6f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMMRData',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMMRData', '3d6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMMREntry',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMMREntry', 'a20'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMMREntryNumber', 'f93'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMMRProof',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMMRProof', 'a68'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeMMRProofChunk',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeMMRProofChunk', 'df0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeScriptProofWithProof',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeScriptProofWithProof', 'b59'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeStateVariables',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeStateVariables', '4b0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeTransaction',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeTransaction', 'd11'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/serializeTreeSignature',
                component: ComponentCreator('/api/totemsdk-node/functions/serializeTreeSignature', '590'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/simpleTotemSendRequest',
                component: ComponentCreator('/api/totemsdk-node/functions/simpleTotemSendRequest', '5a6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/toWinternitzDigits',
                component: ComponentCreator('/api/totemsdk-node/functions/toWinternitzDigits', '01e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/utf8ToBytes',
                component: ComponentCreator('/api/totemsdk-node/functions/utf8ToBytes', '528'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/validateChallenge',
                component: ComponentCreator('/api/totemsdk-node/functions/validateChallenge', 'e93'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/validateExternalSignature',
                component: ComponentCreator('/api/totemsdk-node/functions/validateExternalSignature', 'bcc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/validatePhrase',
                component: ComponentCreator('/api/totemsdk-node/functions/validatePhrase', '0f0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/validateSendTransactionRequest',
                component: ComponentCreator('/api/totemsdk-node/functions/validateSendTransactionRequest', 'b56'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/verifyMMRProof',
                component: ComponentCreator('/api/totemsdk-node/functions/verifyMMRProof', '70c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/verifySignature',
                component: ComponentCreator('/api/totemsdk-node/functions/verifySignature', '248'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/verifySignatureDetailed',
                component: ComponentCreator('/api/totemsdk-node/functions/verifySignatureDetailed', '6d4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/verifyTreeSignature',
                component: ComponentCreator('/api/totemsdk-node/functions/verifyTreeSignature', '9c6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/verifyTreeSignatureDetailed',
                component: ComponentCreator('/api/totemsdk-node/functions/verifyTreeSignatureDetailed', 'd27'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsAddressFromKeypair',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsAddressFromKeypair', '907'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsKeypairFromSeed',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsKeypairFromSeed', '3e5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsPkFromSig',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsPkFromSig', 'd03'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsPublicKeyFromSeed',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsPublicKeyFromSeed', 'c4e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsSign',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsSign', '83e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsSignLegacy',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsSignLegacy', '4e3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsVerify',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsVerify', '918'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/wotsVerifyDigest',
                component: ComponentCreator('/api/totemsdk-node/functions/wotsVerifyDigest', '635'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/writeHashToStream',
                component: ComponentCreator('/api/totemsdk-node/functions/writeHashToStream', '1a8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/writeMiniByte',
                component: ComponentCreator('/api/totemsdk-node/functions/writeMiniByte', '5b8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/writeMiniData',
                component: ComponentCreator('/api/totemsdk-node/functions/writeMiniData', 'eac'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/writeMiniNumber',
                component: ComponentCreator('/api/totemsdk-node/functions/writeMiniNumber', 'c62'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/writeMiniString',
                component: ComponentCreator('/api/totemsdk-node/functions/writeMiniString', '0f3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/functions/writeMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-node/functions/writeMMREntryNumber', 'f31'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/AdapterRegistry',
                component: ComponentCreator('/api/totemsdk-node/interfaces/AdapterRegistry', 'bd6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/AuthTokenProvider',
                component: ComponentCreator('/api/totemsdk-node/interfaces/AuthTokenProvider', '1b5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/CancellationToken',
                component: ComponentCreator('/api/totemsdk-node/interfaces/CancellationToken', 'ed3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/CancellationTokenSource',
                component: ComponentCreator('/api/totemsdk-node/interfaces/CancellationTokenSource', '074'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/CoinProofData',
                component: ComponentCreator('/api/totemsdk-node/interfaces/CoinProofData', 'e55'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/ConfigProvider',
                component: ComponentCreator('/api/totemsdk-node/interfaces/ConfigProvider', '824'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/CreateNodeAdaptersOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/CreateNodeAdaptersOptions', '137'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/CreateServerAdaptersOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/CreateServerAdaptersOptions', '957'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/CryptoAdapter',
                component: ComponentCreator('/api/totemsdk-node/interfaces/CryptoAdapter', 'bd5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppContractCallParams',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppContractCallParams', '540'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppHtlcParams',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppHtlcParams', 'f41'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppLiquidityParams',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppLiquidityParams', 'ace'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppMultisigParams',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppMultisigParams', '5b5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppStateVariable',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppStateVariable', '600'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppSwapParams',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppSwapParams', '025'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppTimelockParams',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppTimelockParams', '2ab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppTransactionInput',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppTransactionInput', '789'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/DAppTransactionOutput',
                component: ComponentCreator('/api/totemsdk-node/interfaces/DAppTransactionOutput', '8cf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/EnvironmentConfigMapping',
                component: ComponentCreator('/api/totemsdk-node/interfaces/EnvironmentConfigMapping', '285'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/ExternalSignature',
                component: ComponentCreator('/api/totemsdk-node/interfaces/ExternalSignature', '244'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/FileStorageAdapterOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/FileStorageAdapterOptions', '6a8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/FinalizeRequest',
                component: ComponentCreator('/api/totemsdk-node/interfaces/FinalizeRequest', 'e3b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/FinalizeResponse',
                component: ComponentCreator('/api/totemsdk-node/interfaces/FinalizeResponse', 'c54'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/FlatMMRProofChunk',
                component: ComponentCreator('/api/totemsdk-node/interfaces/FlatMMRProofChunk', '526'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/HierarchicalWitnessBundle',
                component: ComponentCreator('/api/totemsdk-node/interfaces/HierarchicalWitnessBundle', '952'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/HttpClient',
                component: ComponentCreator('/api/totemsdk-node/interfaces/HttpClient', '240'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/HttpRequestOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/HttpRequestOptions', '4d2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/HttpResponse',
                component: ComponentCreator('/api/totemsdk-node/interfaces/HttpResponse', 'e85'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/JavaMMRData',
                component: ComponentCreator('/api/totemsdk-node/interfaces/JavaMMRData', '14b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/JavaMMREntry',
                component: ComponentCreator('/api/totemsdk-node/interfaces/JavaMMREntry', '05c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/JavaMMREntryNumber',
                component: ComponentCreator('/api/totemsdk-node/interfaces/JavaMMREntryNumber', 'c59'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/KeyGenProgress',
                component: ComponentCreator('/api/totemsdk-node/interfaces/KeyGenProgress', 'a9c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/LeaseExpiryEvent',
                component: ComponentCreator('/api/totemsdk-node/interfaces/LeaseExpiryEvent', 'e87'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/LeaseMonitorConfig',
                component: ComponentCreator('/api/totemsdk-node/interfaces/LeaseMonitorConfig', '905'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/LeaseStoreConfig',
                component: ComponentCreator('/api/totemsdk-node/interfaces/LeaseStoreConfig', 'f75'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/LeaseWotsIndices',
                component: ComponentCreator('/api/totemsdk-node/interfaces/LeaseWotsIndices', 'ce5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/LegacyMMRProof',
                component: ComponentCreator('/api/totemsdk-node/interfaces/LegacyMMRProof', 'c6d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/LifecycleAdapter',
                component: ComponentCreator('/api/totemsdk-node/interfaces/LifecycleAdapter', 'a23'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/LoggerAdapter',
                component: ComponentCreator('/api/totemsdk-node/interfaces/LoggerAdapter', '7c9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MetricsAdapter',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MetricsAdapter', '07b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MinimaCoin',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MinimaCoin', 'f0c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MinimaToken',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MinimaToken', '681'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MinimaTransaction',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MinimaTransaction', '7ee'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MMRData',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MMRData', 'b49'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MMREntry',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MMREntry', 'f93'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MMRProof',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MMRProof', '518'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/MMRProofChunk',
                component: ComponentCreator('/api/totemsdk-node/interfaces/MMRProofChunk', '46f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/NodeConfigOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/NodeConfigOptions', '10c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/NodeHttpClientOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/NodeHttpClientOptions', '602'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/ParsedMiniNumber',
                component: ComponentCreator('/api/totemsdk-node/interfaces/ParsedMiniNumber', '938'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/PrepareRequest',
                component: ComponentCreator('/api/totemsdk-node/interfaces/PrepareRequest', '1f6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/PrepareResponse',
                component: ComponentCreator('/api/totemsdk-node/interfaces/PrepareResponse', '437'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/PrepareResult',
                component: ComponentCreator('/api/totemsdk-node/interfaces/PrepareResult', '229'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/RawStateVariable',
                component: ComponentCreator('/api/totemsdk-node/interfaces/RawStateVariable', '982'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/ScriptCatalogEntry',
                component: ComponentCreator('/api/totemsdk-node/interfaces/ScriptCatalogEntry', 'b35'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/ScriptDescriptor',
                component: ComponentCreator('/api/totemsdk-node/interfaces/ScriptDescriptor', '1c8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/ScriptProofResult',
                component: ComponentCreator('/api/totemsdk-node/interfaces/ScriptProofResult', 'c9b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/SignatureProof',
                component: ComponentCreator('/api/totemsdk-node/interfaces/SignatureProof', '745'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/SignRequest',
                component: ComponentCreator('/api/totemsdk-node/interfaces/SignRequest', 'f6b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/SignResult',
                component: ComponentCreator('/api/totemsdk-node/interfaces/SignResult', 'd14'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/SiteTransactionPermission',
                component: ComponentCreator('/api/totemsdk-node/interfaces/SiteTransactionPermission', 'e2c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/SpendableCoinInput',
                component: ComponentCreator('/api/totemsdk-node/interfaces/SpendableCoinInput', '5dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/StateValue',
                component: ComponentCreator('/api/totemsdk-node/interfaces/StateValue', '794'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/StateVariable',
                component: ComponentCreator('/api/totemsdk-node/interfaces/StateVariable', '9be'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/StorageAdapter',
                component: ComponentCreator('/api/totemsdk-node/interfaces/StorageAdapter', '94e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/StorageAuthProviderOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/StorageAuthProviderOptions', '54b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/StoredLease',
                component: ComponentCreator('/api/totemsdk-node/interfaces/StoredLease', '984'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/SyncResult',
                component: ComponentCreator('/api/totemsdk-node/interfaces/SyncResult', '7c6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TimerAdapter',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TimerAdapter', '855'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TotemSendTransactionRequest',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TotemSendTransactionRequest', 'de0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TotemSendTransactionResponse',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TotemSendTransactionResponse', 'f40'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionBuildResult',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionBuildResult', '5b9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionError',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionError', 'db9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionLifecycleConfig',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionLifecycleConfig', '9c6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionMetadata',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionMetadata', 'e8f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionReceipt',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionReceipt', '4c4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionReceiptStoreConfig',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionReceiptStoreConfig', '9c8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionRoundState',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionRoundState', '541'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionScope',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionScope', 'ddf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TransactionServiceConfig',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TransactionServiceConfig', '69a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/TreeSignature',
                component: ComponentCreator('/api/totemsdk-node/interfaces/TreeSignature', '912'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/VerificationResult',
                component: ComponentCreator('/api/totemsdk-node/interfaces/VerificationResult', '732'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/VerifyOutExpectation',
                component: ComponentCreator('/api/totemsdk-node/interfaces/VerifyOutExpectation', 'ef7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WatermarkState',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WatermarkState', '2eb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WatermarkStoreConfig',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WatermarkStoreConfig', 'bb4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WatermarkSyncFunction',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WatermarkSyncFunction', '60b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WebSocketClient',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WebSocketClient', '975'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WebSocketCloseEvent',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WebSocketCloseEvent', '89d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WebSocketErrorEvent',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WebSocketErrorEvent', '366'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WebSocketFactory',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WebSocketFactory', '0dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WebSocketFactoryOptions',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WebSocketFactoryOptions', 'ad9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WebSocketMessageEvent',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WebSocketMessageEvent', '45c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WebSocketOpenEvent',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WebSocketOpenEvent', '357'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WitnessBundle',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WitnessBundle', '533'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WotsIndices',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WotsIndices', 'cd2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/interfaces/WotsSigningDependencies',
                component: ComponentCreator('/api/totemsdk-node/interfaces/WotsSigningDependencies', '748'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/BinaryData',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/BinaryData', 'dfc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/Bytes',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/Bytes', 'f29'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/DAppTransactionIntent',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/DAppTransactionIntent', 'fc8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/LeaseExpiryCallback',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/LeaseExpiryCallback', '776'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/LeaseStatus',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/LeaseStatus', 'ace'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/ParamSet',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/ParamSet', 'a1d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/PrepareArgs',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/PrepareArgs', '73c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/PrepareResp',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/PrepareResp', 'c17'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/ProgressCallback',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/ProgressCallback', '37d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/ScriptType',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/ScriptType', '601'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/StateVariableType',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/StateVariableType', '153'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/TimerHandle',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/TimerHandle', '7cb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/TotemTransactionErrorCode',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/TotemTransactionErrorCode', 'a90'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/WebSocketEventMap',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/WebSocketEventMap', '8a9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/WotsKeypair',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/WotsKeypair', 'f00'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/type-aliases/WotsSignature',
                component: ComponentCreator('/api/totemsdk-node/type-aliases/WotsSignature', '6f0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/convertMinimaAddress',
                component: ComponentCreator('/api/totemsdk-node/variables/convertMinimaAddress', '78e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/CORE_BUILD_ID',
                component: ComponentCreator('/api/totemsdk-node/variables/CORE_BUILD_ID', '390'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/CORE_VERSION',
                component: ComponentCreator('/api/totemsdk-node/variables/CORE_VERSION', 'bdf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/decodeMx',
                component: ComponentCreator('/api/totemsdk-node/variables/decodeMx', '944'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/DEFAULT_KEYS_PER_LEVEL',
                component: ComponentCreator('/api/totemsdk-node/variables/DEFAULT_KEYS_PER_LEVEL', '998'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/DEFAULT_LEVELS',
                component: ComponentCreator('/api/totemsdk-node/variables/DEFAULT_LEVELS', 'fa0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/deserializeMMRProof',
                component: ComponentCreator('/api/totemsdk-node/variables/deserializeMMRProof', 'e15'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/encodeMx',
                component: ComponentCreator('/api/totemsdk-node/variables/encodeMx', '02f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/F',
                component: ComponentCreator('/api/totemsdk-node/variables/F', '114'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/fromHex',
                component: ComponentCreator('/api/totemsdk-node/variables/fromHex', '8fa'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/h',
                component: ComponentCreator('/api/totemsdk-node/variables/h', '8d4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/hex',
                component: ComponentCreator('/api/totemsdk-node/variables/hex', '674'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/makeMinimaAddress',
                component: ComponentCreator('/api/totemsdk-node/variables/makeMinimaAddress', '4a4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/MINIMA_CONSTANTS',
                component: ComponentCreator('/api/totemsdk-node/variables/MINIMA_CONSTANTS', '94b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/serializeRealMMRProof',
                component: ComponentCreator('/api/totemsdk-node/variables/serializeRealMMRProof', 'e92'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/STATETYPE_BOOL',
                component: ComponentCreator('/api/totemsdk-node/variables/STATETYPE_BOOL', 'c0c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/STATETYPE_HEX',
                component: ComponentCreator('/api/totemsdk-node/variables/STATETYPE_HEX', 'a0b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/STATETYPE_NUMBER',
                component: ComponentCreator('/api/totemsdk-node/variables/STATETYPE_NUMBER', '2e9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/STATETYPE_STRING',
                component: ComponentCreator('/api/totemsdk-node/variables/STATETYPE_STRING', '747'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/TOTEM_SEND_TRANSACTION_VERSION',
                component: ComponentCreator('/api/totemsdk-node/variables/TOTEM_SEND_TRANSACTION_VERSION', '813'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/u16be',
                component: ComponentCreator('/api/totemsdk-node/variables/u16be', '017'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/u32be',
                component: ComponentCreator('/api/totemsdk-node/variables/u32be', 'e2c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/WebSocketReadyState',
                component: ComponentCreator('/api/totemsdk-node/variables/WebSocketReadyState', '561'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/WORD_LIST',
                component: ComponentCreator('/api/totemsdk-node/variables/WORD_LIST', 'b63'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/WOTS_MINIMA',
                component: ComponentCreator('/api/totemsdk-node/variables/WOTS_MINIMA', 'ef0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/WOTS_V1_DEV',
                component: ComponentCreator('/api/totemsdk-node/variables/WOTS_V1_DEV', '5ea'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-node/variables/WOTS_V2_SPEC',
                component: ComponentCreator('/api/totemsdk-node/variables/WOTS_V2_SPEC', 'a2d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/',
                component: ComponentCreator('/api/totemsdk-omnia-factory/', 'd95'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/acceptFactory',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/acceptFactory', '7c0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/buildAndHashFactoryScript',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/buildAndHashFactoryScript', '78a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/buildDisputePayload',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/buildDisputePayload', '769'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/buildFactoryScript',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/buildFactoryScript', 'a53'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/closeFactory',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/closeFactory', '755'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/closeVirtualChannel',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/closeVirtualChannel', '738'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/computeFactoryStateCommitment',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/computeFactoryStateCommitment', 'e7c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/createFactory',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/createFactory', '0be'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/enforceConservation',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/enforceConservation', 'a91'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/normalizeScript',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/normalizeScript', '2dd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/openVirtualChannel',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/openVirtualChannel', '88b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/reallocate',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/reallocate', '2dd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/functions/scriptAddress',
                component: ComponentCreator('/api/totemsdk-omnia-factory/functions/scriptAddress', '89c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/ChannelFactory',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/ChannelFactory', '7d2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/FactoryDisputePayload',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/FactoryDisputePayload', '8cc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/FactoryLeaseOps',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/FactoryLeaseOps', '9e2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/FactoryLogEntry',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/FactoryLogEntry', '260'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/FactoryParticipant',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/FactoryParticipant', 'd07'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/FactorySettlementPayload',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/FactorySettlementPayload', 'ea9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/OmniaChannel',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/OmniaChannel', '877'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/interfaces/WotsLeaseBundle',
                component: ComponentCreator('/api/totemsdk-omnia-factory/interfaces/WotsLeaseBundle', '9d4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/type-aliases/FactorySignature',
                component: ComponentCreator('/api/totemsdk-omnia-factory/type-aliases/FactorySignature', '3c4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-factory/type-aliases/FactoryStatus',
                component: ComponentCreator('/api/totemsdk-omnia-factory/type-aliases/FactoryStatus', '966'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/', 'bc7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/classes/OmniaFrameParser',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/classes/OmniaFrameParser', '9dd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/classes/OmniaPeerImpl',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/classes/OmniaPeerImpl', 'd2b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/classes/OmniaStream',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/classes/OmniaStream', '467'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/classes/OmniaSwarmImpl',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/classes/OmniaSwarmImpl', '15e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/bindPeerIntegration',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/bindPeerIntegration', '995'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/broadcastTopic',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/broadcastTopic', '765'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/channelTopic',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/channelTopic', '2b5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/createMockStreamPair',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/createMockStreamPair', 'd0b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/createOmniaIntegration',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/createOmniaIntegration', '1d8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/createOmniaSwarm',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/createOmniaSwarm', '5ab'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/createOmniaSwarmFromInstance',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/createOmniaSwarmFromInstance', 'e75'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/encodeOmniaMessage',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/encodeOmniaMessage', '9d7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/functions/peerTopic',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/functions/peerTopic', '937'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/interfaces/IDuplexStream',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/interfaces/IDuplexStream', 'd8a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/interfaces/OmniaIntegrationConfig',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/interfaces/OmniaIntegrationConfig', '823'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/interfaces/OmniaMessage',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/interfaces/OmniaMessage', '6a4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/interfaces/OmniaPeer',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/interfaces/OmniaPeer', '84a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/interfaces/OmniaSwarm',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/interfaces/OmniaSwarm', 'a53'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/interfaces/OmniaSwarmConfig',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/interfaces/OmniaSwarmConfig', '50e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/type-aliases/ChannelStore',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/type-aliases/ChannelStore', '21c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/type-aliases/MinimalChainProvider',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/type-aliases/MinimalChainProvider', '996'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/type-aliases/OmniaMessageType',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/type-aliases/OmniaMessageType', 'e01'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/type-aliases/Unsubscribe',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/type-aliases/Unsubscribe', '1d4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-hyperswarm/type-aliases/WotsLeaseProviderLike',
                component: ComponentCreator('/api/totemsdk-omnia-hyperswarm/type-aliases/WotsLeaseProviderLike', '641'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/',
                component: ComponentCreator('/api/totemsdk-omnia-router/', 'b47'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/addChannel',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/addChannel', 'cea'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/announceSwap',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/announceSwap', 'c4e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/applyRate',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/applyRate', 'c94'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/buildCrossTokenRequest',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/buildCrossTokenRequest', '620'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/buildPaymentRequest',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/buildPaymentRequest', 'f6b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/cancelPayment',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/cancelPayment', 'a6a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/createChannelGraph',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/createChannelGraph', 'c2e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/executeCrossTokenPayment',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/executeCrossTokenPayment', '6ec'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/executeMultiHopPayment',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/executeMultiHopPayment', '224'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/findCrossTokenRoute',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/findCrossTokenRoute', '991'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/findRoute',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/findRoute', 'b0b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/getSwapAnnouncements',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/getSwapAnnouncements', '95a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/parseRateToScaled',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/parseRateToScaled', '950'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/functions/removeChannel',
                component: ComponentCreator('/api/totemsdk-omnia-router/functions/removeChannel', '24e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/ChannelGraph',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/ChannelGraph', 'b36'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/ChannelGraphEdge',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/ChannelGraphEdge', 'ad3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/ChannelHTLC',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/ChannelHTLC', 'efc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/ChannelOps',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/ChannelOps', 'd07'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/ChannelParty',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/ChannelParty', '150'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/ChannelSigner',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/ChannelSigner', '3f7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/CrossTokenRoute',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/CrossTokenRoute', '375'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/HTLCParams',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/HTLCParams', '874'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/PaymentRequest',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/PaymentRequest', 'af5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/PaymentResult',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/PaymentResult', 'a0f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/Route',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/Route', '9d0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/RouteOptions',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/RouteOptions', '4e6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/RouterChannel',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/RouterChannel', '95e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/RoutingHop',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/RoutingHop', 'fda'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/SwapAnnouncement',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/SwapAnnouncement', '96a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/interfaces/SwapHop',
                component: ComponentCreator('/api/totemsdk-omnia-router/interfaces/SwapHop', '3d1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/type-aliases/HTLCStatus',
                component: ComponentCreator('/api/totemsdk-omnia-router/type-aliases/HTLCStatus', '476'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-router/type-aliases/LeaseProvider',
                component: ComponentCreator('/api/totemsdk-omnia-router/type-aliases/LeaseProvider', '111'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/',
                component: ComponentCreator('/api/totemsdk-omnia-splice/', '967'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/classes/PendingHTLCError',
                component: ComponentCreator('/api/totemsdk-omnia-splice/classes/PendingHTLCError', '31b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/classes/SpliceBalanceConservationError',
                component: ComponentCreator('/api/totemsdk-omnia-splice/classes/SpliceBalanceConservationError', 'f7b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/classes/SpliceChannelStatusError',
                component: ComponentCreator('/api/totemsdk-omnia-splice/classes/SpliceChannelStatusError', 'c12'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/classes/SpliceError',
                component: ComponentCreator('/api/totemsdk-omnia-splice/classes/SpliceError', 'a61'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/classes/SpliceInsufficientFundsError',
                component: ComponentCreator('/api/totemsdk-omnia-splice/classes/SpliceInsufficientFundsError', '965'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/classes/SpliceMissingPartyError',
                component: ComponentCreator('/api/totemsdk-omnia-splice/classes/SpliceMissingPartyError', '7d3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/classes/SpliceSignatureMismatchError',
                component: ComponentCreator('/api/totemsdk-omnia-splice/classes/SpliceSignatureMismatchError', 'a33'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/acceptSplice',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/acceptSplice', 'b80'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/buildSpliceTx',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/buildSpliceTx', 'd48'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/computeSpliceTxDigest',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/computeSpliceTxDigest', 'd23'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/finalizeSplice',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/finalizeSplice', '1e1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/proposeSpliceIn',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/proposeSpliceIn', '768'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/proposeSpliceOut',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/proposeSpliceOut', '861'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/quiesceChannel',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/quiesceChannel', '51e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/functions/spliceDraftToMinimaBytes',
                component: ComponentCreator('/api/totemsdk-omnia-splice/functions/spliceDraftToMinimaBytes', 'eca'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/FinalizeSpliceOptions',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/FinalizeSpliceOptions', '2f9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/QuiesceOptions',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/QuiesceOptions', '1ae'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceAcceptance',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceAcceptance', 'f77'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceLeaseProvider',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceLeaseProvider', 'bdf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceParams',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceParams', '3e0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceProposal',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceProposal', 'd25'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceSigningIndices',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceSigningIndices', 'de7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceTxDraft',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceTxDraft', '2ae'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceTxInput',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceTxInput', '008'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/interfaces/SpliceTxOutput',
                component: ComponentCreator('/api/totemsdk-omnia-splice/interfaces/SpliceTxOutput', '75f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/type-aliases/QuiescedChannel',
                component: ComponentCreator('/api/totemsdk-omnia-splice/type-aliases/QuiescedChannel', '8de'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/type-aliases/SplicedChannel',
                component: ComponentCreator('/api/totemsdk-omnia-splice/type-aliases/SplicedChannel', '01a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/type-aliases/SpliceType',
                component: ComponentCreator('/api/totemsdk-omnia-splice/type-aliases/SpliceType', '38a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia-splice/type-aliases/WotsSignature',
                component: ComponentCreator('/api/totemsdk-omnia-splice/type-aliases/WotsSignature', 'af7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/',
                component: ComponentCreator('/api/totemsdk-omnia/', 'c69'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/classes/BalanceConservationError',
                component: ComponentCreator('/api/totemsdk-omnia/classes/BalanceConservationError', 'bad'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/classes/ChannelCapacityError',
                component: ComponentCreator('/api/totemsdk-omnia/classes/ChannelCapacityError', 'c7a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/classes/ChannelStatusError',
                component: ComponentCreator('/api/totemsdk-omnia/classes/ChannelStatusError', 'c7f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/classes/DoubleSignError',
                component: ComponentCreator('/api/totemsdk-omnia/classes/DoubleSignError', '341'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/classes/SequenceError',
                component: ComponentCreator('/api/totemsdk-omnia/classes/SequenceError', '500'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/classes/SigningIndexMonotonicityError',
                component: ComponentCreator('/api/totemsdk-omnia/classes/SigningIndexMonotonicityError', '7b7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/acceptChannel',
                component: ComponentCreator('/api/totemsdk-omnia/functions/acceptChannel', '232'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/activateChannel',
                component: ComponentCreator('/api/totemsdk-omnia/functions/activateChannel', 'ff8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/addHTLC',
                component: ComponentCreator('/api/totemsdk-omnia/functions/addHTLC', 'cbd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/assessCapacity',
                component: ComponentCreator('/api/totemsdk-omnia/functions/assessCapacity', '460'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/attachCounterpartySignature',
                component: ComponentCreator('/api/totemsdk-omnia/functions/attachCounterpartySignature', 'f67'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/buildAndHashEltooScript',
                component: ComponentCreator('/api/totemsdk-omnia/functions/buildAndHashEltooScript', '289'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/buildDisputePayload',
                component: ComponentCreator('/api/totemsdk-omnia/functions/buildDisputePayload', '026'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/buildEltooScript',
                component: ComponentCreator('/api/totemsdk-omnia/functions/buildEltooScript', 'b8f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/buildFundingTx',
                component: ComponentCreator('/api/totemsdk-omnia/functions/buildFundingTx', '62a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/buildSettlementTx',
                component: ComponentCreator('/api/totemsdk-omnia/functions/buildSettlementTx', 'd4d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/buildTxPoWPayload',
                component: ComponentCreator('/api/totemsdk-omnia/functions/buildTxPoWPayload', '549'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/buildUpdateTx',
                component: ComponentCreator('/api/totemsdk-omnia/functions/buildUpdateTx', 'd9f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/computeStateCommitment',
                component: ComponentCreator('/api/totemsdk-omnia/functions/computeStateCommitment', 'db8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/computeTxDraftDigest',
                component: ComponentCreator('/api/totemsdk-omnia/functions/computeTxDraftDigest', '447'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/createChannel',
                component: ComponentCreator('/api/totemsdk-omnia/functions/createChannel', '49b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/deserializeTxDraft',
                component: ComponentCreator('/api/totemsdk-omnia/functions/deserializeTxDraft', 'ee8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/enforceUpdateGuards',
                component: ComponentCreator('/api/totemsdk-omnia/functions/enforceUpdateGuards', '9b2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/executeIntent',
                component: ComponentCreator('/api/totemsdk-omnia/functions/executeIntent', 'd2e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/flatSigningIndex',
                component: ComponentCreator('/api/totemsdk-omnia/functions/flatSigningIndex', '459'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/fulfillHTLC',
                component: ComponentCreator('/api/totemsdk-omnia/functions/fulfillHTLC', 'c85'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/getChannelReceipt',
                component: ComponentCreator('/api/totemsdk-omnia/functions/getChannelReceipt', '097'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/markChannelClosed',
                component: ComponentCreator('/api/totemsdk-omnia/functions/markChannelClosed', '834'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/markChannelClosing',
                component: ComponentCreator('/api/totemsdk-omnia/functions/markChannelClosing', '522'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/normalizeScript',
                component: ComponentCreator('/api/totemsdk-omnia/functions/normalizeScript', '252'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/omniaDraftToMinimaBytes',
                component: ComponentCreator('/api/totemsdk-omnia/functions/omniaDraftToMinimaBytes', 'a62'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/proposeSettlement',
                component: ComponentCreator('/api/totemsdk-omnia/functions/proposeSettlement', 'fd5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/resetChannelWatermarks',
                component: ComponentCreator('/api/totemsdk-omnia/functions/resetChannelWatermarks', '85d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/scriptAddress',
                component: ComponentCreator('/api/totemsdk-omnia/functions/scriptAddress', 'f8e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/serializeTxDraft',
                component: ComponentCreator('/api/totemsdk-omnia/functions/serializeTxDraft', 'bfe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/signState',
                component: ComponentCreator('/api/totemsdk-omnia/functions/signState', '7d0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/signTxDraft',
                component: ComponentCreator('/api/totemsdk-omnia/functions/signTxDraft', '9fe'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/timeoutHTLC',
                component: ComponentCreator('/api/totemsdk-omnia/functions/timeoutHTLC', '4ae'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/toEnhancedBuildParams',
                component: ComponentCreator('/api/totemsdk-omnia/functions/toEnhancedBuildParams', '78b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/updateState',
                component: ComponentCreator('/api/totemsdk-omnia/functions/updateState', '439'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/validateStateTransition',
                component: ComponentCreator('/api/totemsdk-omnia/functions/validateStateTransition', '8c9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/verifyState',
                component: ComponentCreator('/api/totemsdk-omnia/functions/verifyState', 'f39'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/functions/verifyStateSignature',
                component: ComponentCreator('/api/totemsdk-omnia/functions/verifyStateSignature', '350'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/AddHTLCParams',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/AddHTLCParams', '967'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/AgentPolicy',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/AgentPolicy', 'b15'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/AgentReceipt',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/AgentReceipt', '758'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/ChannelLogEntry',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/ChannelLogEntry', 'b43'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/ChannelParticipant',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/ChannelParticipant', 'd95'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/ChannelProposal',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/ChannelProposal', 'cc8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/ChannelReceipt',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/ChannelReceipt', 'b22'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/ChannelSigner',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/ChannelSigner', '116'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/ChannelWatermark',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/ChannelWatermark', '8ed'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/CreateChannelParams',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/CreateChannelParams', '0f8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/DisputePayload',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/DisputePayload', '9dc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/HTLCRecord',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/HTLCRecord', 'b27'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/IntentResult',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/IntentResult', 'd77'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/KissvmEvaluator',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/KissvmEvaluator', '797'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/OmniaChannel',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/OmniaChannel', '9d2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/OmniaTxDraft',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/OmniaTxDraft', '4df'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/PaymentIntent',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/PaymentIntent', '79f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/SettlementPayload',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/SettlementPayload', '2a2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/SignedChannelState',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/SignedChannelState', '449'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/StateValue',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/StateValue', '8f7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/TxInputDraft',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/TxInputDraft', 'd56'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/TxOutputDraft',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/TxOutputDraft', '134'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/UpdateDelta',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/UpdateDelta', '203'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/UpdateStateResult',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/UpdateStateResult', '84c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/interfaces/VerifyStateOptions',
                component: ComponentCreator('/api/totemsdk-omnia/interfaces/VerifyStateOptions', '504'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/type-aliases/CapacityWarning',
                component: ComponentCreator('/api/totemsdk-omnia/type-aliases/CapacityWarning', '4d0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/type-aliases/ChannelStatus',
                component: ComponentCreator('/api/totemsdk-omnia/type-aliases/ChannelStatus', '330'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/type-aliases/partyId',
                component: ComponentCreator('/api/totemsdk-omnia/type-aliases/partyId', '1b2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/variables/CAPACITY_NEAR_EXHAUSTION',
                component: ComponentCreator('/api/totemsdk-omnia/variables/CAPACITY_NEAR_EXHAUSTION', '585'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/variables/CAPACITY_WARNING_APPROACHING',
                component: ComponentCreator('/api/totemsdk-omnia/variables/CAPACITY_WARNING_APPROACHING', '14f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/variables/CAPACITY_WARNING_CRITICAL',
                component: ComponentCreator('/api/totemsdk-omnia/variables/CAPACITY_WARNING_CRITICAL', '639'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/variables/COINID_ELTOO',
                component: ComponentCreator('/api/totemsdk-omnia/variables/COINID_ELTOO', 'f14'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-omnia/variables/WOTS_CAPACITY_TOTAL',
                component: ComponentCreator('/api/totemsdk-omnia/variables/WOTS_CAPACITY_TOTAL', '883'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/',
                component: ComponentCreator('/api/totemsdk-pear/', '659'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/classes/BareFileStore',
                component: ComponentCreator('/api/totemsdk-pear/classes/BareFileStore', '1aa'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/classes/BareHyperdriveAdapter',
                component: ComponentCreator('/api/totemsdk-pear/classes/BareHyperdriveAdapter', '0d6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/classes/BareHyperswarm',
                component: ComponentCreator('/api/totemsdk-pear/classes/BareHyperswarm', '5d2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/classes/BareKVStore',
                component: ComponentCreator('/api/totemsdk-pear/classes/BareKVStore', '395'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/bareFetch',
                component: ComponentCreator('/api/totemsdk-pear/functions/bareFetch', '376'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/createLogger',
                component: ComponentCreator('/api/totemsdk-pear/functions/createLogger', 'a56'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/createPearApp',
                component: ComponentCreator('/api/totemsdk-pear/functions/createPearApp', '715'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/defaultSwarmConfig',
                component: ComponentCreator('/api/totemsdk-pear/functions/defaultSwarmConfig', '56b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/loadConfig',
                component: ComponentCreator('/api/totemsdk-pear/functions/loadConfig', '643'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/loadManifest',
                component: ComponentCreator('/api/totemsdk-pear/functions/loadManifest', '111'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/onExit',
                component: ComponentCreator('/api/totemsdk-pear/functions/onExit', 'b56'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/openLocalDrive',
                component: ComponentCreator('/api/totemsdk-pear/functions/openLocalDrive', '17f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/openRemoteDrive',
                component: ComponentCreator('/api/totemsdk-pear/functions/openRemoteDrive', 'fcb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/functions/runExitHandlers',
                component: ComponentCreator('/api/totemsdk-pear/functions/runExitHandlers', '066'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/AppConfig',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/AppConfig', '73f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/BareFileStoreOptions',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/BareFileStoreOptions', '7e5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/BareKVStoreOptions',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/BareKVStoreOptions', 'b61'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/FetchInit',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/FetchInit', '447'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/FetchResponse',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/FetchResponse', 'c6b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/FsLike',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/FsLike', 'fa7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/HypebeeLike',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/HypebeeLike', 'ee9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/HyperdriveAdapter',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/HyperdriveAdapter', '51f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/ITransport',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/ITransport', 'f0b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/KVStore',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/KVStore', '3c3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/Logger',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/Logger', '95a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/PearApp',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/PearApp', '893'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/PearAppConfig',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/PearAppConfig', 'b41'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/RemoteDriveOptions',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/RemoteDriveOptions', 'd5c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/SignedManifest',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/SignedManifest', '04c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/SwarmConfig',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/SwarmConfig', '116'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/interfaces/SwarmConnectOptions',
                component: ComponentCreator('/api/totemsdk-pear/interfaces/SwarmConnectOptions', 'd7b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/type-aliases/ExitCallback',
                component: ComponentCreator('/api/totemsdk-pear/type-aliases/ExitCallback', '825'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pear/type-aliases/Unsubscribe',
                component: ComponentCreator('/api/totemsdk-pear/type-aliases/Unsubscribe', '6c5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/', '265'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/classes/PureMinimaRpcError',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/classes/PureMinimaRpcError', 'faf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/functions/buildCommandString',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/functions/buildCommandString', '9ae'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/functions/createPureMinimaClient',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/functions/createPureMinimaClient', 'fbd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/functions/postCommand',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/functions/postCommand', '1c5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/AddressInfo',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/AddressInfo', 'f1d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/Balance',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/Balance', '9b3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/BalanceQuery',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/BalanceQuery', 'b7d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/BurnInfo',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/BurnInfo', 'ebb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/ChainTip',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/ChainTip', 'ff7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/Coin',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/Coin', '514'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/CoinCheckResult',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/CoinCheckResult', '7f6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/CoinExportResult',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/CoinExportResult', '4c5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/CoinsQuery',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/CoinsQuery', '6cd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/HistoryEntry',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/HistoryEntry', 'f6e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/HistoryQuery',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/HistoryQuery', '634'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/MegaMMRInfo',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/MegaMMRInfo', 'a0e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/MinimaEnvelope',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/MinimaEnvelope', 'a83'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/MMRProof',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/MMRProof', '65a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/NodeStatus',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/NodeStatus', '3ee'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/PureMinimaClient',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/PureMinimaClient', 'dc8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/PureMinimaConfig',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/PureMinimaConfig', '547'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/SendParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/SendParams', '27e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TokenInfo',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TokenInfo', 'c1d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnCheckResult',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnCheckResult', '538'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnInputParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnInputParams', 'ece'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnListResult',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnListResult', 'bb0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnMineParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnMineParams', 'c4d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnOutputParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnOutputParams', '786'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnPostParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnPostParams', '2b6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnPostResult',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnPostResult', 'baf'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnScriptParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnScriptParams', '90e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnSignParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnSignParams', '371'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/TxnStateParams',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/TxnStateParams', '0f5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-pureminima-rpc/interfaces/WebhookEntry',
                component: ComponentCreator('/api/totemsdk-pureminima-rpc/interfaces/WebhookEntry', '5d0'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/',
                component: ComponentCreator('/api/totemsdk-realtime/', 'bbd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/classes/BalanceCache',
                component: ComponentCreator('/api/totemsdk-realtime/classes/BalanceCache', 'b76'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/classes/MegBalanceStreamManager',
                component: ComponentCreator('/api/totemsdk-realtime/classes/MegBalanceStreamManager', 'd48'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/functions/createBalanceStreamManager',
                component: ComponentCreator('/api/totemsdk-realtime/functions/createBalanceStreamManager', '6ff'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/BalanceCacheConfig',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/BalanceCacheConfig', '29c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/BalanceCacheDependencies',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/BalanceCacheDependencies', '3e9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/BalanceStreamConfig',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/BalanceStreamConfig', 'e87'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/BalanceStreamListener',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/BalanceStreamListener', '3ca'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/BalanceUpdateEvent',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/BalanceUpdateEvent', '3ce'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/CachedBalance',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/CachedBalance', '144'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/MegBalanceStreamDependencies',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/MegBalanceStreamDependencies', '8f7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/TxConfirmationEvent',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/TxConfirmationEvent', '0a2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/WebSocketMessage',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/WebSocketMessage', '6a4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/interfaces/WebSocketTokenResponse',
                component: ComponentCreator('/api/totemsdk-realtime/interfaces/WebSocketTokenResponse', '341'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-realtime/type-aliases/ConnectionState',
                component: ComponentCreator('/api/totemsdk-realtime/type-aliases/ConnectionState', '26f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-root-identity/',
                component: ComponentCreator('/api/totemsdk-root-identity/', 'ef6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-root-identity/classes/RootIdentityWallet',
                component: ComponentCreator('/api/totemsdk-root-identity/classes/RootIdentityWallet', 'c24'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-root-identity/interfaces/OwnershipProof',
                component: ComponentCreator('/api/totemsdk-root-identity/interfaces/OwnershipProof', 'e46'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-root-identity/interfaces/WotsProof',
                component: ComponentCreator('/api/totemsdk-root-identity/interfaces/WotsProof', '791'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-root-identity/variables/MAX_CHILD_COUNT',
                component: ComponentCreator('/api/totemsdk-root-identity/variables/MAX_CHILD_COUNT', '500'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/',
                component: ComponentCreator('/api/totemsdk-statechain/', '05c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/functions/buildStatechainScript',
                component: ComponentCreator('/api/totemsdk-statechain/functions/buildStatechainScript', '52c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/functions/claimOwnership',
                component: ComponentCreator('/api/totemsdk-statechain/functions/claimOwnership', '351'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/functions/createStateChain',
                component: ComponentCreator('/api/totemsdk-statechain/functions/createStateChain', '345'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/functions/reclaimAbandoned',
                component: ComponentCreator('/api/totemsdk-statechain/functions/reclaimAbandoned', '480'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/functions/scriptAddress',
                component: ComponentCreator('/api/totemsdk-statechain/functions/scriptAddress', '614'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/functions/transferOwnership',
                component: ComponentCreator('/api/totemsdk-statechain/functions/transferOwnership', '997'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/functions/verifyStateChain',
                component: ComponentCreator('/api/totemsdk-statechain/functions/verifyStateChain', 'ab4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/AbandonedProof',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/AbandonedProof', 'df8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/ClaimPayload',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/ClaimPayload', '302'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/SEClient',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/SEClient', '14d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/StateChain',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/StateChain', '8a8'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/StatechainLeaseOps',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/StatechainLeaseOps', '7e1'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/StatechainLeaseProvider',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/StatechainLeaseProvider', '585'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/StatechainOwner',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/StatechainOwner', 'b4f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/TransferRecord',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/TransferRecord', '312'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/VerifyOptions',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/VerifyOptions', 'df7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/interfaces/VerifyResult',
                component: ComponentCreator('/api/totemsdk-statechain/interfaces/VerifyResult', '5cd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/type-aliases/StatechainStatus',
                component: ComponentCreator('/api/totemsdk-statechain/type-aliases/StatechainStatus', 'd86'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-statechain/variables/RECLAIM_TIMELOCK',
                component: ComponentCreator('/api/totemsdk-statechain/variables/RECLAIM_TIMELOCK', '873'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/',
                component: ComponentCreator('/api/totemsdk-tx-builder/', '88b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/classes/CoinSelectionError',
                component: ComponentCreator('/api/totemsdk-tx-builder/classes/CoinSelectionError', '2b7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/classes/CoinSelectionService',
                component: ComponentCreator('/api/totemsdk-tx-builder/classes/CoinSelectionService', 'b3c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/classes/MultisigManager',
                component: ComponentCreator('/api/totemsdk-tx-builder/classes/MultisigManager', '2d7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/functions/addDecimalStrings',
                component: ComponentCreator('/api/totemsdk-tx-builder/functions/addDecimalStrings', '063'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/functions/bigIntToDecimalString',
                component: ComponentCreator('/api/totemsdk-tx-builder/functions/bigIntToDecimalString', 'a68'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/functions/compareDecimal',
                component: ComponentCreator('/api/totemsdk-tx-builder/functions/compareDecimal', 'b77'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/functions/isPositive',
                component: ComponentCreator('/api/totemsdk-tx-builder/functions/isPositive', 'c38'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/functions/parseDecimalToBigInt',
                component: ComponentCreator('/api/totemsdk-tx-builder/functions/parseDecimalToBigInt', 'b92'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/functions/subtractDecimalStrings',
                component: ComponentCreator('/api/totemsdk-tx-builder/functions/subtractDecimalStrings', '9ee'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/CoinFetcher',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/CoinFetcher', '67e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/CoinSelectionOptions',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/CoinSelectionOptions', 'b57'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/CoinSelectionResult',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/CoinSelectionResult', 'fef'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/EnhancedBuildParams',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/EnhancedBuildParams', '07e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/EnhancedCoinInput',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/EnhancedCoinInput', '1cc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/EnhancedCoinOutput',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/EnhancedCoinOutput', 'd89'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/KeyValueStorage',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/KeyValueStorage', '132'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/MultisigConfig',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/MultisigConfig', 'c54'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/MultisigExportData',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/MultisigExportData', '046'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/PendingMultisigTransaction',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/PendingMultisigTransaction', '75f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/interfaces/SpendableCoin',
                component: ComponentCreator('/api/totemsdk-tx-builder/interfaces/SpendableCoin', '6aa'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-tx-builder/type-aliases/SendMode',
                component: ComponentCreator('/api/totemsdk-tx-builder/type-aliases/SendMode', '37f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/',
                component: ComponentCreator('/api/totemsdk-txpow/', '9e2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/calibrateHashRate',
                component: ComponentCreator('/api/totemsdk-txpow/functions/calibrateHashRate', '409'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/computeTxPoWId',
                component: ComponentCreator('/api/totemsdk-txpow/functions/computeTxPoWId', 'f63'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/estimateMiningCost',
                component: ComponentCreator('/api/totemsdk-txpow/functions/estimateMiningCost', '361'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/fetchTxPowTarget',
                component: ComponentCreator('/api/totemsdk-txpow/functions/fetchTxPowTarget', '5f3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/isLessThan',
                component: ComponentCreator('/api/totemsdk-txpow/functions/isLessThan', '3ca'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/mineTxPoW',
                component: ComponentCreator('/api/totemsdk-txpow/functions/mineTxPoW', '513'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/serializeMagic',
                component: ComponentCreator('/api/totemsdk-txpow/functions/serializeMagic', '5d2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/serializeTxBody',
                component: ComponentCreator('/api/totemsdk-txpow/functions/serializeTxBody', 'a21'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/serializeTxHeader',
                component: ComponentCreator('/api/totemsdk-txpow/functions/serializeTxHeader', '179'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/serializeTxPoW',
                component: ComponentCreator('/api/totemsdk-txpow/functions/serializeTxPoW', '08b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/verifyProofOfWork',
                component: ComponentCreator('/api/totemsdk-txpow/functions/verifyProofOfWork', '5a5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/functions/verifyTxPoWWork',
                component: ComponentCreator('/api/totemsdk-txpow/functions/verifyTxPoWWork', '17e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/interfaces/MineOptions',
                component: ComponentCreator('/api/totemsdk-txpow/interfaces/MineOptions', '8f7'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/interfaces/MineResult',
                component: ComponentCreator('/api/totemsdk-txpow/interfaces/MineResult', 'b1d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/interfaces/MiningEstimate',
                component: ComponentCreator('/api/totemsdk-txpow/interfaces/MiningEstimate', '3af'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/interfaces/TxBodyOptions',
                component: ComponentCreator('/api/totemsdk-txpow/interfaces/TxBodyOptions', 'e91'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/interfaces/TxHeaderOptions',
                component: ComponentCreator('/api/totemsdk-txpow/interfaces/TxHeaderOptions', '357'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/interfaces/TxPowParams',
                component: ComponentCreator('/api/totemsdk-txpow/interfaces/TxPowParams', '60c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/interfaces/VerifyResult',
                component: ComponentCreator('/api/totemsdk-txpow/interfaces/VerifyResult', '49c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/type-aliases/TxPoWOptions',
                component: ComponentCreator('/api/totemsdk-txpow/type-aliases/TxPoWOptions', 'bc6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/variables/CASCADE_LEVELS',
                component: ComponentCreator('/api/totemsdk-txpow/variables/CASCADE_LEVELS', '3d4'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/variables/MAIN_NET_CHAIN_ID',
                component: ComponentCreator('/api/totemsdk-txpow/variables/MAIN_NET_CHAIN_ID', 'eb6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/variables/MAX_HASH',
                component: ComponentCreator('/api/totemsdk-txpow/variables/MAX_HASH', 'ca6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/variables/TX_POW_MIN_DIFFICULTY',
                component: ComponentCreator('/api/totemsdk-txpow/variables/TX_POW_MIN_DIFFICULTY', 'd19'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-txpow/variables/ZERO_HASH',
                component: ComponentCreator('/api/totemsdk-txpow/variables/ZERO_HASH', '605'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/',
                component: ComponentCreator('/api/totemsdk-wots-lease/', 'f57'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/AxiaLeaseProvider',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/AxiaLeaseProvider', 'bba'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/DeviceRangeViolationError',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/DeviceRangeViolationError', '6e5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/HybridLeaseProvider',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/HybridLeaseProvider', '3cc'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/LeaseJournal',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/LeaseJournal', 'a3f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/LeaseNotFoundError',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/LeaseNotFoundError', '9ee'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/LocalLeaseProvider',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/LocalLeaseProvider', '1e6'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/OnchainWatermarkNotImplementedError',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/OnchainWatermarkNotImplementedError', '040'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/OnchainWatermarkProvider',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/OnchainWatermarkProvider', '8fd'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/P2PQuorumLeaseProvider',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/P2PQuorumLeaseProvider', '196'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/P2PQuorumNotImplementedError',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/P2PQuorumNotImplementedError', '6d3'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/PersonalLeaseNodeNotConfiguredError',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/PersonalLeaseNodeNotConfiguredError', '179'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/PersonalLeaseNodeProvider',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/PersonalLeaseNodeProvider', '275'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/WatermarkExhaustedError',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/WatermarkExhaustedError', '08e'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/WatermarkMonotonicityError',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/WatermarkMonotonicityError', '9a5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/classes/WotsWatermarkStore',
                component: ComponentCreator('/api/totemsdk-wots-lease/classes/WotsWatermarkStore', '850'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/functions/allocateDeviceRange',
                component: ComponentCreator('/api/totemsdk-wots-lease/functions/allocateDeviceRange', 'c37'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/functions/deviceSlotForAddressIndex',
                component: ComponentCreator('/api/totemsdk-wots-lease/functions/deviceSlotForAddressIndex', 'd86'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/functions/flatIndex',
                component: ComponentCreator('/api/totemsdk-wots-lease/functions/flatIndex', '8df'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/functions/fromFlatIndex',
                component: ComponentCreator('/api/totemsdk-wots-lease/functions/fromFlatIndex', '5be'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/AxiaLeaseProviderConfig',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/AxiaLeaseProviderConfig', '07d'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/ConflictRecord',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/ConflictRecord', '26a'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/DeviceKeyRange',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/DeviceKeyRange', 'a90'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/HybridLeaseProviderConfig',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/HybridLeaseProviderConfig', '57c'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/JournalEntry',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/JournalEntry', '68b'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/LeaseCertificate',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/LeaseCertificate', '115'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/LeaseReservation',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/LeaseReservation', '96f'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/LocalWatermark',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/LocalWatermark', '671'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/PersonalLeaseNodeConfig',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/PersonalLeaseNodeConfig', 'b92'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/ReserveParams',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/ReserveParams', '049'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/SigningIndices',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/SigningIndices', '299'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/SyncResult',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/SyncResult', '9de'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/TreeWatermark',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/TreeWatermark', '348'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/WotsLeaseProvider',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/WotsLeaseProvider', 'fb5'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/interfaces/WotsWatermarkState',
                component: ComponentCreator('/api/totemsdk-wots-lease/interfaces/WotsWatermarkState', 'c33'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/type-aliases/LeaseStatus',
                component: ComponentCreator('/api/totemsdk-wots-lease/type-aliases/LeaseStatus', 'f45'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/api/totemsdk-wots-lease/type-aliases/UnavailableReason',
                component: ComponentCreator('/api/totemsdk-wots-lease/type-aliases/UnavailableReason', '019'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/concepts/agent-policy-overview',
                component: ComponentCreator('/concepts/agent-policy-overview', '545'),
                exact: true,
                sidebar: "conceptsSidebar"
              },
              {
                path: '/concepts/omnia-channels',
                component: ComponentCreator('/concepts/omnia-channels', '1c3'),
                exact: true,
                sidebar: "conceptsSidebar"
              },
              {
                path: '/concepts/totem-connect',
                component: ComponentCreator('/concepts/totem-connect', '60c'),
                exact: true,
                sidebar: "conceptsSidebar"
              },
              {
                path: '/concepts/wots-key-management',
                component: ComponentCreator('/concepts/wots-key-management', '6d6'),
                exact: true,
                sidebar: "conceptsSidebar"
              },
              {
                path: '/guides/channel-factory-wallet',
                component: ComponentCreator('/guides/channel-factory-wallet', 'fbc'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/kissvm-studio',
                component: ComponentCreator('/guides/kissvm-studio', 'f2b'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/machinepay-edge',
                component: ComponentCreator('/guides/machinepay-edge', '2d5'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/omnia-pocket',
                component: ComponentCreator('/guides/omnia-pocket', 'cec'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/omnia-router-node',
                component: ComponentCreator('/guides/omnia-router-node', '347'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/statechain-pass',
                component: ComponentCreator('/guides/statechain-pass', '578'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/tessa-pay',
                component: ComponentCreator('/guides/tessa-pay', '52c'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/totem-community-node',
                component: ComponentCreator('/guides/totem-community-node', '897'),
                exact: true,
                sidebar: "guidesSidebar"
              },
              {
                path: '/guides/totem-personal-node',
                component: ComponentCreator('/guides/totem-personal-node', 'f20'),
                exact: true,
                sidebar: "guidesSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
