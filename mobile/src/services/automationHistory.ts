import * as FileSystem from 'expo-file-system';

const LOG_FILE = FileSystem.documentDirectory + 'automation_logs.json';

export interface AutomationLog {
    id: string;
    timestamp: string;
    notificationText: string;
    status: 'IGNORED' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
    result: string;
    transactionIds?: number[];
    details?: any;
}

export const AutomationHistoryService = {
    async getLogs(): Promise<AutomationLog[]> {
        try {
            const fileInfo = await FileSystem.getInfoAsync(LOG_FILE);
            if (!fileInfo.exists) return [];
            const content = await FileSystem.readAsStringAsync(LOG_FILE);
            return JSON.parse(content);
        } catch (error) {
            console.warn("Failed to read automation logs:", error);
            return [];
        }
    },

    async addLog(log: Omit<AutomationLog, 'id' | 'timestamp'>) {
        try {
            const logs = await this.getLogs();
            const newLog: AutomationLog = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                ...log
            };
            // Keep only last 50 logs
            const updatedLogs = [newLog, ...logs].slice(0, 50);
            await FileSystem.writeAsStringAsync(LOG_FILE, JSON.stringify(updatedLogs));
        } catch (error) {
            console.warn("Failed to write automation log:", error);
        }
    },

    async clearLogs() {
        try {
            await FileSystem.deleteAsync(LOG_FILE, { idempotent: true });
        } catch (error) {
            console.warn("Failed to clear automation logs:", error);
        }
    }
};
