const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidNotificationListener = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = 'com.reactnativenotificationlistener.NotificationListenerService';
    const hasService = mainApplication.service.some(
      (service) => service.$['android:name'] === serviceName
    );

    if (!hasService) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:label': 'Notification Listener',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withAndroidNotificationListener;
