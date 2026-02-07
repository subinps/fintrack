import * as FileSystem from 'expo-file-system';

const PENDING_FILE = FileSystem.documentDirectory + 'pending_notifications.json';
const WHITELIST_FILE = FileSystem.documentDirectory + 'whitelisted_apps.json';


export interface PendingNotification {
    id: string;
    timestamp: string;
    packageName: string;
    appName: string;
    title: string;
    text: string;
    fullData: any;
}

export interface AppInfo {
    packageName: string;
    appName: string;
    lastSeen: string;
    icon?: string; // Base64 or URI if available
}

export const NotificationStore = {
    // --- Generic File Helpers ---
    async readJSON<T>(fileUri: string, defaultValue: T): Promise<T> {
        try {
            const info = await FileSystem.getInfoAsync(fileUri);
            if (!info.exists) return defaultValue;
            const content = await FileSystem.readAsStringAsync(fileUri);
            return JSON.parse(content);
        } catch (error) {
            console.warn(`Failed to read ${fileUri}:`, error);
            return defaultValue;
        }
    },

    async writeJSON(fileUri: string, data: any) {
        try {
            await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));
        } catch (error) {
            console.warn(`Failed to write ${fileUri}:`, error);
        }
    },

    // --- Pending Notifications ---
    async getPending(): Promise<PendingNotification[]> {
        return this.readJSON<PendingNotification[]>(PENDING_FILE, []);
    },

    async addPending(notification: Omit<PendingNotification, 'id' | 'timestamp'>) {
        const list = await this.getPending();
        const newNotif: PendingNotification = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ...notification
        };
        // Prepend new notification
        await this.writeJSON(PENDING_FILE, [newNotif, ...list]);
    },

    async removePending(ids: string[]) {
        const list = await this.getPending();
        const filtered = list.filter(n => !ids.includes(n.id));
        await this.writeJSON(PENDING_FILE, filtered);
    },

    async clearPending() {
        await this.writeJSON(PENDING_FILE, []);
    },

    // --- Whitelisted Apps ---
    async getWhitelistedApps(): Promise<AppInfo[]> {
        return this.readJSON<AppInfo[]>(WHITELIST_FILE, []);
    },

    async addWhitelistedApp(app: AppInfo) {
        const list = await this.getWhitelistedApps();
        // Update if exists, or add new
        const existingIndex = list.findIndex(a => a.packageName === app.packageName);
        if (existingIndex >= 0) {
            list[existingIndex] = { ...list[existingIndex], ...app, lastSeen: new Date().toISOString() };
        } else {
            list.push({ ...app, lastSeen: new Date().toISOString() });
        }
        await this.writeJSON(WHITELIST_FILE, list);
    },

    async removeWhitelistedApp(packageName: string) {
        const list = await this.getWhitelistedApps();
        const filtered = list.filter(a => a.packageName !== packageName);
        await this.writeJSON(WHITELIST_FILE, filtered);
    },

    async isWhitelisted(packageName: string): Promise<boolean> {
        const list = await this.getWhitelistedApps();
        return list.some(a => a.packageName === packageName);
    },



    // --- Ignored Apps ---
    async getIgnoredApps(): Promise<string[]> {
        return this.readJSON<string[]>(FileSystem.documentDirectory + 'ignored_apps.json', []);
    },

    async addIgnoredApp(packageName: string) {
        const list = await this.getIgnoredApps();
        if (!list.includes(packageName)) {
            list.push(packageName);
            await this.writeJSON(FileSystem.documentDirectory + 'ignored_apps.json', list);
        }
    },

    async removeIgnoredApp(packageName: string) {
        const list = await this.getIgnoredApps();
        const filtered = list.filter(p => p !== packageName);
        await this.writeJSON(FileSystem.documentDirectory + 'ignored_apps.json', filtered);
    },

    async isIgnored(packageName: string): Promise<boolean> {
        const list = await this.getIgnoredApps();
        return list.includes(packageName);
    }
};
