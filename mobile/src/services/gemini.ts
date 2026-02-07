import { GoogleGenerativeAI } from "@google/generative-ai";
import * as SecureStore from 'expo-secure-store';

export const parseSMSWithGemini = async (smsBody: string, apiKey: string, accountNames: string[] = []) => {
    // Legacy single parsing (kept for reference or fallback)
    return processBatchNotifications([{ id: '1', text: smsBody, timestamp: new Date().toISOString() } as any], apiKey, accountNames).then(res => res[0] || null);
};

export const processBatchNotifications = async (notifications: { id: string, text: string, timestamp: string, appName?: string }[], apiKey: string, accountNames: string[] = []) => {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use flash for speed/cost

        const notificationsText = notifications.map(n =>
            `ID: ${n.id}\nApp: ${n.appName || 'Unknown'}\nTime: ${n.timestamp}\nText: "${n.text}"`
        ).join('\n---\n');

        const prompt = `
        You are a financial transaction analyzer.
        Analyze the following list of notifications and extract transaction details.

        Context:
        - Existing Accounts: ${accountNames.join(', ')}
        - Current Date: ${new Date().toISOString().split('T')[0]}

        Instructions:
        1. Identify distinct financial transactions.
        2. **Duplicate Detection**: If multiple notifications refer to the SAME transaction (e.g., same amount, same time, different apps), merge them into a SINGLE transaction.
        3. **Transfer Detection**: If you see a Debit from Account A and a Credit to Account B for the same amount around the same time, combine them into a TRANSFER transaction.
        4. **Bank Perspective**: Remember these are BANK notifications. 
           - "Debit" or "Debited" means money LEFT the account -> EXPENSE or TRANSFER OUT.
           - "Credit" or "Credited" means money ENTERED the account -> INCOME or TRANSFER IN.
           - This is to be inferred only if they use debit or credit word. If they use other words, use common sense. Like Spent , received etc..
        5. **Output**: Return a JSON ARRAY of objects.
        
        Transaction Object Structure:
        {
            "notificationIds": ["id1", "id2"], // List of notification IDs used for this transaction
            "date": "ISO String",
            "description": "Short description",
            "amount": number, // Absolute value
            "type": "INCOME" | "EXPENSE" | "TRANSFER",
            "sourceAccount": "Name of source account (or null)",
            "destinationAccount": "Name of destination account (or null)",
            "confidence": "HIGH" | "MEDIUM" | "LOW"
        }

        Notifications:
        ${notificationsText}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Gemini Batch Processing Error:", error);
        return [];
    }
};

export const getGeminiApiKey = async () => {
    return await SecureStore.getItemAsync('gemini_api_key');
};

export const setGeminiApiKey = async (key: string) => {
    return await SecureStore.setItemAsync('gemini_api_key', key);
};
