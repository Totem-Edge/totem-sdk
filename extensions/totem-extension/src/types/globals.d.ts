/**
 * Webpack DefinePlugin Global Constants
 * 
 * These are compile-time constants injected by webpack.config.js DefinePlugin.
 */

/**
 * DESIGNER_MODE: Compile-time constant for Designer/MockRPC features
 * - false in production builds (build:artifact) - connects to api.axia.to
 * - true in dev builds with DESIGNER_MODE=true - enables mock RPC and Designer features
 */
declare const __DESIGNER_MODE__: boolean;

/**
 * ALLOWED_HOSTS: Compile-time constant for allowed RPC hosts
 * - Production: ['api.axia.to', 'rpc.axia.to']
 * - Development: ['api.axia.to', 'rpc.axia.to', 'localhost', '127.0.0.1']
 */
declare const __ALLOWED_HOSTS__: string[];
