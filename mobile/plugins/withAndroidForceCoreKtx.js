const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidForceCoreKtx = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `
configurations.all {
    resolutionStrategy {
        force 'androidx.core:core:1.15.0'
        force 'androidx.core:core-ktx:1.15.0'
    }
}
`;
    }
    return config;
  });
};

module.exports = withAndroidForceCoreKtx;
