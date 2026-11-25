import packageJson from '../package.json';

/** Single source of truth for the deployed PWA version. */
export const APP_VERSION: string = packageJson.version;
