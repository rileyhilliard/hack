import eslint from '@eslint/js';
import { fileURLToPath } from 'url';
import path from 'path';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  // TypeScript files with type checking (files included in tsconfig.json)
  {
    files: ['src/**/*.ts'],
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'repos/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        warnOnUnsupportedTypeScriptVersion: false,
      },
      globals: {
        // Node.js global variables for all files
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      // ESLint recommended rules
      ...eslint.configs.recommended.rules,

      // TypeScript ESLint recommended rules
      ...tseslint.configs.recommended.rules,

      // Prettier rules to avoid conflicts
      ...prettierConfig.rules,

      // Custom rule overrides
      'no-console': 'off', // Allow console in Node.js
      'no-unused-vars': 'off', // TypeScript handles this
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',

      // Import plugin rules
      'import/extensions': 'off', // Turn off extension requirement for imports
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },

  // TypeScript files without type checking (files not included in tsconfig.json)
  {
    files: ['**/*.ts'],
    ignores: ['src/**/*.ts', 'node_modules/**', 'dist/**', 'build/**', 'repos/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser,
      // No project reference here, so no type checking
      globals: {
        // Node.js global variables for all files
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      // ESLint recommended rules
      ...eslint.configs.recommended.rules,

      // TypeScript ESLint recommended rules (without type checking)
      ...tseslint.configs.recommended.rules,

      // Prettier rules to avoid conflicts
      ...prettierConfig.rules,

      // Custom rule overrides
      'no-console': 'off', // Allow console in Node.js
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Import plugin rules
      'import/extensions': 'off', // Turn off extension requirement for imports
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },

  // JavaScript files
  {
    files: ['**/*.{js,mjs,cjs}'],
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'repos/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js global variables for all files
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      // ESLint recommended rules
      ...eslint.configs.recommended.rules,

      // Prettier rules to avoid conflicts
      ...prettierConfig.rules,

      // Custom rule overrides
      'no-console': 'off', // Allow console in Node.js
      'import/extensions': 'off', // Turn off extension requirement for imports
    },
  },
];
