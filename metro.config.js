const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure file watching works properly
config.watchFolders = [__dirname];
config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts],
};

// Reset cache on startup
config.resetCache = true;

module.exports = config;
