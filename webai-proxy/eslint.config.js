import eslint from "@eslint/js";
import { fileURLToPath } from 'url';
import path from 'path';
import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser,
      parserOptions: {
        ...tseslint.configs.base.parserOptions,
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
    },
  },
];