import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setTokens, clearTokens, getAccessToken, getRefreshToken } from '../lib/api';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    login: (accessToken: string, refreshToken: string, user: User) => void;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const logout = useCallback(async () => {
        try {
            const refreshToken = getRefreshToken();
            if (refreshToken) {
                await api.post('/auth/logout', { refreshToken });
            }
        } catch (error) {
            // Ignore logout errors
        }
        clearTokens();
        setUser(null);
    }, []);

    useEffect(() => {
        const token = getAccessToken();
        if (token) {
            api.get('/auth/me')
                .then((res) => {
                    setUser(res.data);
                })
                .catch(() => {
                    clearTokens();
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, []);

    // Listen for auth:logout event from API interceptor
    useEffect(() => {
        const handleLogout = () => {
            setUser(null);
        };

        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, []);

    const login = (accessToken: string, refreshToken: string, user: User) => {
        setTokens(accessToken, refreshToken);
        setUser(user);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
