import axios from "axios";
import { API_BASE_URL } from "../config";

export const uploadMedia = async (endpoint: string, body: FormData) => {
  let token: string | undefined;
  try {
    const savedDetails = localStorage.getItem("loginUser");
    const parsed = savedDetails ? JSON.parse(savedDetails) : null;
    token = parsed?.token;
  } catch (err) {
    console.error("Error reading token:", err);
  }

  const cleanBase = API_BASE_URL.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const url = `${cleanBase}/${cleanEndpoint}`;

  // Use a clean axios call without inherited default headers
  const response = await axios.post(url, body, {
    headers: {
      Accept: "*/*", // Matches Postman's default
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return response.data;
};

// import axios from "axios";
// import { API_BASE_URL } from "../config";

// export const uploadMedia = async (endpoint: string, body: FormData) => {
//   // 1. Get and parse token from localStorage
//   let token: string | undefined;
//   try {
//     const savedDetails = localStorage.getItem("loginUser");
//     const parsed = savedDetails ? JSON.parse(savedDetails) : null;
//     token = parsed?.token;
//   } catch (err) {
//     console.error("Error reading token:", err);
//   }

//   // 2. Format URL
//   const cleanBase = API_BASE_URL.replace(/\/+$/, "");
//   const cleanEndpoint = endpoint.replace(/^\/+/, "");
//   const url = `${cleanBase}/${cleanEndpoint}`;

//   // 3. Make Axios call
//   const response = await axios.post(url, body, {
//     headers: {
//       // Axios ke default "application/json, text/plain, */*" ko overwrite karke strictly single value bhejega
//       Accept: "application/json",
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     },
//   });

//   return response.data;
// };

//

//

//

//
// import axios from "axios";
// import { API_BASE_URL } from "../config";

// export const uploadMedia = async (endpoint: string, body: FormData) => {
//   // 1. Get and parse token from localStorage
//   let token: string | undefined;
//   try {
//     const savedDetails = localStorage.getItem("loginUser");
//     const parsed = savedDetails ? JSON.parse(savedDetails) : null;
//     token = parsed?.token;
//   } catch (err) {
//     console.error("Error reading token:", err);
//   }

//   // 2. Format URL
//   const cleanBase = API_BASE_URL.replace(/\/+$/, "");
//   const cleanEndpoint = endpoint.replace(/^\/+/, "");
//   const url = `${cleanBase}/${cleanEndpoint}`;

//   // 3. Make Axios call
//   const response = await axios.post(url, body, {
//     headers: {
//       "Content-Type": "multipart/form-data",
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     },
//   });

//   return response.data;
// };
