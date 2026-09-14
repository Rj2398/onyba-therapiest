"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import EndSession from "@/src/component/meetingmodal/EndSession";
import AgoraRTC, {
  AgoraRTCProvider,
  useRTCClient,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  usePublish,
  useJoin,
  useRemoteUsers,
  LocalUser,
  RemoteUser,
} from "agora-rtc-react";
import { requestApi } from "@/src/utils/api";
import { Base_image_url } from "@/src/config";
import { db } from "@/src/utils/firebaseConfig";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface FirebaseChatMessage {
  id?: string;
  message?: string;
  text?: string;
  senderId?: string;
  receiverId?: string;
  seen?: boolean;
  timestamp?: any;
  sender?: string;
  sender_name?: string;
  sender_type?: string;
  sender_id?: string | number;
  created_at?: any;
}

export interface VideoCallSession {
  APP_ID: string;
  security: string;
  channel_name: string;
  token: string;
  call_id?: number | string;
  uid?: number | string;
  expires_in?: string;
  therapy_session_id?: string;
  patient_name?: string;
}

export interface VideoConferenceProps {
  videoCallSession: VideoCallSession;
  therapySessionId?: string;
  patientName?: string;
  onEndCall?: () => void;
}

const getDocList = (docData: any) => {
  if (!docData) return [];

  const processSingleDoc = (item: any, idx: number) => {
    if (!item) return null;
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) return null;
      const parts = trimmed.split("/");
      const fileName = parts[parts.length - 1] || trimmed;
      const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toUpperCase() : "DOC";
      const fullUrl =
        trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")
          ? trimmed
          : `${Base_image_url.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
      return {
        id: idx,
        file_name: fileName,
        file_type: ext,
        file_url: fullUrl,
      };
    }
    if (typeof item === "object") {
      const rawUrl = item.file_url || item.url || item.path || item.file_name || "";
      const fullUrl = rawUrl
        ? rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")
          ? rawUrl
          : `${Base_image_url.replace(/\/+$/, "")}/${rawUrl.replace(/^\/+/, "")}`
        : "";
      const fileName = item.file_name || item.name || (rawUrl ? rawUrl.split("/").pop() : `Document_${idx + 1}`);
      const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
      const fileType = item.file_type || item.ext || (extMatch ? extMatch[1].toUpperCase() : "PDF");

      return {
        ...item,
        id: item.id || idx,
        file_name: fileName,
        file_type: fileType,
        file_url: fullUrl,
      };
    }
    return null;
  };

  if (typeof docData === "string") {
    const paths = docData.split(",").map((s) => s.trim()).filter(Boolean);
    return paths.map((path, idx) => processSingleDoc(path, idx)).filter(Boolean);
  }

  if (Array.isArray(docData)) {
    return docData.map((item, idx) => processSingleDoc(item, idx)).filter(Boolean);
  }

  if (typeof docData === "object") {
    const doc = processSingleDoc(docData, 0);
    return doc ? [doc] : [];
  }

  return [];
};

// 1. Inner Room Component containing all Agora Hooks & UI
const VideoRoomInner: React.FC<VideoConferenceProps> = ({
  videoCallSession,
  therapySessionId,
  patientName,
  onEndCall,
}) => {
  const searchParams = useSearchParams();
  // console.log(videoCallSession, "video call session***");
  const appIdToUse =
    videoCallSession.APP_ID;
  const { channel_name, token } = videoCallSession;
  const loginUserData = typeof window !== 'undefined' ? localStorage.getItem('loginUser') : null;
  const parsedUser = loginUserData ? JSON.parse(loginUserData) : null;

  // Get the full name with Dr. prefix
  const doctorFirstName = parsedUser?.user?.name || 'Doctor';
  const doctorLastName = parsedUser?.user?.surname_one || '';
  const doctorFullName = `Dr. ${doctorFirstName} ${doctorLastName}`.trim();

  // Get profile picture from localStorage loginUser
  const rawDoctorImg = parsedUser?.user?.profile_image || parsedUser?.profile_image;
  const doctorProfileImgUrl = rawDoctorImg
    ? (rawDoctorImg.startsWith("http") || rawDoctorImg.startsWith("data:") || rawDoctorImg.startsWith("/")
      ? rawDoctorImg
      : `${Base_image_url}${rawDoctorImg.startsWith("/") ? "" : "/"}${rawDoctorImg}`)
    : "/images/dash-user-icon.svg";

  // Agora Hooks (Initialize tracks as ready)
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(true);
  const { localCameraTrack } = useLocalCameraTrack(true);
  const remoteUsers = useRemoteUsers();

  const primaryRemoteUser = remoteUsers[0];

  // Dynamic Patient Name detection
  const dynamicPatientName =
    patientName ||
    videoCallSession?.patient_name ||
    searchParams.get("patient_name") ||
    searchParams.get("patient") ||
    searchParams.get("name") ||
    (primaryRemoteUser ? `Patient (${primaryRemoteUser.uid})` : "John Carter");
  const [micActive, setMicActive] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [joinedCallData, setJoinedCallData] = useState<any>(null);

  // Global Profile Image & Display Name States
  const [therapistImgUrl, setTherapistImgUrl] = useState<string>("");
  const [therapistDisplayName, setTherapistDisplayName] = useState<string>("");
  const [patientImgUrl, setPatientImgUrl] = useState<string>("");
  const [patientDisplayName, setPatientDisplayName] = useState<string>("");

  // Firebase Real-time Chat States
  const [chatMessages, setChatMessages] = useState<FirebaseChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState<string>("");
  const chatTimelineRef = useRef<HTMLDivElement>(null);

  // Extract raw session ID
  const rawSessionId =
    therapySessionId ||
    videoCallSession?.therapy_session_id ||
    searchParams.get("therapy_session_id") ||
    searchParams.get("session_id") ||
    searchParams.get("id");

  // console.log(rawSessionId, "Raw session id **_");

  // Private Notes State & Rich Text Editor Handlers
  const [privateNotesText, setPrivateNotesText] = useState<string>("");
  const [isSubmittingPrivateNotes, setIsSubmittingPrivateNotes] = useState<boolean>(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState<boolean>(false);
  const privateNotesEditorRef = useRef<HTMLDivElement>(null);

  const execNotesCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (privateNotesEditorRef.current) {
      privateNotesEditorRef.current.focus();
      setPrivateNotesText(privateNotesEditorRef.current.innerHTML);
    }
  };

  const clearPrivateNotes = () => {
    setPrivateNotesText("");
    if (privateNotesEditorRef.current) {
      privateNotesEditorRef.current.innerHTML = "";
    }
  };

  const handleSavePrivateNotes = async () => {
    if (!rawSessionId) {
      toast.error("Session ID is required to save notes.");
      return;
    }

    setIsSubmittingPrivateNotes(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(rawSessionId));
      formData.append("type", "private");
      formData.append("notes", privateNotesText);

      const response = await requestApi({
        endpoint: "submit-notes",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && (response.success || response.code === 200 || response.status)) {
        toast.success("Private notes submitted successfully!");
      } else {
        toast.error(response?.message || "Failed to submit private notes.");
      }
    } catch (err: any) {
      console.error("Error submitting private notes:", err);
      toast.error(err?.response?.data?.message || err?.message || "Error submitting private notes");
    } finally {
      setIsSubmittingPrivateNotes(false);
    }
  };

  // Documents & Attachments States
  const [docTab, setDocTab] = useState<"therapist" | "patient">("therapist");
  const [therapistDocuments, setTherapistDocuments] = useState<any[]>([]);
  const [patientDocuments, setPatientDocuments] = useState<any[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [isFetchingDocs, setIsFetchingDocs] = useState<boolean>(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const fetchSessionDocuments = useCallback(async () => {
    const sessionId =
      therapySessionId ||
      videoCallSession?.therapy_session_id ||
      searchParams.get("therapy_session_id") ||
      searchParams.get("session_id") ||
      searchParams.get("id");

    if (!sessionId) return;

    setIsFetchingDocs(true);
    try {
      const response = await requestApi({
        endpoint: `get-session-documents/${sessionId}`,
        method: "POST",
      });

      console.log("Fetched get-session-documents response:", response);

      const docData = response?.data?.documents || response?.data || response?.documents || response;
      if (docData) {
        const therapistDocs = getDocList(
          docData.therapist_document || docData.shared_by_therapist || docData.therapist_documents
        );
        const patientDocs = getDocList(
          docData.patient_document || docData.shared_by_patient || docData.patient_documents
        );
        setTherapistDocuments(therapistDocs);
        setPatientDocuments(patientDocs);
      }
    } catch (err) {
      console.error("Error fetching session documents in VideoConfrence:", err);
    } finally {
      setIsFetchingDocs(false);
    }
  }, [therapySessionId, videoCallSession, searchParams]);

  useEffect(() => {
    fetchSessionDocuments();
  }, [fetchSessionDocuments]);

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !rawSessionId) return;

    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(rawSessionId));
      formData.append("type", "therapist");
      formData.append("document", file);

      const response = await requestApi({
        endpoint: "upload-session-documents",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && (response.success || response.code === 200 || response.status)) {
        toast.success("Document uploaded successfully!");
        const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
        const uploadedDocObj = {
          id: Date.now(),
          file_name: file.name,
          file_type: extMatch ? extMatch[1].toUpperCase() : "DOC",
          file_url: response?.data?.file_url || response?.data?.url || response?.data?.document || URL.createObjectURL(file),
        };
        setTherapistDocuments((prev) => [...prev, uploadedDocObj]);
        fetchSessionDocuments();
      } else {
        toast.error(response?.message || "Failed to upload document.");
      }
    } catch (err: any) {
      console.error("Error uploading document in VideoConfrence:", err);
      toast.error(err?.response?.data?.message || err?.message || "Error uploading document");
    } finally {
      setIsUploadingDoc(false);
      if (e.target) e.target.value = "";
    }
  };


  const chatChannelName = `session_${rawSessionId}`;

  // Helper to extract timestamp in ms from any Firestore or JS message format
  const getMsgTime = (msg: FirebaseChatMessage): number => {
    const extractMs = (val: any): number => {
      if (val === null || val === undefined) return 0;

      if (typeof val?.toMillis === "function") {
        try {
          const res = val.toMillis();
          if (typeof res === "number" && !isNaN(res) && res > 0) return res;
        } catch (e) { }
      }
      if (typeof val?.toDate === "function") {
        try {
          const d = val.toDate();
          if (d && !isNaN(d.getTime())) return d.getTime();
        } catch (e) { }
      }

      if (typeof val?.seconds === "number" && !isNaN(val.seconds) && val.seconds > 0) {
        return val.seconds * 1000;
      }

      if (typeof val === "number" && !isNaN(val) && val > 0) {
        if (val < 1e11) return val * 1000;
        return val;
      }

      if (typeof val === "string" && val.trim() !== "") {
        const parsed = new Date(val).getTime();
        if (!isNaN(parsed) && parsed > 0 && new Date(parsed).getFullYear() > 1970) {
          return parsed;
        }
      }

      return 0;
    };

    const candidateFields = [
      msg.timestamp,
      msg.created_at,
      (msg as any).createdAt,
      (msg as any).time,
      (msg as any).date,
      (msg as any).sentAt,
    ];

    for (const field of candidateFields) {
      const ms = extractMs(field);
      if (ms > 0) return ms;
    }

    return 0;
  };

  // Firestore Chat Real-Time Subscription (Path: chats -> session_{id} -> messages)
  useEffect(() => {
    if (!db || !chatChannelName) return;

    const messagesCollection = collection(db, "chats", chatChannelName, "messages");

    const unsubscribe = onSnapshot(
      messagesCollection,
      (snapshot) => {
        const msgs: FirebaseChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          msgs.push({ id: docSnap.id, ...data });

          // If incoming message from patient is unread (seen: false), mark as seen
          const isPatientSender =
            data.senderId?.startsWith("patient") ||
            data.sender_type === "patient" ||
            data.sender_type === "client";

          if (isPatientSender && data.seen === false && docSnap.id) {
            try {
              updateDoc(doc(db, "chats", chatChannelName, "messages", docSnap.id), {
                seen: true,
              });
            } catch (err) {
              console.error("Error updating seen status:", err);
            }
          }
        });

        // Client-side sort by timestamp / created_at
        msgs.sort((a, b) => getMsgTime(a) - getMsgTime(b));

        setChatMessages(msgs);
      },
      (err) => {
        console.error("Firebase chat snapshot listener error:", err);
      }
    );

    return () => unsubscribe();
  }, [chatChannelName]);

  // Auto-scroll chat timeline to bottom without scrolling outer window
  useEffect(() => {
    if (chatTimelineRef.current) {
      chatTimelineRef.current.scrollTop = chatTimelineRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Send Message Handler
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = chatInputText.trim();
    if (!textToSend || !db || !chatChannelName) return;

    try {
      const messagesCollection = collection(db, "chats", chatChannelName, "messages");
      setChatInputText("");
      const therapistId = parsedUser?.user?.id || videoCallSession?.uid || "";
      const currentSenderId = therapistId ? `therapist_${therapistId}` : "therapist";
      const currentReceiverId = "patient";

      await addDoc(messagesCollection, {
        message: textToSend,
        text: textToSend,
        senderId: currentSenderId,
        receiverId: currentReceiverId,
        seen: false,
        timestamp: Date.now(),
        sender: doctorFullName || "Doctor",
        sender_name: doctorFullName || "Doctor",
        sender_type: "therapist",
        sender_id: therapistId || "therapist",
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error sending message to Firebase Firestore:", err);
    }
  };

  const formatChatTime = (msg: FirebaseChatMessage): string => {
    const ms = getMsgTime(msg);
    if (ms > 0) {
      const d = new Date(ms);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }

    const candidateFields = [
      msg.timestamp,
      msg.created_at,
      (msg as any).createdAt,
      (msg as any).time,
      (msg as any).date,
    ];

    for (const field of candidateFields) {
      if (typeof field === "string" && /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(field.trim())) {
        return field.trim();
      }
    }

    return "";
  };

  // Call therapist-call-joined API endpoint when joining the room
  useEffect(() => {
    const notifyCallJoined = async () => {
      try {
        const sessionId =
          therapySessionId || videoCallSession.therapy_session_id || "";

        if (!sessionId) return;

        const formData = new FormData();
        formData.append("therapy_session_id", sessionId);

        const res = await requestApi({
          endpoint: "therapist-call-joined",
          method: "POST",
          data: formData,
          isFormData: true,
        });
        console.log("therapist-call-joined API call", res);
        if (res && (res.success || res.code === 200) && res.data) {
          setJoinedCallData(res.data);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(`call_joined_${sessionId}`, JSON.stringify(res.data));
            window.dispatchEvent(new CustomEvent("callJoinedUpdated", { detail: res.data }));
          }
        }
      } catch (err) {
        console.error("therapist-call-joined API call error:", err);
      }
    };

    notifyCallJoined();
  }, [therapySessionId, videoCallSession]);

  // Compute and update global profile image URLs & display names from joined call data
  useEffect(() => {
    const getFullImgUrl = (imgRelPath?: string, fallback: string = "/images/header-user-right-profile.svg") => {
      if (!imgRelPath) return fallback;
      const trimmed = imgRelPath.trim();
      if (!trimmed) return fallback;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
        return trimmed;
      }
      return `${Base_image_url.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
    };

    const therapistData = joinedCallData?.therapist;
    const patientData = joinedCallData?.patient;

    const tName = therapistData?.name
      ? `Dr. ${therapistData.name} ${therapistData.surname_one || ""}`.trim() + " (Host)"
      : `${doctorFullName} (Host)`;

    const tImg = therapistData?.profile_image
      ? getFullImgUrl(therapistData.profile_image, doctorProfileImgUrl)
      : doctorProfileImgUrl;

    const pName = patientData?.name
      ? `${patientData.name} ${patientData.surname_one || ""}`.trim()
      : dynamicPatientName || "Patient";

    const pImg = patientData?.profile_image
      ? getFullImgUrl(patientData.profile_image, "/images/header-user-right-profile.svg")
      : "/images/header-user-right-profile.svg";

    setTherapistDisplayName(tName);
    setTherapistImgUrl(tImg);
    setPatientDisplayName(pName);
    setPatientImgUrl(pImg);
  }, [joinedCallData, doctorFullName, doctorProfileImgUrl, dynamicPatientName]);

  // Join Agora Channel
  useJoin({
    appid: appIdToUse,
    channel: channel_name,
    token: token || null,
    uid: videoCallSession.uid ? Number(videoCallSession.uid) : null,
  });

  // Publish Audio & Video Tracks
  usePublish([localMicrophoneTrack, localCameraTrack]);

  const router = useRouter();

  const handleEndCall = async () => {
    const sessionId =
      therapySessionId ||
      videoCallSession.therapy_session_id ||
      searchParams.get("therapy_session_id") ||
      searchParams.get("session_id") ||
      searchParams.get("id") ||
      "";

    if (sessionId) {
      try {
        const formData = new FormData();
        formData.append("therapy_session_id", String(sessionId));

        await Promise.allSettled([
          requestApi({
            endpoint: "therapist-end-call",
            method: "POST",
            data: formData,
            isFormData: true,
          }),
          requestApi({
            endpoint: "therapist-refresh-token",
            method: "POST",
            data: formData,
            isFormData: true,
          }),
        ]);
      } catch (err) {
        console.error("Error calling end-call / refresh-token endpoints:", err);
      }
    }

    if (onEndCall) {
      onEndCall();
    }

    router.push("/dashboard");
  };

  // Toggle Controls
  const toggleMic = async () => {
    const nextState = !micActive;
    if (localMicrophoneTrack) {
      try {
        await localMicrophoneTrack.setEnabled(nextState);
      } catch (err) {
        console.error("Error toggling mic track:", err);
      }
    }
    setMicActive(nextState);
  };

  const toggleCamera = async () => {
    const nextState = !cameraActive;
    if (localCameraTrack) {
      try {
        await localCameraTrack.setEnabled(nextState);
      } catch (err) {
        console.error("Error toggling camera track:", err);
      }
    }
    setCameraActive(nextState);
  };



  return (
    <main className="gl-content-body">
      <div className="ps-session-page-grid">
        <div className="ps-session-video-panel">
          {/* Main Video Viewport */}
          <div className="ps-session-video-viewport">
            {primaryRemoteUser ? (
              <RemoteUser
                user={primaryRemoteUser}
                playAudio={true}
                playVideo={true}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  width: "100%",
                  color: "#fff",
                }}
              >
                <p style={{ fontSize: "16px", color: "#ffffff", fontWeight: 500 }}>
                  Waiting for {patientDisplayName || dynamicPatientName || "participant"} to join...
                </p>
              </div>
            )}

            {/* Remote User Top Left Olive Badge */}
            <div
              className="ps-session-overlay-badge-top"
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                backgroundColor: "rgba(105, 114, 76, 0.88)",
                backdropFilter: "blur(4px)",
                padding: "6px 14px",
                borderRadius: "20px",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                zIndex: 10,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: "block" }}
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span>{patientDisplayName || dynamicPatientName}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "flex-end",
                  gap: "2px",
                  height: "12px",
                  marginLeft: "2px",
                }}
              >
                <span
                  style={{
                    width: "2px",
                    height: "4px",
                    backgroundColor: "#52c41a",
                    borderRadius: "1px",
                  }}
                />
                <span
                  style={{
                    width: "2px",
                    height: "7px",
                    backgroundColor: "#52c41a",
                    borderRadius: "1px",
                  }}
                />
                <span
                  style={{
                    width: "2px",
                    height: "10px",
                    backgroundColor: "#52c41a",
                    borderRadius: "1px",
                  }}
                />
                <span
                  style={{
                    width: "2px",
                    height: "12px",
                    backgroundColor: "#52c41a",
                    borderRadius: "1px",
                  }}
                />
              </span>
            </div>

            {/* Left Side Vertical Volume Slider Capsule */}
            <div
              className="ps-session-volume-slider-container"
              style={{
                position: "absolute",
                left: "20px",
                top: "110px",
                backgroundColor: "rgba(110, 78, 91, 0.88)",
                borderRadius: "24px",
                padding: "16px 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                width: "36px",
                backdropFilter: "blur(4px)",
                zIndex: 10,
              }}
            >
              <div
                className="ps-session-volume-track"
                style={{
                  width: "4px",
                  height: "120px",
                  backgroundColor: "rgba(255, 255, 255, 0.3)",
                  borderRadius: "2px",
                  position: "relative",
                }}
              >
                <div
                  className="ps-session-volume-fill"
                  style={{
                    width: "100%",
                    height: "65%",
                    backgroundColor: "#ffffff",
                    borderRadius: "2px",
                    position: "absolute",
                    bottom: 0,
                  }}
                />
                <div
                  className="ps-session-volume-handle"
                  style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor: "#ffffff",
                    borderRadius: "50%",
                    position: "absolute",
                    bottom: "65%",
                    left: "-3px",
                  }}
                />
              </div>
              <svg
                className="ps-session-volume-icon"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                viewBox="0 0 24 24"
                style={{ width: "16px", height: "16px" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z"
                />
              </svg>
            </div>

            {/* Local Stream PIP Box */}
            <div
              className="ps-session-pip-doctor-box"
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                width: "230px",
                height: "135px",
                borderRadius: "16px",
                overflow: "hidden",
                border: "2.5px solid #ffffff",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
                zIndex: 10,
              }}
            >
              <LocalUser
                audioTrack={localMicrophoneTrack}
                videoTrack={localCameraTrack}
                cameraOn={cameraActive}
                micOn={micActive}
                playAudio={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {/* Name Pill Badge inside PIP (Bottom Left) */}
              <div
                className="ps-session-pip-label"
                style={{
                  position: "absolute",
                  bottom: "10px",
                  left: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "rgba(105, 114, 76, 0.88)",
                  backdropFilter: "blur(4px)",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  color: "#ffffff",
                  zIndex: 12,
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                }}
              >
                {/* Microphone Icon */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: "block" }}
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>

                {/* Name Label */}
                <span
                  style={{
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 500,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  You {" "}({doctorFullName})
                </span>

                {/* Voice Level / Signal Indicator Bars */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "flex-end",
                    gap: "2px",
                    height: "12px",
                    marginLeft: "2px",
                  }}
                >
                  <span
                    style={{
                      width: "2px",
                      height: "4px",
                      backgroundColor: "#52c41a",
                      borderRadius: "1px",
                    }}
                  />
                  <span
                    style={{
                      width: "2px",
                      height: "7px",
                      backgroundColor: "#52c41a",
                      borderRadius: "1px",
                    }}
                  />
                  <span
                    style={{
                      width: "2px",
                      height: "10px",
                      backgroundColor: "#52c41a",
                      borderRadius: "1px",
                    }}
                  />
                  <span
                    style={{
                      width: "2px",
                      height: "12px",
                      backgroundColor: "#52c41a",
                      borderRadius: "1px",
                    }}
                  />
                </span>
              </div>
            </div>
          </div>

          {/* Action Control Dock (Separate Black Bar at Bottom) */}
          <div className="ps-session-video-controls-dock">
            <button className="ps-session-dock-btn" onClick={toggleMic}>
              <div
                className="ps-session-dock-icon-circle"
                style={{
                  backgroundColor: !micActive ? "#ff4d4f" : undefined,
                  color: !micActive ? "#fff" : undefined,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {micActive ? (
                    <>
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" />
                    </>
                  ) : (
                    <>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    </>
                  )}
                </svg>
              </div>
              {micActive ? "Mute" : "Unmute"}
            </button>

            <button className="ps-session-dock-btn" onClick={toggleCamera}>
              <div
                className="ps-session-dock-icon-circle"
                style={{
                  backgroundColor: !cameraActive ? "#ff4d4f" : undefined,
                  color: !cameraActive ? "#fff" : undefined,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z" />
                </svg>
              </div>
              {cameraActive ? "Camera Off" : "Camera On"}
            </button>

            <button className="ps-session-dock-btn">
              <div className="ps-session-dock-icon-circle">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              Chat
            </button>

            <button
              className="ps-session-dock-btn ps-session-dock-btn-end"
              // data-bs-toggle="modal"
              // data-bs-target="#endSessionModal"
              onClick={handleEndCall}
            >
              <div className="ps-session-dock-icon-circle">
                <img
                  src="/images/endCallicon.png"
                  alt="endCallicon"
                />
              </div>
              End Call
            </button>
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="ps-session-right-sidebar">
          {/* Notes Card */}
          <div className="ps-session-module-card">
            <div className="ps-session-card-head">
              <h3 className="ps-session-card-title">
                <svg
                  className="ps-session-head-icon-plum"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3Z" />
                  <path d="M12 14c-4.418 0-8 2.239-8 5v2h16v-2c0-2.761-3.582-5-8-5Z" />
                </svg>
                Private Notes{" "}
                <span className="ps-session-title-aside">(Only you)</span>
              </h3>
              <button
                type="button"
                className="ps-session-btn-clear"
                onClick={clearPrivateNotes}
              >
                Clear
              </button>
            </div>

            {/* Rich Text ContentEditable Editor */}
            <div
              ref={privateNotesEditorRef}
              className="ps-session-notes-textarea"
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-placeholder="Write your private observation during the session..."
              onInput={(e) => setPrivateNotesText(e.currentTarget.innerHTML)}
              style={{
                minHeight: "120px",
                maxHeight: isNotesExpanded ? "400px" : "180px",
                overflowY: "auto",
                outline: "none",
                padding: "10px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px 8px 0 0",
              }}
            />

            {/* Editor Toolbar */}
            <div
              className="ps-session-notes-toolbar"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 12px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <div
                className="ps-session-toolbar-left-items"
                style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
              >
                {/* Font Size Dropdown */}
                <span style={{ cursor: "pointer", position: "relative", fontSize: "13px" }}>
                  14 ▾
                  <select
                    style={{
                      position: "absolute",
                      opacity: 0,
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                    }}
                    onChange={(e) => execNotesCommand("fontSize", e.target.value)}
                    defaultValue="3"
                  >
                    <option value="1">10</option>
                    <option value="2">12</option>
                    <option value="3">14</option>
                    <option value="4">18</option>
                    <option value="5">24</option>
                    <option value="6">32</option>
                  </select>
                </span>

                {/* Color Picker */}
                <span style={{ cursor: "pointer", position: "relative", fontSize: "14px" }}>
                  ⚫
                  <input
                    type="color"
                    style={{
                      position: "absolute",
                      opacity: 0,
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                    }}
                    onChange={(e) => execNotesCommand("foreColor", e.target.value)}
                  />
                </span>

                {/* Bold */}
                <strong
                  style={{ cursor: "pointer", padding: "2px 6px", userSelect: "none" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("bold");
                  }}
                >
                  B
                </strong>

                {/* Italic */}
                <em
                  style={{ cursor: "pointer", padding: "2px 6px", userSelect: "none" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("italic");
                  }}
                >
                  I
                </em>

                {/* Underline */}
                <span
                  style={{ textDecoration: "underline", cursor: "pointer", padding: "2px 6px", userSelect: "none" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("underline");
                  }}
                >
                  U
                </span>

                {/* Strikethrough */}
                <span
                  style={{ textDecoration: "line-through", cursor: "pointer", padding: "2px 6px", userSelect: "none" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("strikeThrough");
                  }}
                >
                  S
                </span>

                {/* Align Left */}
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("justifyLeft");
                  }}
                >
                  <path d="M4 6h16M4 12h10M4 18h16" />
                </svg>

                {/* Align Center */}
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("justifyCenter");
                  }}
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>

                {/* Align Right */}
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("justifyRight");
                  }}
                >
                  <path d="M4 6h16M10 12h10M4 18h16" />
                </svg>

                {/* Unordered List */}
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("insertUnorderedList");
                  }}
                >
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>

                {/* Ordered List */}
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("insertOrderedList");
                  }}
                >
                  <line x1="10" y1="6" x2="21" y2="6"></line>
                  <line x1="10" y1="12" x2="21" y2="12"></line>
                  <line x1="10" y1="18" x2="21" y2="18"></line>
                  <path d="M4 6h1v4"></path>
                  <path d="M4 10h2"></path>
                  <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
                </svg>
              </div>

              {/* Expand / Fullscreen Toggle */}
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                style={{ cursor: "pointer" }}
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </div>

            <button
              type="button"
              className="ps-session-btn-save-note"
              onClick={handleSavePrivateNotes}
              disabled={isSubmittingPrivateNotes}
              style={{ marginTop: "12px" }}
            >
              {isSubmittingPrivateNotes ? "Saving..." : "Save Notes"}
            </button>
          </div>

          {/* Live Chat Card */}
          <div className="ps-session-module-card">
            <div className="ps-session-card-head">
              <h3 className="ps-session-card-title">
                <svg
                  className="ps-session-head-icon-plum"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Live Chat
              </h3>
            </div>
            <div className="ps-session-chat-timeline" ref={chatTimelineRef}>
              <div className="ps-session-chat-day-label">Today</div>
              {chatMessages.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#a3a3a3",
                    marginTop: "12px",
                  }}
                >
                  No messages yet. Send a message to start chatting.
                </p>
              ) : (
                chatMessages.map((msg, index) => {
                  const msgText = msg.text || msg.message || "";
                  const isDoctorMsg =
                    msg.sender_type === "therapist" ||
                    msg.sender_type === "doctor" ||
                    msg.sender === doctorFullName ||
                    String(msg.sender_id) === String(parsedUser?.user?.id) ||
                    (typeof msg.senderId === "string" &&
                      (msg.senderId.startsWith("therapist") ||
                        msg.senderId.startsWith("doctor") ||
                        msg.senderId === String(parsedUser?.user?.id)));

                  return (
                    <div
                      key={msg.id || index}
                      className={`ps-session-chat-msg-bubble-line ${isDoctorMsg ? "ps-session-msg-row-user" : ""
                        }`}
                    >
                      <div className="ps-session-chat-sender-avatar">
                        <img
                          src={
                            isDoctorMsg
                              ? therapistImgUrl || doctorProfileImgUrl
                              : patientImgUrl || "/images/header-user-right-profile.svg"
                          }
                          alt="Avatar"
                          style={{
                            width: "25px",
                            height: "25px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            overflow: "hidden",
                          }}
                        />
                      </div>
                      <div className="ps-session-msg-wrapper-inner">
                        <div className="ps-session-msg-text-bubble">{msgText}</div>
                        <span
                          className="ps-session-chat-time-text"
                          style={{ textAlign: isDoctorMsg ? "right" : "left" }}
                        >
                          {formatChatTime(msg)}
                          {isDoctorMsg && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={msg.seen ? "#1890ff" : "#52c41a"}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{
                                display: "inline-block",
                                verticalAlign: "middle",
                                marginLeft: "4px",
                              }}
                            >
                              <path d="M18 6L7 17l-5-5" />
                              <path d="M22 10l-7.5 7.5L13 16" />
                            </svg>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form
              onSubmit={handleSendChatMessage}
              className="ps-session-chat-input-row"
            >
              <input
                type="text"
                className="ps-session-chat-text-input"
                placeholder="Type a message..."
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
              />
              <button type="submit" className="ps-session-chat-btn-send">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>

          {/* Documents Card */}
          <div className="ps-session-module-card">
            <div className="ps-session-card-head">
              <h3 className="ps-session-card-title">
                <svg
                  className="ps-session-head-icon-plum"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Documents & Attachments
              </h3>
            </div>

            <div className="ps-session-tabs-row">
              <div
                className={`ps-session-tab ${docTab === "therapist" ? "ps-session-active-tab" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setDocTab("therapist")}
              >
                Shared by you{" "}
                <span className="ps-session-badge-count">{therapistDocuments.length}</span>
              </div>
              <div
                className={`ps-session-tab ${docTab === "patient" ? "ps-session-active-tab" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setDocTab("patient")}
              >
                Shared by Patient{" "}
                <span className="ps-session-badge-count">{patientDocuments.length}</span>
              </div>
            </div>

            {/* Document Items List */}
            {isFetchingDocs ? (
              <div style={{ textAlign: "center", padding: "12px", fontSize: "12px", color: "#8c8c8c" }}>
                Loading documents...
              </div>
            ) : (docTab === "therapist" ? therapistDocuments : patientDocuments).length === 0 ? (
              <div style={{ textAlign: "center", padding: "12px", fontSize: "12px", color: "#8c8c8c" }}>
                No documents found.
              </div>
            ) : (
              (docTab === "therapist" ? therapistDocuments : patientDocuments).map((docItem, idx) => (
                <div className="ps-session-file-attachment-row" key={docItem.id || idx}>
                  <div>
                    <div className="ps-session-file-title">{docItem.file_name}</div>
                    <div className="ps-session-file-meta">
                      {docItem.file_type ? `${docItem.file_type} File` : "Document"}
                    </div>
                  </div>
                  {docItem.file_url ? (
                    <a
                      href={docItem.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ps-session-view-link"
                    >
                      View ▾
                    </a>
                  ) : null}
                </div>
              ))
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={docFileInputRef}
              style={{ display: "none" }}
              onChange={handleDocumentUpload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />

            {/* Upload Dropzone (Visible on Therapist Tab) */}
            {docTab === "therapist" && (
              <div
                className="ps-session-upload-dashed-dropzone"
                style={{ cursor: isUploadingDoc ? "not-allowed" : "pointer" }}
                onClick={() => {
                  if (!isUploadingDoc) docFileInputRef.current?.click();
                }}
              >
                <p className="ps-session-upload-main-text">
                  {isUploadingDoc ? "Uploading Document..." : "Upload Document"}
                </p>
                <p className="ps-session-upload-sub-text">
                  Allowed: PDF, DOC, DOCX, JPG, PNG (Max: 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Dynamic Participants Card */}
          {(() => {
            const patientData = joinedCallData?.patient;
            const totalParticipantsCount =
              remoteUsers.length > 0 ? remoteUsers.length + 1 : (patientData ? 2 : 1);

            return (
              <div className="ps-session-module-card">
                <div className="ps-session-card-head">
                  <h3 className="ps-session-card-title">
                    <svg
                      className="ps-session-head-icon-plum"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Participants{" "}
                    <span className="ps-session-title-aside">
                      ({totalParticipantsCount})
                    </span>
                  </h3>
                </div>
                <div className="ps-session-participants-list-holder">
                  {/* Therapist (Host) */}
                  <div className="ps-session-participant-line">
                    <div className="ps-session-participant-meta">
                      <div className="ps-session-chat-sender-avatar">
                        <img
                          src={therapistImgUrl || doctorProfileImgUrl}
                          alt="Therapist Profile"
                          style={{
                            width: "25px",
                            height: "25px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            overflow: "hidden",
                          }}
                        />
                      </div>
                      <span>{therapistDisplayName || `${doctorFullName} (Host)`}</span>
                    </div>
                    <svg
                      className={`ps-session-status-icon-right ${micActive ? "ps-session-mic-on" : "ps-session-mic-off"
                        }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      {micActive ? (
                        <>
                          <rect x="4" y="9" width="3" height="6" rx="1.5" />
                          <rect x="10" y="5" width="3" height="14" rx="1.5" />
                          <rect x="16" y="7" width="3" height="10" rx="1.5" />
                        </>
                      ) : (
                        <>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        </>
                      )}
                    </svg>
                  </div>

                  {/* Patient Participant */}
                  {(patientData || remoteUsers.length > 0) && (
                    <div className="ps-session-participant-line">
                      <div className="ps-session-participant-meta">
                        <div className="ps-session-chat-sender-avatar">
                          <img
                            src={patientImgUrl || "/images/header-user-right-profile.svg"}
                            alt="Patient Profile"
                            style={{
                              width: "25px",
                              height: "25px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              overflow: "hidden",
                            }}
                          />
                        </div>
                        <span>{patientDisplayName || dynamicPatientName || "Patient"}</span>
                      </div>
                      <svg
                        className="ps-session-status-icon-right ps-session-mic-on"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="4" y="9" width="3" height="6" rx="1.5" />
                        <rect x="10" y="5" width="3" height="14" rx="1.5" />
                        <rect x="16" y="7" width="3" height="10" rx="1.5" />
                      </svg>
                    </div>
                  )}

                  {/* Extra Remote Users (if any) */}
                  {remoteUsers.map((user) => (
                    <div className="ps-session-participant-line" key={user.uid}>
                      <div className="ps-session-participant-meta">
                        <div className="ps-session-chat-sender-avatar">
                          <img
                            src="/images/header-user-right-profile.svg"
                            alt="User Profile"
                            style={{
                              width: "25px",
                              height: "25px",
                              borderRadius: "50%",
                              overflow: "hidden",
                            }}
                          />
                        </div>
                        <span>Participant ({user.uid})</span>
                      </div>
                      <svg
                        className={`ps-session-status-icon-right ${user.hasAudio ? "ps-session-mic-on" : "ps-session-mic-off"
                          }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        {user.hasAudio ? (
                          <>
                            <rect x="4" y="9" width="3" height="6" rx="1.5" />
                            <rect x="10" y="5" width="3" height="14" rx="1.5" />
                            <rect x="16" y="7" width="3" height="10" rx="1.5" />
                          </>
                        ) : (
                          <>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                          </>
                        )}
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <EndSession sessionId={rawSessionId || undefined} />
    </main>
  );
};

// 2. Exported Parent Wrapper providing the Agora RTC Client
const VideoConfrence: React.FC<VideoConferenceProps> = (props) => {
  const client = useRTCClient(
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );

  return (
    <AgoraRTCProvider client={client}>
      <VideoRoomInner {...props} />
    </AgoraRTCProvider>
  );
};

export default VideoConfrence;

// import React from "react";

// interface VideoCallSession {
//   APP_ID: string;
//   security: string;
//   channel_name: string;
//   token: string;
// }
// interface VideoConferenceProps {
//   videoCallSession: VideoCallSession;
// }

// const VideoConfrence = ({ videoCallSession }: VideoConferenceProps) => {
//   return (
//     <>
//       <main className="gl-content-body">
//         <div className="ps-session-page-grid">
//           <div className="ps-session-video-panel">
//             <div className="ps-session-video-viewport">
//               <div className="ps-session-overlay-badge-top">
//                 <span className="ps-session-mic-active-waves">
//                   <svg
//                     width="12"
//                     height="12"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
//                     <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
//                   </svg>
//                 </span>
//                 John Carter
//               </div>

//               <div className="ps-session-volume-slider-container">
//                 <div className="ps-session-volume-track">
//                   <div className="ps-session-volume-fill"></div>
//                   <div className="ps-session-volume-handle"></div>
//                 </div>
//                 <svg
//                   className="ps-session-volume-icon"
//                   fill="none"
//                   stroke="currentColor"
//                   stroke-width="2"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     stroke-linecap="round"
//                     stroke-linejoin="round"
//                     d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z"
//                   />
//                 </svg>
//               </div>

//               <div className="ps-session-pip-doctor-box">
//                 <div className="ps-session-pip-label">
//                   <svg
//                     width="10"
//                     height="10"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
//                     <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
//                   </svg>
//                   You (Dr. Rafael Costa)
//                 </div>
//               </div>
//             </div>

//             <div className="ps-session-video-controls-dock">
//               <button className="ps-session-dock-btn">
//                 <div className="ps-session-dock-icon-circle">
//                   <svg
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
//                     <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" />
//                   </svg>
//                 </div>
//                 Mute
//               </button>
//               <button className="ps-session-dock-btn">
//                 <div className="ps-session-dock-icon-circle">
//                   <svg
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z" />
//                   </svg>
//                 </div>
//                 Camera
//               </button>
//               <button className="ps-session-dock-btn">
//                 <div className="ps-session-dock-icon-circle">
//                   <svg
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
//                   </svg>
//                 </div>
//                 Chat
//               </button>
//               <button className="ps-session-dock-btn ps-session-dock-btn-end">
//                 <div className="ps-session-dock-icon-circle">
//                   <svg
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a1 1 0 0 1 1-.27 11.28 11.28 0 0 0 3.51.56 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.28 11.28 0 0 0 .56 3.51 1 1 0 0 1-.27 1l-1.27 1.27a16 16 0 0 0 2.6 3.41z" />
//                   </svg>
//                 </div>
//                 End Call
//               </button>
//             </div>
//           </div>

//           <div className="ps-session-right-sidebar">
//             <div className="ps-session-module-card">
//               <div className="ps-session-card-head">
//                 <h3 className="ps-session-card-title">
//                   <svg
//                     className="ps-session-head-icon-plum"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3Z" />
//                     <path d="M12 14c-4.418 0-8 2.239-8 5v2h16v-2c0-2.761-3.582-5-8-5Z" />
//                   </svg>
//                   Private Notes{" "}
//                   <span className="ps-session-title-aside">(Only you)</span>
//                 </h3>
//                 <button className="ps-session-btn-clear">Clear</button>
//               </div>
//               <textarea
//                 className="ps-session-notes-textarea"
//                 placeholder="Write your private observation during the session..."
//               ></textarea>
//               <div className="ps-session-notes-toolbar">
//                 <div className="ps-session-toolbar-left-items">
//                   <span>14 ▾</span>
//                   <span>⚫ ▾</span>
//                   <strong>B</strong>
//                   <em>I</em>
//                 </div>
//                 <svg
//                   width="14"
//                   height="14"
//                   fill="none"
//                   stroke="currentColor"
//                   stroke-width="2"
//                   viewBox="0 0 24 24"
//                 >
//                   <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
//                 </svg>
//               </div>
//               <button className="ps-session-btn-save-note">Save Notes</button>
//             </div>

//             <div className="ps-session-module-card">
//               <div className="ps-session-card-head">
//                 <h3 className="ps-session-card-title">
//                   <svg
//                     className="ps-session-head-icon-plum"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
//                   </svg>
//                   Live Chat
//                 </h3>
//               </div>
//               <div className="ps-session-chat-timeline">
//                 <div className="ps-session-chat-day-label">Today</div>

//                 <div className="ps-session-chat-msg-bubble-line">
//                   <div className="ps-session-chat-sender-avatar">
//                     <img
//                       src="/images/header-user-right-profile.svg"
//                       alt="User Profile"
//                       style={{
//                         width: "25px",
//                         height: "25px",
//                         borderRadius: "50%",
//                         overflow: "hidden",
//                       }}
//                     />
//                   </div>
//                   <div className="ps-session-msg-wrapper-inner">
//                     <div className="ps-session-msg-text-bubble">
//                       Hey, glad you came back. How have things been since we
//                       last talked?
//                     </div>
//                     <span className="ps-session-chat-time-text">10:32 AM</span>
//                   </div>
//                 </div>

//                 <div className="ps-session-chat-msg-bubble-line ps-session-msg-row-user">
//                   <div className="ps-session-chat-sender-avatar">
//                     <img
//                       src="/images/header-user-right-profile.svg"
//                       alt="User Profile"
//                       style={{
//                         width: "25px",
//                         height: "25px",
//                         borderRadius: "50%",
//                         overflow: "hidden",
//                       }}
//                     />
//                   </div>
//                   <div className="ps-session-msg-wrapper-inner">
//                     <div className="ps-session-msg-text-bubble">
//                       Hey, glad you came back. How have things been since we
//                       last talked?
//                     </div>
//                     <span className="ps-session-chat-time-text">
//                       10:32 AM ✓
//                     </span>
//                   </div>
//                 </div>
//               </div>
//               <div className="ps-session-chat-input-row">
//                 <input
//                   type="text"
//                   className="ps-session-chat-text-input"
//                   placeholder="Type a message..."
//                 />
//                 <button className="ps-session-chat-btn-send">
//                   <svg
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <line x1="22" y1="2" x2="11" y2="13"></line>
//                     <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
//                   </svg>
//                 </button>
//               </div>
//             </div>

//             <div className="ps-session-module-card">
//               <div className="ps-session-card-head">
//                 <h3 className="ps-session-card-title">
//                   <svg
//                     className="ps-session-head-icon-plum"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
//                   </svg>
//                   Documents & Attachments
//                 </h3>
//               </div>
//               <div className="ps-session-tabs-row">
//                 <div className="ps-session-tab ps-session-active-tab">
//                   Shared by you{" "}
//                   <span className="ps-session-badge-count">1</span>
//                 </div>
//                 <div className="ps-session-tab">
//                   Shared by Patient{" "}
//                   <span className="ps-session-badge-count">0</span>
//                 </div>
//               </div>
//               <div className="ps-session-file-attachment-row">
//                 <div>
//                   <div className="ps-session-file-title">
//                     Anxiety_Worksheet.pdf
//                   </div>
//                   <div className="ps-session-file-meta">
//                     Uploaded on May 24, 2026
//                   </div>
//                 </div>
//                 <a href="#" className="ps-session-view-link">
//                   View ▾
//                 </a>
//               </div>
//               <div className="ps-session-upload-dashed-dropzone">
//                 <p className="ps-session-upload-main-text">Upload Document</p>
//                 <p className="ps-session-upload-sub-text">
//                   Allowed: PDF, DOC, DOCX, JPG, PNG (Max: 10MB)
//                 </p>
//               </div>
//             </div>

//             <div className="ps-session-module-card">
//               <div className="ps-session-card-head">
//                 <h3 className="ps-session-card-title">
//                   <svg
//                     className="ps-session-head-icon-plum"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
//                   </svg>
//                   Participants{" "}
//                   <span className="ps-session-title-aside">(3)</span>
//                 </h3>
//               </div>
//               <div className="ps-session-participants-list-holder">
//                 <div className="ps-session-participant-line">
//                   <div className="ps-session-participant-meta">
//                     <div className="ps-session-chat-sender-avatar">
//                       <img
//                         src="/images/header-user-right-profile.svg"
//                         alt="User Profile"
//                         style={{
//                           width: "25px",
//                           height: "25px",
//                           borderRadius: "50%",
//                           overflow: "hidden",
//                         }}
//                       />
//                     </div>
//                     <span>John Doe</span>
//                   </div>
//                   <svg
//                     className="ps-session-status-icon-right ps-session-mic-on"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <rect x="4" y="9" width="3" height="6" rx="1.5" />
//                     <rect x="10" y="5" width="3" height="14" rx="1.5" />
//                     <rect x="16" y="7" width="3" height="10" rx="1.5" />
//                   </svg>
//                 </div>

//                 <div className="ps-session-participant-line">
//                   <div className="ps-session-participant-meta">
//                     <div className="ps-session-chat-sender-avatar">
//                       {" "}
//                       <img
//                         src="/images/header-user-right-profile.svg"
//                         alt="User Profile"
//                         style={{
//                           width: "25px",
//                           height: "25px",
//                           borderRadius: "50%",
//                           overflow: "hidden",
//                         }}
//                       />
//                     </div>
//                     <span>Dr. Rafael Costa</span>
//                   </div>
//                   <svg
//                     className="ps-session-status-icon-right ps-session-mic-off"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     stroke-width="2"
//                   >
//                     <line x1="1" y1="1" x2="23" y2="23"></line>
//                     <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
//                   </svg>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </main>
//     </>
//   );
// };

// export default VideoConfrence;
