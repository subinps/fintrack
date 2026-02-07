const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidAllowBackup = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ensure the manifest object exists
    if (!androidManifest.manifest) {
        return config;
    }

    // Add xmlns:tools if missing
    if (!androidManifest.manifest.$['xmlns:tools']) {
        androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const mainApplication = androidManifest.manifest.application[0];

    // Add tools:replace="android:allowBackup"
    if (mainApplication.$['tools:replace']) {
      const currentReplace = mainApplication.$['tools:replace'];
      if (!currentReplace.includes('android:allowBackup')) {
        mainApplication.$['tools:replace'] = `${currentReplace},android:allowBackup`;
      }
    } else {
      mainApplication.$['tools:replace'] = 'android:allowBackup';
    }

    // Explicitly set android:allowBackup="true" (or false, depending on what we want, but usually true for main app)
    // The error says main app has true, lib has false. We want to keep true (or whatever main app has) and override lib.
    // So just adding tools:replace is enough to say "use mine".
    
    return config;
  });
};

module.exports = withAndroidAllowBackup;
