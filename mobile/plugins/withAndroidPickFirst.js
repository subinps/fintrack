const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidPickFirst = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `
android {
    packagingOptions {
        pickFirst 'lib/**/libworklets.so'
    }
}
`;
    }
    return config;
  });
};

module.exports = withAndroidPickFirst;
