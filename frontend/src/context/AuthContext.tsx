import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setTokens, clearTokens, getAccessToken, hasSessionHint } from '../lib/api';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    login: (accessToken: string, refreshToken: string | undefined, user: User) => void;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const logout = useCallback(async () => {
        try {
            // The HttpOnly refresh cookie is sent with this request and revoked here.
            await api.post('/auth/logout', {});
        } catch (error) {
            // Ignore logout errors
        }
        clearTokens();
        setUser(null);
    }, []);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                if (!getAccessToken()) {
                    if (!hasSessionHint()) {
                        // Never signed in here: no cookie to exchange.
                        setIsLoading(false);
                        return;
                    }
                    // Reload after the access token expired: try the HttpOnly cookie.
                    const refreshed = await api.post('/auth/refresh', {});
                    setTokens(refreshed.data.accessToken);
                }
                const me = await api.get('/auth/me');
                setUser(me.data);
            } catch {
                clearTokens();
            } finally {
                setIsLoading(false);
            }
        };

        void bootstrap();
    }, []);

    useEffect(() => {
        const handleLogout = () => {
            setUser(null);
        };

        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, []);

    const login = (accessToken: string, refreshToken: string | undefined, user: User) => {
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
