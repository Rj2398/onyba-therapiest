"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { VideoCallSession } from "./VideoConfrence";
import { requestApi } from "@/src/utils/api";

const VideoConfrence = dynamic(() => import("./VideoConfrence"), {
  ssr: false,
  loading: () => (
    <div
      style={{ textAlign: "center", padding: "60px", fontFamily: "sans-serif" }}
    >
      <h3>Loading video conference...</h3>
    </div>
  ),
});

export type { VideoCallSession };

const isValidCallData = (data: any): boolean => {
  if (!data || typeof data !== "object") return false;
  const appId = data.app_id || data.APP_ID;
  const channelName = data.channel_name;
  const token = data.token;
  const uid = data.therapist_uid ?? data.uid;
  const status = String(data.status || "")
    .toLowerCase()
    .trim();

  // If status is explicitly ended, completed, or cancelled, it's not active
  if (
    status &&
    (status === "completed" || status === "ended" || status === "cancelled")
  ) {
    return false;
  }

  return Boolean(
    appId && channelName && token && uid !== undefined && uid !== null
  );
};

const formatVideoSession = (
  data: any,
  therapySessionId: string,
  patientNameFallback: string
): VideoCallSession => {
  return {
    APP_ID: data.app_id || data.APP_ID || "",
    security: data.security || "",
    channel_name: data.channel_name || "",
    token: data.token || "",
    call_id: data.call_id || data.id,
    uid: data.therapist_uid ?? data.uid,
    patient_uid: data.patient_uid,
    therapist_uid: data.therapist_uid,
    expires_in: data.expires_in ? String(data.expires_in) : "3600",
    therapy_session_id: String(data.therapy_session_id || therapySessionId),
    patient_name:
      data.patient_name || data.patient?.name || patientNameFallback || "",
  };
};

const VideoConferenceContent: React.FC = () => {
  const searchParams = useSearchParams();
  const therapySessionId =
    searchParams.get("therapy_session_id") ||
    searchParams.get("session_id") ||
    searchParams.get("id") ||
    "";
  const patientNameParam =
    searchParams.get("patient_name") ||
    searchParams.get("patient") ||
    searchParams.get("name") ||
    "";

  const [session, setSession] = useState<VideoCallSession | null>(null);
  console.log(session, "session api data");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState<boolean>(true);

  useEffect(() => {
    const initCallSession = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Check if sessionStorage/localStorage has valid start_session_data for this therapySessionId
        if (typeof window !== "undefined") {
          try {
            const cachedDataStr =
              sessionStorage.getItem("start_session_data") ||
              localStorage.getItem("start_session_data");
            if (cachedDataStr) {
              const cachedData = JSON.parse(cachedDataStr);
              const cachedSessionId = String(
                cachedData.therapy_session_id || cachedData.session_id || ""
              );
              if (
                isValidCallData(cachedData) &&
                (!therapySessionId ||
                  !cachedSessionId ||
                  cachedSessionId === String(therapySessionId))
              ) {
                console.log(
                  "Joining existing video call from sessionStorage/localStorage:",
                  cachedData
                );
                const sessionData = formatVideoSession(
                  cachedData,
                  therapySessionId,
                  patientNameParam
                );
                setSession(sessionData);
                setLoading(false);
                return;
              }
            }
          } catch (storageErr) {
            console.error(
              "Error reading start_session_data:",
              storageErr
            );
          }
        }

        // 2. Check get-session-details for start_session key
        if (therapySessionId) {
          try {
            const detailsRes = await requestApi({
              endpoint: `get-session-details/${therapySessionId}`,
              method: "POST",
            });

            const sessionDetails = detailsRes?.data || detailsRes;
            const startSessionObj = sessionDetails?.start_session;

            if (isValidCallData(startSessionObj)) {
              console.log(
                "Joining existing video call from start_session details:",
                startSessionObj
              );
              const sessionData = formatVideoSession(
                {
                  ...startSessionObj,
                  patient_name: sessionDetails?.name || patientNameParam,
                },
                therapySessionId,
                patientNameParam
              );

              if (typeof window !== "undefined") {
                sessionStorage.setItem(
                  "start_session_data",
                  JSON.stringify(sessionData)
                );
                localStorage.setItem(
                  "start_session_data",
                  JSON.stringify(sessionData)
                );
              }

              setSession(sessionData);
              setLoading(false);
              return;
            }
          } catch (detailsErr) {
            console.warn(
              "get-session-details check failed, falling back to therapist-start-call:",
              detailsErr
            );
          }
        }

        // 3. If start_session key is empty, null, or missing credentials, hit therapist-start-call API
        console.log(
          "No valid start_session found, hitting therapist-start-call API..."
        );
        const response = await requestApi({
          endpoint: "therapist-start-call",
          method: "POST",
          data: {
            therapy_session_id: Number(therapySessionId) || therapySessionId,
          },
          isFormData: false,
        });

        if (response && response.data) {
          const data = response.data;
          const sessionData = formatVideoSession(
            data,
            therapySessionId,
            patientNameParam
          );

          if (typeof window !== "undefined") {
            sessionStorage.setItem(
              "start_session_data",
              JSON.stringify(sessionData)
            );
            localStorage.setItem(
              "start_session_data",
              JSON.stringify(sessionData)
            );
          }

          setSession(sessionData);
        } else {
          setError(response?.message || "Failed to start video call session.");
        }
      } catch (err: any) {
        console.error("therapist-start-call error:", err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to start video call. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    initCallSession();
  }, [therapySessionId, patientNameParam]);

  const handleEndCall = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("start_session_data");
        localStorage.removeItem("start_session_data");
      } catch (e) {
        console.error("Error clearing start_session_data:", e);
      }
    }
    setIsCallActive(false);
  };

  const handleRejoin = () => {
    setIsCallActive(true);
  };

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        <h3>Connecting to video conference...</h3>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px",
          color: "red",
          fontFamily: "sans-serif",
        }}
      >
        <h3>Unable to start conference session</h3>
        <p>{error || "No session data received from server."}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "8px 16px", cursor: "pointer", marginTop: "12px" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isCallActive) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        <h2>The call has ended</h2>
        <p>Thank you for attending the session.</p>
        <button
          onClick={handleRejoin}
          style={{
            marginTop: "16px",
            padding: "10px 20px",
            fontSize: "14px",
            cursor: "pointer",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        >
          Rejoin Call
        </button>
      </div>
    );
  }

  return (
    <VideoConfrence
      videoCallSession={session}
      therapySessionId={session.therapy_session_id || therapySessionId}
      patientName={session.patient_name || patientNameParam}
      onEndCall={handleEndCall}
    />
  );
};

const Page: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            fontFamily: "sans-serif",
          }}
        >
          <h3>Loading video conference...</h3>
        </div>
      }
    >
      <VideoConferenceContent />
    </Suspense>
  );
};

export default Page;
