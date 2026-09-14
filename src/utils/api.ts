import axios, { Method } from 'axios';
import { API_BASE_URL } from '@/src/config';

// 1. Create a dedicated Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Request Interceptor: Automatically injects Authorization header
api.interceptors.request.use(
  (config) => {
    try {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('loginUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          const token = parsed?.token || parsed?.user_details?.token;

          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
    } catch (e) {
      console.error('Request interceptor token check failed:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Response Interceptor: Automatically handles unauthorized or expired token sessions
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // If the server returns a 401 Unauthorized, automatically log out
    if (error.response?.status === 401) {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('loginUser');
          window.localStorage.removeItem('onyba_authenticated');
          // Force redirect to login screen
          window.location.href = '/login';
        }
      } catch (e) {
        console.error('Response interceptor auth reset failed:', e);
      }
    }
    return Promise.reject(error);
  }
);

interface RequestOptions {
  endpoint: string;
  method?: Method | string;
  data?: any;
  isFormData?: boolean;
}

export const requestApi = async ({
  endpoint,
  method = 'GET',
  data = null,
  isFormData = false,
}: RequestOptions) => {
  const upperMethod = method.toString().toUpperCase();

  const headers: Record<string, string> = {};
  if (isFormData) {
    headers['Content-Type'] = 'multipart/form-data';
  }

  const config: any = {
    url: endpoint,
    method: upperMethod as Method,
    headers: headers,
  };

  // If GET request, pass data as URL query parameters
  if (upperMethod === 'GET' && data) {
    config.params = data;
  } else {
    config.data = data;
  }

  const response = await api(config);
  return response.data;
};
