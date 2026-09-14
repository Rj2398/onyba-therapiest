"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserContextType {
  isAuthenticated: boolean;
  userDetails: any;
  therapistProfile: any; // <-- ADDED
  login: (apiResponseData: any) => void;
  logout: () => void;
  saveTherapistProfile: (data: any) => void; // <-- ADDED
}

export const UserContext = createContext<UserContextType | undefined>(
  undefined
);

export default function UserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [therapistProfile, setTherapistProfile] = useState<any>(null); // Fixed typo from 'setTherapiestProfile'
  const router = useRouter();
  // console.log(userDetails, "userdata *****");

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("loginUser");
      if (stored && stored !== "undefined" && stored !== "null") {
        const data = JSON.parse(stored);
        const token = data?.token || data?.user_details?.token;
        if (token && typeof token === "string" && token.trim() !== "") {
          setIsAuthenticated(true);
          setUserDetails(data);
        } else {
          // Token is missing or empty - clean up corrupted session
          window.localStorage.removeItem("loginUser");
          setIsAuthenticated(false);
          setUserDetails(null);
        }
      }

      // Restore therapist profile from sessionStorage on page load
      const storedProfile = window.sessionStorage.getItem("therapistProfile");
      if (storedProfile) {
        setTherapistProfile(JSON.parse(storedProfile));
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    }
  }, []);

  const login = (data: any) => {
    setIsAuthenticated(true);
    try {
      window.localStorage.setItem("loginUser", JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
    setUserDetails(data);
  };

  // <-- ADDED: Function to store incoming profile response into sessionStorage
  const saveTherapistProfile = (data: any) => {
    setTherapistProfile(data);
    try {
      window.sessionStorage.setItem("therapistProfile", JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save therapist profile:", e);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserDetails(null);
    setTherapistProfile(null); // <-- ADDED: Reset state on logout
    try {
      window.localStorage.removeItem("loginUser");
      window.sessionStorage.removeItem("therapistProfile"); // <-- ADDED: Clear sessionStorage on logout
    } catch (e) {
      console.error(e);
    }
    router.push("/login");
  };

  return (
    <UserContext.Provider
      value={{
        isAuthenticated,
        userDetails,
        therapistProfile, // <-- ADDED
        login,
        logout,
        saveTherapistProfile, // <-- ADDED
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useAuth must be used within a UserProvider");
  }
  return context;
};

// 'use client';

// import React, { createContext, useContext, useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';

// interface UserContextType {
//   isAuthenticated: boolean;
//   userDetails: any;
//   login: (apiResponseData: any) => void;
//   logout: () => void;
// }

// export const UserContext = createContext<UserContextType | undefined>(undefined);

// export default function UserProvider({ children }: { children: React.ReactNode }) {
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [userDetails, setUserDetails] = useState<any>(null);
//   const [therapistProfile, setTherapiestProfile] = useState<any>(null)
//   const router = useRouter();
//   console.log(userDetails, "userdata *****");

//   // Load session from localStorage on mount
//   useEffect(() => {
//     try {
//       const stored = window.localStorage.getItem('loginUser');
//       if (stored) {
//         const data = JSON.parse(stored);
//         if (data) {
//           setIsAuthenticated(true);
//           setUserDetails(data);
//         }
//       }
//     } catch (e) {
//       console.error('Failed to load session:', e);
//     }
//   }, []);

//   const login = (data: any) => {
//     setIsAuthenticated(true);
//     try {
//       window.localStorage.setItem('loginUser', JSON.stringify(data));
//     } catch (e) {
//       console.error(e);
//     }
//     setUserDetails(data);
//   };

//   const logout = () => {
//     setIsAuthenticated(false);
//     setUserDetails(null);
//     try {
//       window.localStorage.removeItem('loginUser');
//     } catch (e) {
//       console.error(e);
//     }
//     router.push('/login');
//   };

//   return (
//     <UserContext.Provider
//       value={{
//         isAuthenticated,
//         userDetails,
//         login,
//         logout,
//       }}
//     >
//       {children}
//     </UserContext.Provider>
//   );
// }

// export const useAuth = () => {
//   const context = useContext(UserContext);
//   if (!context) {
//     throw new Error('useAuth must be used within a UserProvider');
//   }
//   return context;
// };
