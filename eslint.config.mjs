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
    // ol is ESM with no exports map, so Node resolves a subpath as a literal
    // file path. Bundlers guess the extension, Node does not, and what we
    // publish has to resolve for consumers running outside a bundler.
    // See https://github.com/openlayers/openlayers/issues/13114
    name: "geo/ol-import-extensions",
    files: ["**/*.{js,mjs,ts,vue}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Any ol subpath not ending in .js. A group glob cannot express
              // this: gitignore semantics refuse to re-include a path whose
              // parent the group already matched.
              regex: "^ol/(?!.*\\.js$)",
              message: "Import ol subpaths with their .js extension (ol/Map.js), or Node cannot resolve them.",
            },
          ],
        },
      ],
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
