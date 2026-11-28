import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from './secureStore';
import { mockApi } from '../services/mockApi';

// Web runs behind Metro's same-origin /api proxy; native talks to the host directly.
const DEFAULT_API_URL = Platform.OS === 'web' ? '/api' : 'http://localhost:3000/api';
const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

const api = axios.create({
    baseURL: API_URL,
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (error: Error) => void }[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token!);
        }
    });
    failedQueue = [];
};

// Token management functions
export const getAccessToken = async () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
export const getRefreshToken = async () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

export const setTokens = async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

// Request interceptor to add auth token and dynamic baseURL
api.interceptors.request.use(
    async (config) => {
        // Handle dynamic baseURL
        const customApiUrl = await SecureStore.getItemAsync('custom_api_url');
        if (customApiUrl) {
            config.baseURL = customApiUrl;
        }

        const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // --- MOCK API INTERCEPTION ---
        const mode = await SecureStore.getItemAsync('app_mode');
        if (mode === 'local') {
            config.adapter = async (config) => {
                const response = await mockApi.handleRequest(config);
                return {
                    data: response.data,
                    status: response.status,
                    statusText: response.status === 200 ? 'OK' : 'Error',
                    headers: {},
                    config: config,
                };
            };
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // If error is 401 and we haven't already retried
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Don't try to refresh on auth/refresh or auth/login endpoints
            if (originalRequest.url?.includes('/auth/refresh') ||
                originalRequest.url?.includes('/auth/login')) {
                return Promise.reject(error);
            }

            // Check if in local mode
            const mode = await SecureStore.getItemAsync('app_mode');
            if (mode === 'local') {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Wait for the refresh to complete
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = await getRefreshToken();
            if (!refreshToken) {
                await clearTokens();
                isRefreshing = false;
                return Promise.reject(error);
            }

            try {
                // Get the base URL for refresh request
                const customApiUrl = await SecureStore.getItemAsync('custom_api_url');
                const baseUrl = customApiUrl || API_URL;

                const response = await axios.post(
                    `${baseUrl}/auth/refresh`,
                    { refreshToken }
                );

                const { accessToken } = response.data;
                await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);

                processQueue(null, accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError as Error, null);
                await clearTokens();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
