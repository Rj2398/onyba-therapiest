"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { VideoCallSession } from "./VideoConfrence";
import { requestApi } from "@/src/utils/api";

const VideoConfrence = dynamic(() => import("./VideoConfrence"), {
  ssr: false,
  loading: () => (
    <div style={{ textAlign: "center", padding: "60px", fontFamily: "sans-serif" }}>
      <h3>Loading video conference...</h3>
    </div>
  ),
});

export type { VideoCallSession };

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState<boolean>(true);

  useEffect(() => {
    const startCall = async () => {
      try {
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("therapy_session_id", therapySessionId);

        const response = await requestApi({
          endpoint: "therapist-start-call",
          method: "POST",
          data: formData,
          isFormData: true,
        });

        if (response && response.data) {
          const data = response.data;
          const sessionData: VideoCallSession = {
            APP_ID: data.app_id,
            security: data.security || "",
            channel_name: data.channel_name || "",
            token: data.token || "",
            call_id: data.call_id,
            uid: data.uid,
            expires_in: data.expires_in,
            therapy_session_id: therapySessionId,
            patient_name: data.patient_name || data.patient?.name || patientNameParam || "",
          };
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

    startCall();
  }, [therapySessionId, patientNameParam]);

  const handleEndCall = () => {
    setIsCallActive(false);
  };

  const handleRejoin = () => {
    setIsCallActive(true);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", fontFamily: "sans-serif" }}>
        <h3>Connecting to video conference...</h3>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "red", fontFamily: "sans-serif" }}>
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
      <div style={{ textAlign: "center", padding: "60px", fontFamily: "sans-serif" }}>
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
        <div style={{ textAlign: "center", padding: "60px", fontFamily: "sans-serif" }}>
          <h3>Loading video conference...</h3>
        </div>
      }
    >
      <VideoConferenceContent />
    </Suspense>
  );
};

export default Page;
