module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: [
    '<rootDir>/packages/**/__tests__/**/*.(ts|js)',
    '<rootDir>/packages/**/?(*.)(spec|test).(ts|js)'
  ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/extensions/',
  ],

  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Map .js-suffixed imports (ESM-style TypeScript source) to their .ts counterparts.
  // Many totem-sdk packages write `import { X } from './types.js'` in TypeScript.
  // In a source-level Jest run there are no .js files — only .ts — so strip the extension.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/packages/$1'
  },

  collectCoverageFrom: [
    'packages/axia-api/src/**/*.{ts,js}',
    '!packages/axia-api/src/**/*.d.ts',
    '!packages/axia-api/src/**/__tests__/**',
    '!packages/axia-api/src/**/test/**'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // JUnit reporter configuration for CI metrics
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'junit.xml',
      suiteName: 'Axia API Tests',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],

  setupFilesAfterEnv: [],

  // Performance settings
  maxWorkers: '50%',
  testTimeout: 10000,
};
