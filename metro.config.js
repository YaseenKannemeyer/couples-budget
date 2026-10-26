const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// SDK 58 resolves SQLite's web worker even when browser localStorage is used.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');
module.exports = config;
