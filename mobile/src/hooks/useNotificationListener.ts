import { useState, useEffect, useRef } from 'react';
import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import { useAlert } from '../context/AlertContext';

// Get the native module
const { RNAndroidNotificationListener } = NativeModules;

export const useNotificationListener = (onNotificationReceived: (notification: any) => void) => {
    const { showAlert } = useAlert();
    const [hasPermission, setHasPermission] = useState(false);

    // Use a ref to keep track of the latest callback without triggering re-subscriptions
    const callbackRef = useRef(onNotificationReceived);

    useEffect(() => {
        callbackRef.current = onNotificationReceived;
    }, [onNotificationReceived]);

    const checkPermission = async () => {
        if (Platform.OS !== 'android') return;
        try {
            if (!RNAndroidNotificationListener) {
                console.warn("RNAndroidNotificationListener is null. Are you running in Expo Go?");
                return;
            }

            const status = await RNAndroidNotificationListener.getPermissionStatus();
            setHasPermission(status === 'authorized');
        } catch (error) {
            console.error("Error checking permission:", error);
        }
    };

    const requestPermission = async () => {
        if (Platform.OS !== 'android') {
            showAlert("Not Supported", "Notification listening is only available on Android.");
            return;
        }
        if (!RNAndroidNotificationListener) {
            showAlert("Native Module Missing", "This feature requires a custom development build or APK. It will not work in Expo Go.");
            return;
        }
        try {
            await RNAndroidNotificationListener.requestPermission();
            // Check status again after a short delay or immediately
            await checkPermission();
        } catch (error) {
            console.error("Error requesting permission:", error);
        }
    };

    useEffect(() => {
        if (Platform.OS !== 'android') return;
        checkPermission();
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        let subscription: any;
        try {
            // The library uses DeviceEventEmitter to send events
            subscription = DeviceEventEmitter.addListener('notificationReceived', (notification) => {
                    if (!notification) return;

                // Call the latest callback
                if (callbackRef.current) {
                    callbackRef.current(notification);
                }
            });
        } catch (error) {
            console.error("[NotificationListener] Error adding listener:", error);
        }

        return () => {
            if (subscription) {
                    subscription.remove();
            }
        };
    }, []); // Empty dependency array ensures this runs only once!

    return {
        hasPermission,
        requestPermission
    };
};
