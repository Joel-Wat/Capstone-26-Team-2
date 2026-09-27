import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
    ],
  },

  // Backend
  {
    files: ["Backend/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Other JavaScript files
  {
    files: ["**/*.js"],
    ignores: ["Backend/**/*.js"],
    ...js.configs.recommended,
  },
];
