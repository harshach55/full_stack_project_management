// Expo's default Metro configuration. It detects the pnpm workspace (the repository root),
// so the compiled @pm/shared package and the app's own dependencies resolve without extra
// settings (validated in Phase 7, ADR-0008).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
