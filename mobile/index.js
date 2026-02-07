import { AppRegistry } from 'react-native';
import { headlessNotificationHandler } from './src/services/headlessTask';

// Register the headless task for background notifications
AppRegistry.registerHeadlessTask('RNAndroidNotificationListenerHeadlessJs', () => headlessNotificationHandler);

// Import the Expo Router entry point
import 'expo-router/entry';
