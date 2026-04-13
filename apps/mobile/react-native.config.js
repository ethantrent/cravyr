// Force React Native CLI to resolve native module paths dynamically via Node
// rather than from any cached config that may contain Windows-style absolute paths.
// This is required for EAS Build in a pnpm monorepo on Linux CI.
module.exports = {
  project: {
    android: {},
    ios: {},
  },
};
