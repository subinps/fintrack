const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidSplits(config) {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = addSplits(config.modResults.contents);
        } else {
            throw new Error('Cannot add splits to build.gradle because it is not groovy');
        }
        return config;
    });
};

function addSplits(buildGradle) {
    if (buildGradle.includes('splits {')) {
        return buildGradle;
    }

    // Insert splits block inside android { ... }
    // We look for 'androidResources {' as an anchor point inside android block
    const anchor = 'androidResources {';
    const splitsBlock = `
    splits {
        abi {
            reset()
            enable true
            universalApk true
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }
`;
    return buildGradle.replace(anchor, `${splitsBlock}\n    ${anchor}`);
}
