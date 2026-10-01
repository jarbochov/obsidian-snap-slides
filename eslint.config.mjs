import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["main.js", "node_modules/**"]
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["esbuild.config.mjs"],
    rules: {
      "obsidianmd/no-nodejs-modules": "off"
    }
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "esbuild.config.mjs"]
        }
      }
    },
    rules: {
      // Keep the settings tab compatible with the manifest's 1.7.0 minimum.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off"
    }
  }
]);
