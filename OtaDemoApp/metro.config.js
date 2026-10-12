const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const customOtaRoot = path.resolve(__dirname, '../react-native-custom-ota');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [customOtaRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')]
  }
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
