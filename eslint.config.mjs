import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      "lib/database/types.ts",
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "ascendia-extension/assets/thinking-orbs-engine.js",
    ],
  },
  {
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/*.guardrails.test.ts"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
