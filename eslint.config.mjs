import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The app shells' generated and native build output (docs/architecture/native-apps.md).
    "apps/mobile/android/**",
    "apps/mobile/ios/**",
    "apps/mobile/www/**",
    "apps/desktop/dist/**",
    "apps/desktop/build/**",
    "apps/desktop/offline/**",
  ]),
]);

export default eslintConfig;
