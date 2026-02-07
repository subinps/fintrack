const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidRemoveBundleCompression = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = config.modResults.contents.replace(
        /^\s*enableBundleCompression\s*=\s*.*$/gm,
        "// enableBundleCompression removed by config plugin"
      );
    }
    return config;
  });
};

module.exports = withAndroidRemoveBundleCompression;
