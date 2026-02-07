import * as Notifications from 'expo-notifications';
import { AutomationHistoryService } from './automationHistory';
import { NotificationStore } from './notificationStore';
import * as SecureStore from 'expo-secure-store';

export const headlessNotificationHandler = async (data: any) => {
    let { notification } = data;

    // Parse if string
    if (typeof notification === 'string') {
        try {
            notification = JSON.parse(notification);
        } catch (e) {
            console.error("[HeadlessTask] Failed to parse notification string:", e);
            return;
        }
    }

    if (!notification) return;

    const text = notification.text || notification.bigText || '';
    const title = notification.title || notification.titleBig || '';
    const subText = notification.subText || '';
    const packageName = notification.app || notification.packageName || 'unknown';

    // Attempt to extract a user-friendly app name
    // Often "title" is the sender name, but sometimes "subText" or "extraInfoText" has the app name if provided by the listener.
    // The listener library usually provides 'app' as package name.
    // We will use package name as fallback, and try to use title if it looks like an app name (hard to tell).
    // For now, we rely on the user to identify the app by package name or context.
    // We will store what we have.
    const appName = packageName; // Default to package name, UI can try to map it or user can rename.

    if (!text && !title) return;


    try {
        // 1. Check Ignored
        const isIgnored = await NotificationStore.isIgnored(packageName);
        if (isIgnored) {
                return;
        }

        // 2. Check Whitelist
        const isWhitelisted = await NotificationStore.isWhitelisted(packageName);

        // 3. Smart Discovery & Keyword Check
        const keywordsStr = await SecureStore.getItemAsync('notification_keywords');
        const keywords = keywordsStr
            ? keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0)
            : ['spent', 'debited', 'credited', 'bank', 'acct', 'txn', 'payment', 'sent', 'received', 'purchase'];

        const fullContent = (title + " " + text + " " + subText).toLowerCase();
        const hasKeyword = keywords.some(k => fullContent.includes(k));

        if (isWhitelisted) {
            if (hasKeyword) {
                        // Proceed to Save
            } else {
                        return;
            }
        } else {
            if (hasKeyword) {
                        await NotificationStore.addWhitelistedApp({
                    packageName,
                    appName,
                    lastSeen: new Date().toISOString()
                });
                // Proceed to Save
            } else {
                        return;
            }
        }

        // 4. Save to Pending
            await NotificationStore.addPending({
            packageName,
            appName,
            title,
            text,
            fullData: notification
        });

        // 4. Notify User (Optional, maybe silent notification or just badge?)
        // Let's send a local notification to tell user we captured something
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Transaction Captured 📸",
                body: "Tap to review and process.",
                data: { url: '/automation' }
            },
            trigger: null,
        });

    } catch (error) {
        console.error("[HeadlessTask] Error:", error);
    }
};
