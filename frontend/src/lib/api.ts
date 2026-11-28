import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    // The refresh token lives in an HttpOnly cookie, so every request carries cookies.
    withCredentials: true,
});

// Only the short-lived access token is kept in the browser. The refresh token is
// HttpOnly and never touches JavaScript or localStorage.
const ACCESS_TOKEN_KEY = 'accessToken';
const LEGACY_REFRESH_TOKEN_KEY = 'refreshToken';
const SESSION_HINT_KEY = 'sessionHint';

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

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

// A hint that this browser had a session, so the app only tries a cookie refresh
// when one could exist (avoids a 400 on every signed-out page load).
export const hasSessionHint = () => localStorage.getItem(SESSION_HINT_KEY) === '1';

export const setAccessToken = (accessToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(SESSION_HINT_KEY, '1');
};

/** Kept for call sites that still pass a refresh token; it is deliberately ignored. */
export const setTokens = (accessToken: string, refreshToken?: string) => {
    void refreshToken;
    setAccessToken(accessToken);
};

export const clearTokens = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_HINT_KEY);
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (originalRequest.url?.includes('/auth/refresh') ||
                originalRequest.url?.includes('/auth/login')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
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

            try {
                // No token in the body: the browser sends the HttpOnly cookie instead.
                const response = await axios.post(
                    `${api.defaults.baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                const { accessToken } = response.data;
                setAccessToken(accessToken);

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
