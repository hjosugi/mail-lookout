// @ts-check

/**
 * ESLint flat config.
 *
 * Type-aware linting over the whole project. The core layers
 * (domain, i18n, config, shared) are banned from using Office, so
 * the host-independent boundary is enforced by the linter as well
 * as by the type config.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "vite.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // The core layers must stay host-independent. No Office here.
    files: ["src/domain/**/*.ts", "src/i18n/**/*.ts", "src/config/**/*.ts", "src/shared/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "Office",
          message: "Core layers must not use Office. Keep them host-independent.",
        },
      ],
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
);
