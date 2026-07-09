/**
 * SDK Core Version Information
 * 
 * CORE_BUILD_ID is used to detect bundle duplication issues where
 * the extension might bundle two different copies of sdk-core,
 * computing addresses with one copy and signing with another.
 * 
 * If you see different CORE_BUILD_IDs logged from wallet creation
 * vs signing modules, there's a bundling issue.
 */

export const CORE_BUILD_ID = '2026.02.05-v1';
export const CORE_VERSION = '1.0.0';
