import { AppRegistry } from 'react-native';
import { headlessNotificationHandler } from './src/services/headlessTask';
import { ExpoRoot } from 'expo-router';

// Register the headless task for background notifications
AppRegistry.registerHeadlessTask('RNAndroidNotificationListenerHeadlessJs', () => headlessNotificationHandler);

export default function App() {
    // @ts-ignore
    const ctx = require.context('./app');
    return <ExpoRoot context={ctx} />;
}
