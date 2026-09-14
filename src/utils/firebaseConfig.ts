// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDImTRWd5Q4l8zgx2JJDH1WINT0_AQ41RQ",
    authDomain: "onyba-app.firebaseapp.com",
    projectId: "onyba-app",
    storageBucket: "onyba-app.firebasestorage.app",
    messagingSenderId: "269246565948",
    appId: "1:269246565948:web:4afb81b8de6efb66537d39",
    measurementId: "G-81VXF3Z626"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics & Firestore
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const db = getFirestore(app);

export default app;