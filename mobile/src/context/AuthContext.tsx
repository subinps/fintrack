import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from '../lib/secureStore';
import { useRouter, useSegments } from 'expo-router';
import api, { setTokens, clearTokens, getAccessToken, getRefreshToken } from '../lib/api';
import { initDb } from '../services/localDb';

// Define the shape of the AuthContext
interface AuthContextType {
  user: any | null;
  token: string | null;
  isLoading: boolean;
  signIn: (accessToken: string, refreshToken: string, user: any) => Promise<void>;
  signOut: () => Promise<void>;
  enterLocalMode: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Hook to access the AuthContext
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Load token from storage on startup
  useEffect(() => {
    const loadToken = async () => {
      try {
        const mode = await SecureStore.getItemAsync('app_mode');
        if (mode === 'local') {
          // Initialize DB
          try {
            initDb();
          } catch (e) {
            console.error("DB Init failed", e);
          }

          // Load name from DB
          const { getFirst } = require('../services/localDb');
          const nameSetting = await getFirst("SELECT value FROM settings WHERE key = 'user_name'");
          const name = nameSetting ? nameSetting.value : 'Local User';

          setUser({ id: 'local', name, email: 'local@device' });
          setToken('local-token');
        } else {
          const storedAccessToken = await SecureStore.getItemAsync('accessToken');
          const storedUser = await SecureStore.getItemAsync('user');

          if (storedAccessToken && storedUser) {
            setToken(storedAccessToken);
            setUser(JSON.parse(storedUser));
            // Configure api default header
            api.defaults.headers.common['Authorization'] = `Bearer ${storedAccessToken}`;
          }
        }
      } catch (error) {
        console.error('Failed to load token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  // Handle navigation protection
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated and in auth group
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  useEffect(() => {
    // Axios interceptor for 401 Unauthorized (token refresh is handled in api.ts)
    // This interceptor handles final sign-out when refresh fails
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Don't auto-logout if in local mode
        const isLocal = await SecureStore.getItemAsync('app_mode') === 'local';

        // If still getting 401 after refresh attempt (refresh endpoint returned 401)
        if (error.response?.status === 401 &&
          !isLocal &&
          error.config?.url?.includes('/auth/refresh')) {
          await signOut();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const signIn = async (accessToken: string, refreshToken: string, newUser: any) => {
    setToken(accessToken);
    setUser(newUser);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    await setTokens(accessToken, refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(newUser));
    await SecureStore.setItemAsync('app_mode', 'server');
  };

  const enterLocalMode = async (name: string) => {
    try {
      initDb();
      // Save name to settings
      const { runRun } = require('../services/localDb');
      await runRun("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', ?)", [name]);
    } catch (e) {
      console.error("DB Init failed", e);
    }
    const localUser = { id: 'local', name: name || 'Local User', email: 'local@device' };
    setUser(localUser);
    setToken('local-token');
    await SecureStore.setItemAsync('app_mode', 'local');
  };

  const signOut = useCallback(async () => {
    try {
      // Attempt server-side logout with refresh token
      if (token && token !== 'local-token') {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
          await api.post('/auth/logout', { refreshToken });
        }
      }
    } catch (error) {
      // Ignore logout errors
    }

    await clearTokens();
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('app_mode');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, enterLocalMode }}>
      {children}
    </AuthContext.Provider>
  );
}
