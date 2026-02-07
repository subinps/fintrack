import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
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
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Request interceptor - add access token to headers
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor - handle token refresh on 401
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

            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                clearTokens();
                window.dispatchEvent(new CustomEvent('auth:logout'));
                return Promise.reject(error);
            }

            try {
                const response = await axios.post(
                    `${api.defaults.baseURL}/auth/refresh`,
                    { refreshToken }
                );

                const { accessToken } = response.data;
                localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

                processQueue(null, accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError as Error, null);
                clearTokens();
                window.dispatchEvent(new CustomEvent('auth:logout'));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
