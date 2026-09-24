import axios from "axios";
import { API_BASE_URL } from "../config";

export const uploadMedia = async (endpoint: string, body: FormData) => {
  // 1. Get and parse token from localStorage
  let token: string | undefined;
  try {
    const savedDetails = localStorage.getItem("loginUser");
    const parsed = savedDetails ? JSON.parse(savedDetails) : null;
    token = parsed?.token;
  } catch (err) {
    console.error("Error reading token:", err);
  }

  // 2. Format URL
  const cleanBase = API_BASE_URL.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const url = `${cleanBase}/${cleanEndpoint}`;

  // 3. Make Axios call
  const response = await axios.post(url, body, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return response.data;
};
