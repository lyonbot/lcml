/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  moduleNameMapper: {
  },

  // testMatch: [
  //   "**/__tests__/**/*.[jt]s?(x)",
  //   "**/?(*.)+(spec|test).[tj]s?(x)"
  // ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/.cache/',
    '/dist/',
    '/lib/',
  ],

  transformIgnorePatterns: [
    'node_modules/(?!(lodash-es))',
  ],
};
