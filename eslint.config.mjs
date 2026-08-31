import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", ".pytest_cache/**", "**/__pycache__/**"],
  },
];

export default config;
