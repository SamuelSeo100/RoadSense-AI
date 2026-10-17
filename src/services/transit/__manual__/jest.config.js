/**
 * Plain Node config for the manual OD run: real `fetch` (the jest-expo
 * preset replaces it). react-native / expo-constants are mocked in the test.
 */
module.exports = {
  // Relative to this file: the repo root.
  rootDir: '../../../..',
  testEnvironment: 'node',
  testMatch: ['**/__manual__/*-manual.ts'],
  transform: { '\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo/virtual/env$': '<rootDir>/src/services/transit/__manual__/env.js',
  },
  globals: { __DEV__: true },
};
