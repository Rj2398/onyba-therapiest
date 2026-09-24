import axios, { Method } from "axios";
import { API_BASE_URL } from "@/src/config";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    try {
      // Always send JSON Content-Type
      config.headers = config.headers || {};
      config.headers["Content-Type"] = "application/json";

      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("loginUser");

        if (stored) {
          const parsed = JSON.parse(stored);

          const token = parsed?.token || parsed?.user_details?.token;

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
    } catch (e) {
      console.error("Request interceptor token check failed:", e);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== "/login"
        ) {
          window.localStorage.removeItem("loginUser");
          window.localStorage.removeItem("onyba_authenticated");

          window.location.href = "/login";
        }
      } catch (e) {
        console.error("Response interceptor auth reset failed:", e);
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
  method = "GET",
  data = null,
  isFormData = false,
}: RequestOptions) => {
  const upperMethod = method.toString().toUpperCase();

  const isForm =
    isFormData || (typeof FormData !== "undefined" && data instanceof FormData);

  const config: any = {
    url: endpoint,
    method: upperMethod as Method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (upperMethod === "GET" && data) {
    config.params = data;
  } else {
    config.data = data;
  }

  const response = await api(config);

  return response.data;
};

// import axios, { Method } from 'axios';
// import { API_BASE_URL } from '@/src/config';

// const api = axios.create({
//   baseURL: API_BASE_URL,
// });

// api.interceptors.request.use(
//   (config) => {
//     try {
//       if (typeof window !== 'undefined') {
//         const stored = window.localStorage.getItem('loginUser');

//         if (stored) {
//           const parsed = JSON.parse(stored);
//           const token = parsed?.token || parsed?.user_details?.token;

//           if (token && config.headers) {
//             config.headers.Authorization = `Bearer ${token}`;
//           }
//         }
//       }
//     } catch (e) {
//       console.error('Request interceptor token check failed:', e);
//     }

//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       try {
//         if (
//           typeof window !== 'undefined' &&
//           window.location.pathname !== '/login'
//         ) {
//           window.localStorage.removeItem('loginUser');
//           window.localStorage.removeItem('onyba_authenticated');
//           window.location.href = '/login';
//         }
//       } catch (e) {
//         console.error('Response interceptor auth reset failed:', e);
//       }
//     }

//     return Promise.reject(error);
//   }
// );

// interface RequestOptions {
//   endpoint: string;
//   method?: Method | string;
//   data?: any;
//   isFormData?: boolean;
// }

// export const requestApi = async ({
//   endpoint,
//   method = 'GET',
//   data = null,
//   isFormData = false,
// }: RequestOptions) => {
//   const upperMethod = method.toString().toUpperCase();

//   const isForm =
//     isFormData ||
//     (typeof FormData !== 'undefined' && data instanceof FormData);

//   const config: any = {
//     url: endpoint,
//     method: upperMethod as Method,
//     headers: {},
//   };

//   // Only set JSON Content-Type for normal requests
//   if (!isForm) {
//     config.headers['Content-Type'] = 'application/json';
//   }

//   if (upperMethod === 'GET' && data) {
//     config.params = data;
//   } else {
//     config.data = data;
//   }

//   const response = await api(config);

//   return response.data;
// };
