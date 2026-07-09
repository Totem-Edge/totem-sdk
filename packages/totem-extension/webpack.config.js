const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

// Production Safety: Prevent shipping dev config
const VITE_AXIA_API_URL = process.env.VITE_AXIA_API_URL;
const VITE_AXIA_PROJECT_ID = process.env.VITE_AXIA_PROJECT_ID;
const NODE_ENV = process.env.NODE_ENV || 'production';
const isProduction = NODE_ENV === 'production';
// DESIGNER_MODE: Compile-time constant for Designer/MockRPC features
// - false in production builds (build:artifact) - connects to api.axia.to
// - true in dev builds (dev, dev:ui) - enables mock RPC and Designer features
const DESIGNER_MODE = process.env.DESIGNER_MODE === 'true' && !isProduction;

if (isProduction && (VITE_AXIA_API_URL || VITE_AXIA_PROJECT_ID)) {
  console.error('❌ PRODUCTION BUILD FAILED - DEV CONFIGURATION DETECTED');
  console.error('');
  console.error('The following environment variables are set:');
  if (VITE_AXIA_API_URL) console.error(`  VITE_AXIA_API_URL = ${VITE_AXIA_API_URL}`);
  if (VITE_AXIA_PROJECT_ID) console.error(`  VITE_AXIA_PROJECT_ID = ${VITE_AXIA_PROJECT_ID}`);
  console.error('');
  console.error('These are Designer mode development variables and MUST NOT be included in production builds.');
  console.error('');
  console.error('To fix this:');
  console.error('  1. Remove VITE_* variables from .env or environment');
  console.error('  2. Run: unset VITE_AXIA_API_URL VITE_AXIA_PROJECT_ID');
  console.error('  3. Rebuild: npm run build');
  console.error('');
  process.exit(1);
}

if (!isProduction && (VITE_AXIA_API_URL || VITE_AXIA_PROJECT_ID)) {
  console.warn('⚠️  DEV MODE: Designer mode environment variables detected');
  console.warn(`   VITE_AXIA_API_URL: ${VITE_AXIA_API_URL || 'not set'}`);
  console.warn(`   VITE_AXIA_PROJECT_ID: ${VITE_AXIA_PROJECT_ID || 'not set'}`);
  console.warn('   These will be used for Live Testing Mode in dev-popup.html');
  console.warn('');
}

// Production Safety Plugin: Block dev-only imports
class BlockDevImportsPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('BlockDevImportsPlugin', (compilation) => {
      compilation.hooks.buildModule.tap('BlockDevImportsPlugin', (module) => {
        if (isProduction && module.resource) {
          // Normalize path separators for cross-platform compatibility (Windows uses backslashes)
          const normalizedPath = module.resource.replace(/\\/g, '/');
          
          // Fail build if src/dev/ code is imported in production
          if (normalizedPath.includes('/src/dev/')) {
            const error = new Error(
              `❌ PRODUCTION BUILD FAILED - DEVELOPMENT CODE DETECTED\n\n` +
              `File: ${module.resource}\n\n` +
              `The 'src/dev/' directory contains development-only code (mock RPC, test utilities)\n` +
              `that MUST NOT be included in production builds.\n\n` +
              `This is a critical security violation. Check your imports and remove any references to:\n` +
              `  - src/dev/mock-rpc/*\n` +
              `  - src/dev/*\n\n`
            );
            compilation.errors.push(error);
          }
        }
      });
    });
  }
}

if (isProduction) {
  console.log('🔒 Production safety checks enabled:');
  console.log('   - Dev environment variables blocked');
  console.log('   - src/dev/ imports blocked');
  console.log('   - Mock RPC excluded from build');
}

// ============================================================================
// SHARED CONFIGURATION
// ============================================================================
const sharedConfig = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: false,  // Don't clean - multi-compiler builds will coordinate
    globalObject: 'globalThis'
  },
  watchOptions: {
    // Ignore node_modules and dist to avoid exhausting OS inotify watchers.
    // Without this, webpack --watch claims thousands of inotify slots, leaving
    // none for Vite's HMR — causing the Axia Dashboard to reload on every rebuild.
    ignored: ['**/node_modules/**', '**/dist/**'],
    aggregateTimeout: 300,  // Wait 300ms after last change before rebuilding
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: [
          /node_modules/,
          // SECURITY: Exclude all development-only code from production builds
          // Mock RPC, dev tools, and test utilities must never ship to production
          // Cross-platform regex handles both forward and backward slashes
          /src[\/\\]dev[\/\\]/
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    fallback: {
      "buffer": require.resolve("buffer"),
      "fs": false,
      "path": false
    }
  },
  mode: 'production',
  externals: {
    'chrome': 'chrome'
  },
  optimization: {
    splitChunks: false,  // Disable all code splitting to prevent chunk loading issues
    runtimeChunk: false,  // Keep runtime in main chunks
    minimize: true,
    usedExports: true
  }
};

// ============================================================================
// BACKGROUND SERVICE WORKER CONFIGURATION (NO DOM, NO CSS)
// ============================================================================
const backgroundConfig = {
  ...sharedConfig,
  name: 'background',
  entry: {
    background: './src/background/index.ts'
  },
  target: 'webworker',  // Service worker environment - NO DOM APIs
  output: {
    ...sharedConfig.output,
    chunkLoading: false,  // Disable chunk loading - inline all dynamic imports
    wasmLoading: false     // Disable WASM loading
  },
  plugins: [
    new BlockDevImportsPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'typeof document': JSON.stringify('undefined'),
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
      'process.env.WOTS_PARAMSET': JSON.stringify(process.env.WOTS_PARAMSET || 'v2-spec'),
      'process.env.WOTS_ALLOW_V1_DEV': JSON.stringify(process.env.WOTS_ALLOW_V1_DEV || ''),
      
      // DESIGNER_MODE: Compile-time constant for Designer/MockRPC features
      // Production builds = false (always connects to api.axia.to)
      // Dev builds = true only when DESIGNER_MODE env var is set
      '__DESIGNER_MODE__': JSON.stringify(DESIGNER_MODE),
      
      // Security: Compile-time injection of allowed RPC hosts
      '__ALLOWED_HOSTS__': JSON.stringify(
        isProduction
          ? ['api.axia.to', 'rpc.axia.to']
          : ['api.axia.to', 'rpc.axia.to', 'localhost', '127.0.0.1']
      )
    })
  ],
  // NO CSS LOADERS - service workers cannot manipulate DOM
  module: {
    rules: [
      ...sharedConfig.module.rules
      // Deliberately NO CSS rule here
    ]
  }
};

// ============================================================================
// UI CONFIGURATION (DOM, CSS, REACT)
// ============================================================================
const uiConfig = {
  ...sharedConfig,
  name: 'ui',
  entry: {
    'content-script': './src/content-script.ts',
    'src/provider': './src/provider.ts',
    popup: './src/ui/popup/main.tsx',
    notify: './src/ui/notify/main.tsx',
    verify: './src/ui/verify/main.tsx',
    connect: './src/ui/connect/main.tsx',
    unlock: './src/ui/unlock/main.tsx',
    scanner: './src/ui/scanner/main.tsx',
    'prove-ownership': './src/ui/prove-ownership/main.tsx'
  },
  target: 'web',  // Browser DOM environment
  plugins: [
    new BlockDevImportsPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'index.html', to: 'index.html' },
        { from: 'demo.html', to: 'demo.html' },
        { from: 'popup-prod.html', to: 'popup.html' },
        { from: 'icons', to: 'icons' },
        { from: 'src/approval/verify.html', to: 'verify.html' },
        { from: 'src/approval/connect.html', to: 'connect.html' },
        { from: 'src/approval/tx.html', to: 'approval/tx.html' },
        { from: 'src/approval/permissions.html', to: 'approval/permissions.html' },
        { from: 'src/approval/unlock.html', to: 'unlock.html' },
        { from: 'src/approval/prove-ownership.html', to: 'prove-ownership.html' },
        { from: 'scanner.html', to: 'scanner.html' },
        // WASM mining engine — fetched by the service worker via chrome.runtime.getURL
        { from: 'node_modules/@totemsdk/txpow/src/wasm/miner.wasm', to: 'miner.wasm' }
        // SECURITY: dev-popup.html deliberately excluded from production build
        // It contains hardcoded test mnemonics for development only
        // Production uses CSPRNG via bip39.generateMnemonic(256) in background service
      ]
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
      'process.env.WOTS_PARAMSET': JSON.stringify(process.env.WOTS_PARAMSET || 'v2-spec'),
      'process.env.WOTS_ALLOW_V1_DEV': JSON.stringify(process.env.WOTS_ALLOW_V1_DEV || ''),
      
      // DESIGNER_MODE: Compile-time constant for Designer/MockRPC features
      // Production builds = false (always connects to api.axia.to)
      // Dev builds = true only when DESIGNER_MODE env var is set
      '__DESIGNER_MODE__': JSON.stringify(DESIGNER_MODE),
      
      // Security: Compile-time injection of allowed RPC hosts
      '__ALLOWED_HOSTS__': JSON.stringify(
        isProduction
          ? ['api.axia.to', 'rpc.axia.to']
          : ['api.axia.to', 'rpc.axia.to', 'localhost', '127.0.0.1']
      )
    })
  ],
  module: {
    rules: [
      ...sharedConfig.module.rules,
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
        sideEffects: true
      }
    ]
  }
  // Note: clean removed - will be handled by npm script (rm -rf dist before build)
};

// ============================================================================
// MULTI-COMPILER EXPORT
// ============================================================================
console.log('📦 Webpack Multi-Compiler Configuration:');
console.log('   1. UI (web): popup.js, content-script.js, notify.js - WITH CSS (cleans dist)');
console.log('   2. Background (webworker): background.js - NO CSS, NO DOM (appends to dist)');
console.log('');

// Export array for multi-compiler mode
// Order matters: UI cleans first, background appends second
module.exports = [uiConfig, backgroundConfig];
