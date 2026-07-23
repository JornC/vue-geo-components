import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import skipFormattingConfig from "@vue/eslint-config-prettier/skip-formatting";

export default defineConfigWithVueTs(
  {
    name: "app/files-to-ignore",
    ignores: ["dist/**", "node_modules/**"],
  },

  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,

  {
    files: ["**/*.{js,mjs,ts,vue}"],
    rules: {
      eqeqeq: "error",
      curly: "error",
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "no-debugger": "warn",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  {
    name: "geo/layer-model",
    files: ["src/layers/types.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Must be last: turns off every rule that Prettier owns.
  skipFormattingConfig,
);
