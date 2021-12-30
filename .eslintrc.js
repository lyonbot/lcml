'use strict';

var fs = require('fs');
var path = require('path');

var ignoreFilePath = path.join(__dirname, '.gitignore');

module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  ignorePatterns: fs.readFileSync(ignoreFilePath, 'utf8').split('\n').filter(Boolean),
  env: {
    node: true,
    browser: true,
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/ban-ts-comment': 0,
      },
    },
    {
      files: ['*.test.ts', '*.test.js'],
      env: {
        jest: true,
      },
    },
  ],
  rules: {
    'template-curly-spacing': 0,
    'no-dupe-keys': 'error',
  },
};
