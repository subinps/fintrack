const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidSigning(config) {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = addSigning(config.modResults.contents);
        } else {
            throw new Error('Cannot add signing to build.gradle because it is not groovy');
        }
        return config;
    });
};

function addSigning(buildGradle) {
    if (buildGradle.includes('MYAPP_UPLOAD_STORE_FILE')) {
        return buildGradle;
    }

    // Replace the default release signing config
    const defaultSigning = `signingConfig signingConfigs.debug`;
    const customSigning = `if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            } else {
                signingConfig signingConfigs.debug
            }`;

    // We need to be careful with replacement to target the release block
    // Using a regex to find the release block is safer but complex in groovy
    // Simpler approach: replace the specific line inside release block if possible, 
    // or just replace the first occurrence after 'buildTypes {' -> 'release {'

    // Let's try a replacement that looks for the context
    // The default expo template usually has:
    // release {
    //   ...
    //   signingConfig signingConfigs.debug
    //   ...
    // }

    // We can look for the specific pattern. If exact match fails, we might need a more robust regex.
    // Given we are controlling the prebuild, the template is standard.

    const pattern = /release\s*\{[^}]*signingConfig\s+signingConfigs\.debug/s;

    if (pattern.test(buildGradle)) {
        return buildGradle.replace('signingConfig signingConfigs.debug', customSigning);
    }

    return buildGradle;
}
