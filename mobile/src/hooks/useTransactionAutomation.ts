import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { parseSMSWithGemini, getGeminiApiKey } from '../services/gemini';
import { useAddTransaction, useGetAccounts, useAddAccount } from './useQueries';
import { useNotificationListener } from './useNotificationListener';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { AutomationHistoryService } from '../services/automationHistory';

export const useTransactionAutomation = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const addTransaction = useAddTransaction();
    const { data: accounts } = useGetAccounts();
    const addAccount = useAddAccount();

    const handleNotification = useCallback(async (notification: any) => {
        // We rely on the Headless Task to handle everything now to avoid duplicates.
    }, []);

    const { hasPermission, requestPermission } = useNotificationListener(handleNotification);

    return {
        hasPermission,
        requestPermission,
        isProcessing
    };
};
