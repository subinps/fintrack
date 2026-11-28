import { AppRegistry, Platform } from 'react-native';
import { headlessNotificationHandler } from './src/services/headlessTask';

// Register the headless task for background notifications (Android only)
if (Platform.OS === 'android' && typeof AppRegistry.registerHeadlessTask === 'function') {
    AppRegistry.registerHeadlessTask('RNAndroidNotificationListenerHeadlessJs', () => headlessNotificationHandler);
}

// Import the Expo Router entry point
import 'expo-router/entry';
