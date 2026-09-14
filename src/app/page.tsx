"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("loginUser");
      if (stored && stored !== "undefined" && stored !== "null") {
        const parsed = JSON.parse(stored);
        const token = parsed?.token || parsed?.user_details?.token;
        if (token && typeof token === "string" && token.trim() !== "") {
          router.replace("/dashboard");
          return;
        } else {
          window.localStorage.removeItem("loginUser");
        }
      }
    } catch (e) {
      console.error("Auth redirect check failed:", e);
    }
    router.replace("/login");
  }, [router]);

  return null;
}