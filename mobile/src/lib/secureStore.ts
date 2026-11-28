import { Platform } from 'react-native';
import * as ExpoSecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation. Keys, tokens and small user
// preferences live in localStorage there, which also survives a page reload.
const isWeb = Platform.OS === 'web';

function fallbackStorage(): Storage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
}

export async function getItemAsync(key: string): Promise<string | null> {
    if (!isWeb) return ExpoSecureStore.getItemAsync(key);
    return fallbackStorage()?.getItem(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
    if (!isWeb) {
        await ExpoSecureStore.setItemAsync(key, value);
        return;
    }
    fallbackStorage()?.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
    if (!isWeb) {
        await ExpoSecureStore.deleteItemAsync(key);
        return;
    }
    fallbackStorage()?.removeItem(key);
}
