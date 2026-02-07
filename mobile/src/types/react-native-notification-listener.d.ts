declare module 'react-native-notification-listener' {
    export interface Notification {
        app?: string;
        title?: string;
        titleBig?: string;
        text?: string;
        subText?: string;
        summaryText?: string;
        bigText?: string;
        audioContentsURI?: string;
        imageBackgroundURI?: string;
        extraInfoText?: string;
        groupedMessages?: any[];
        icon?: string;
        image?: string;
        time?: string;
        packageName?: string;
    }

    export interface NotificationListener {
        getPermissionStatus(): Promise<'authorized' | 'denied' | 'unknown'>;
        requestPermission(): void;
        addListener(callback: (notification: Notification) => void): { remove: () => void };
    }

    const notificationListener: NotificationListener;
    export default notificationListener;
}
