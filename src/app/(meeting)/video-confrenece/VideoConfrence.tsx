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
  getDoc,
  setDoc,
  DocumentReference,
  runTransaction,
} from "firebase/firestore";
import { uploadMedia } from "@/src/utils/formdataApi";
import axios from "axios";

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
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
}

export interface VideoCallSession {
  APP_ID: string;
  security: string;
  channel_name: string;
  token: string;
  call_id?: number | string;
  uid?: number | string;
  patient_uid?: number | string;
  therapist_uid?: number | string;
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
        trimmed.startsWith("http://") ||
          trimmed.startsWith("https://") ||
          trimmed.startsWith("data:")
          ? trimmed
          : `${Base_image_url.replace(/\/+$/, "")}/${trimmed.replace(
            /^\/+/,
            ""
          )}`;
      return {
        id: idx,
        file_name: fileName,
        file_type: ext,
        file_url: fullUrl,
      };
    }
    if (typeof item === "object") {
      const rawUrl =
        item.file_url || item.url || item.path || item.file_name || "";
      const fullUrl = rawUrl
        ? rawUrl.startsWith("http://") ||
          rawUrl.startsWith("https://") ||
          rawUrl.startsWith("data:")
          ? rawUrl
          : `${Base_image_url.replace(/\/+$/, "")}/${rawUrl.replace(
            /^\/+/,
            ""
          )}`
        : "";
      const fileName =
        item.file_name ||
        item.name ||
        (rawUrl ? rawUrl.split("/").pop() : `Document_${idx + 1}`);
      const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
      const fileType =
        item.file_type ||
        item.ext ||
        (extMatch ? extMatch[1].toUpperCase() : "PDF");

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
    const paths = docData
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return paths
      .map((path, idx) => processSingleDoc(path, idx))
      .filter(Boolean);
  }

  if (Array.isArray(docData)) {
    return docData
      .map((item, idx) => processSingleDoc(item, idx))
      .filter(Boolean);
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
  const appIdToUse = videoCallSession.APP_ID;
  const { channel_name, token } = videoCallSession;
  const loginUserData =
    typeof window !== "undefined" ? localStorage.getItem("loginUser") : null;
  const parsedUser = loginUserData ? JSON.parse(loginUserData) : null;

  // Get the full name with Dr. prefix
  const doctorFirstName = parsedUser?.user?.name || "Doctor";
  const doctorLastName = parsedUser?.user?.surname_one || "";
  const doctorFullName = `Dr. ${doctorFirstName} ${doctorLastName}`.trim();
  // const [certainEndCall, setCertainEndCall] = useState<boolean>(false);
  // Get profile picture from localStorage loginUser
  const rawDoctorImg =
    parsedUser?.user?.profile_image || parsedUser?.profile_image;
  const doctorProfileImgUrl = rawDoctorImg
    ? rawDoctorImg.startsWith("http") ||
      rawDoctorImg.startsWith("data:") ||
      rawDoctorImg.startsWith("/")
      ? rawDoctorImg
      : `${Base_image_url}${rawDoctorImg.startsWith("/") ? "" : "/"
      }${rawDoctorImg}`
    : "/images/dash-user-icon.svg";

  // Camera Device Presence Detection
  const [hasCameraDevice, setHasCameraDevice] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    AgoraRTC.getCameras()
      .then((cams) => {
        if (isMounted) {
          const available = Boolean(cams && cams.length > 0);
          setHasCameraDevice(available);
          setCameraActive(available);
        }
      })
      .catch((err) => {
        console.warn("Could not check camera devices:", err);
        if (isMounted) {
          setHasCameraDevice(false);
          setCameraActive(false);
        }
      });

    const handleDeviceChange = async () => {
      try {
        const cams = await AgoraRTC.getCameras();
        if (isMounted) {
          const available = Boolean(cams && cams.length > 0);
          setHasCameraDevice(available);
          if (!available) {
            setCameraActive(false);
          }
        }
      } catch (e) {
        console.warn("Error checking camera devices on change:", e);
      }
    };

    AgoraRTC.onCameraChanged = handleDeviceChange;
    return () => {
      isMounted = false;
      AgoraRTC.onCameraChanged = undefined;
    };
  }, []);

  // Agora Hooks (Audio always initialized; Camera initialized ONLY when camera device exists and is active)
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(true);
  const { localCameraTrack, error: cameraError } = useLocalCameraTrack(
    hasCameraDevice && cameraActive
  );

  useEffect(() => {
    if (cameraError) {
      console.warn("Camera track error:", cameraError);
      setHasCameraDevice(false);
      setCameraActive(false);
    }
  }, [cameraError]);

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

  // Audio recording & Speech recognition for ongoing video call transcript
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptTextRef = useRef<string>("");
  const finalTranscriptRef = useRef<string>("");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  //started call inlilzie
  const activeSessionId = String(
    rawSessionId ??
    therapySessionId ??
    videoCallSession?.therapy_session_id ??
    searchParams.get("therapy_session_id") ??
    searchParams.get("session_id") ??
    searchParams.get("id") ??
    ""
  ).trim();
  const [callStatus, setCallStatus] = useState<"ongoing" | "ended">("ongoing");

  const sessionRef = useRef<DocumentReference | null>(null);
  const hasTriggeredEndRef = useRef(false);
  const isEndingCallRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!activeSessionId) {
      sessionRef.current = null;
      return;
    }

    let isMounted = true;

    hasTriggeredEndRef.current = false;
    isEndingCallRef.current = false;

    const callDocRef = doc(db, "video_session_calls", activeSessionId);

    sessionRef.current = callDocRef;

    console.log("Initializing Firestore:", activeSessionId);

    const initializeCall = async () => {
      try {
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(callDocRef);

          if (!snapshot.exists()) {
            const therapistId =
              parsedUser?.user?.id || videoCallSession?.therapist_uid || "";

            transaction.set(callDocRef, {
              status: "ongoing",
              ...(therapistId ? { therapist_id: String(therapistId) } : {}),
              createdAt: serverTimestamp(),
            });
          }
        });

        console.log("Firestore initialization completed");
      } catch (error) {
        console.error("Firestore initialization failed:", error);
      }
    };

    initializeCall();

    const unsubscribe = onSnapshot(
      callDocRef,
      (snapshot) => {
        if (!isMounted || !snapshot.exists()) return;

        const status = snapshot.data()?.status;

        console.log("FIRESTORE STATUS:", status);

        if (status === "ended") {
          setCallStatus("ended");

          if (!hasTriggeredEndRef.current) {
            hasTriggeredEndRef.current = true;
            onEndCall?.();
          }
        } else if (status === "ongoing") {
          setCallStatus("ongoing");
        }
      },
      (error) => {
        console.error("Firestore listener error:", error);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeSessionId]);

  const startAudioAndTranscriptCapture = useCallback(async () => {
    try {
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      )
        return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang =
            typeof navigator !== "undefined" && navigator.language
              ? navigator.language
              : "en-US";

          recognition.onresult = (event: any) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const piece = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscriptRef.current +=
                  (finalTranscriptRef.current ? " " : "") + piece.trim();
              } else {
                interim += (interim ? " " : "") + piece.trim();
              }
            }
            const fullTranscript = [finalTranscriptRef.current, interim]
              .filter(Boolean)
              .join(" ")
              .trim();

            setTranscriptText(fullTranscript);
            transcriptTextRef.current = fullTranscript;
          };

          recognition.onend = () => {
            if (
              mediaRecorderRef.current &&
              mediaRecorderRef.current.state === "recording"
            ) {
              try {
                recognition.start();
              } catch (e) { }
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.error("Speech recognition error:", e);
        }
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) { }
        }
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          setAudioBlob(blob);
        }
      };

      mediaRecorder.start(1000);
    } catch (err) {
      console.warn(
        "Could not start background audio recording/transcript:",
        err
      );
    }
  }, []);

  useEffect(() => {
    startAudioAndTranscriptCapture();

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { }
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) { }
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startAudioAndTranscriptCapture]);

  //call end

  const getRecordingData = useCallback(async (): Promise<{
    blob: Blob;
    transcript: string;
  }> => {
    return new Promise((resolve) => {
      const currentTranscript =
        transcriptTextRef.current ||
        finalTranscriptRef.current ||
        transcriptText ||
        "Session audio recording transcript.";

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          setAudioBlob(blob);
          resolve({ blob, transcript: currentTranscript });
        };
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          resolve({ blob, transcript: currentTranscript });
        }
      } else {
        const blob =
          audioBlob || new Blob(audioChunksRef.current, { type: "audio/webm" });
        resolve({ blob, transcript: currentTranscript });
      }
    });
  }, [audioBlob, transcriptText]);

  // Private Notes State & Rich Text Editor Handlers
  const [privateNotesText, setPrivateNotesText] = useState<string>("");
  const [isSubmittingPrivateNotes, setIsSubmittingPrivateNotes] =
    useState<boolean>(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState<boolean>(false);
  const [isVideoZoomed, setIsVideoZoomed] = useState<boolean>(false);
  const videoPanelRef = useRef<HTMLDivElement>(null);
  const privateNotesEditorRef = useRef<HTMLDivElement>(null);

  const toggleZoomScreen = useCallback(() => {
    setIsVideoZoomed((prev) => {
      const next = !prev;
      if (next) {
        const elem = videoPanelRef.current;
        if (elem) {
          if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(() => { });
          } else if ((elem as any).webkitRequestFullscreen) {
            (elem as any).webkitRequestFullscreen();
          } else if ((elem as any).msRequestFullscreen) {
            (elem as any).msRequestFullscreen();
          }
        }
      } else {
        if (
          typeof document !== "undefined" &&
          (document.fullscreenElement || (document as any).webkitFullscreenElement)
        ) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
        }
      }

      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("resize"));
        }
      }, 150);
      return next;
    });
  }, []);

  // Sync state if user exits via browser ESC or browser UI
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      setIsVideoZoomed(isFull);
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("resize"));
        }
      }, 150);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVideoZoomed) {
        toggleZoomScreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVideoZoomed, toggleZoomScreen]);

  // Toggle body class when zoomed to hide header and sidebar
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isVideoZoomed) {
      document.body.classList.add("video-zoomed-active");
    } else {
      document.body.classList.remove("video-zoomed-active");
    }
    return () => {
      document.body.classList.remove("video-zoomed-active");
    };
  }, [isVideoZoomed]);

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
      const payload = {
        session_id: String(rawSessionId),
        type: "private",
        notes: privateNotesText,
      };

      const response = await requestApi({
        endpoint: "/api/submit-notes",
        method: "POST",
        data: payload,
        isFormData: false,
      });

      if (response && (response.success || response.status)) {
        toast.success("Private notes submitted successfully!");
      } else {
        toast.error(response?.message || "Failed to submit private notes.");
      }
    } catch (err: any) {
      console.error("Error submitting private notes:", err);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Error submitting private notes"
      );
    } finally {
      setIsSubmittingPrivateNotes(false);
    }
  };

  const fetchSessionDetails = useCallback(async () => {
    if (!rawSessionId) return;
    try {
      const response = await requestApi({
        endpoint: `get-session-details/${rawSessionId}`,
        method: "POST",
        data: {
          therapy_session_id: String(rawSessionId),
        },
      });

      if (response && (response.success || response.status || response.data)) {
        const data = response.data || response;
        const notes =
          data.therapist_private_notes ||
          data.private_notes ||
          data.therapist_notes ||
          data.notes ||
          "";
        if (notes) {
          setPrivateNotesText(notes);
          if (privateNotesEditorRef.current) {
            privateNotesEditorRef.current.innerHTML = notes;
          }
        }
      }
    } catch (err) {
      console.error("Error fetching session details in VideoConfrence:", err);
    }
  }, [rawSessionId]);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  useEffect(() => {
    if (
      privateNotesEditorRef.current &&
      privateNotesText &&
      !privateNotesEditorRef.current.innerHTML
    ) {
      privateNotesEditorRef.current.innerHTML = privateNotesText;
    }
  }, [privateNotesText]);

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

      const docData =
        response?.data?.documents ||
        response?.data ||
        response?.documents ||
        response;
      if (docData) {
        const therapistDocs = getDocList(
          docData.therapist_document ||
          docData.shared_by_therapist ||
          docData.therapist_documents
        );
        const patientDocs = getDocList(
          docData.patient_document ||
          docData.shared_by_patient ||
          docData.patient_documents
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
  //
  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !rawSessionId) return;

    setIsUploadingDoc(true);
    try {
      const parsedSessionId = parseInt(String(rawSessionId), 10);
      const formData = new FormData();
      formData.append("session_id", parsedSessionId.toString());
      formData.append("type", "therapist");

      // Check key name: Postman screenshot shows 'documen...' (likely 'documents' or 'document')
      formData.append("document", file);

      // 1. Retrieve the bearer token from localStorage
      let token: string | undefined;
      try {
        const savedDetails = localStorage.getItem("loginUser");
        const parsed = savedDetails ? JSON.parse(savedDetails) : null;
        token = parsed?.token;
      } catch (err) {
        console.error("Error reading token:", err);
      }

      // 2. Call your local Next.js proxy route directly
      const res = await axios.post("/api/upload-session-documents", formData, {
        headers: {
          Accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const response = res.data;

      // 3. Handle success response
      if (
        response &&
        (response.success || response.code === 200 || response.status)
      ) {
        toast.success("Document uploaded successfully!");
        const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);

        // In Postman response, data is an array of strings: data: ["uploads/..."]
        const uploadedFilePath = Array.isArray(response?.data)
          ? response.data[0]
          : response?.data?.file_url ||
          response?.data?.url ||
          response?.data?.document;

        const uploadedDocObj = {
          id: Date.now(),
          file_name: file.name,
          file_type: extMatch ? extMatch[1].toUpperCase() : "DOC",
          file_url: uploadedFilePath || URL.createObjectURL(file),
        };

        setTherapistDocuments((prev) => [...prev, uploadedDocObj]);
        fetchSessionDocuments();
      } else {
        toast.error(response?.message || "Failed to upload document.");
      }
    } catch (err: any) {
      console.error("Error uploading document in VideoConference:", err);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Error uploading document"
      );
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

      if (
        typeof val?.seconds === "number" &&
        !isNaN(val.seconds) &&
        val.seconds > 0
      ) {
        return val.seconds * 1000;
      }

      if (typeof val === "number" && !isNaN(val) && val > 0) {
        if (val < 1e11) return val * 1000;
        return val;
      }

      if (typeof val === "string" && val.trim() !== "") {
        const parsed = new Date(val).getTime();
        if (
          !isNaN(parsed) &&
          parsed > 0 &&
          new Date(parsed).getFullYear() > 1970
        ) {
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

    const messagesCollection = collection(
      db,
      "chats",
      chatChannelName,
      "messages"
    );

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
              updateDoc(
                doc(db, "chats", chatChannelName, "messages", docSnap.id),
                {
                  seen: true,
                }
              );
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

  //call end initilze

  // Send Message Handler
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = chatInputText.trim();
    if (!textToSend || !db || !chatChannelName) return;

    try {
      const messagesCollection = collection(
        db,
        "chats",
        chatChannelName,
        "messages"
      );
      setChatInputText("");
      const therapistId = parsedUser?.user?.id || videoCallSession?.uid || "";
      const currentSenderId = therapistId
        ? `therapist_${therapistId}`
        : "therapist";
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
      if (
        typeof field === "string" &&
        /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(field.trim())
      ) {
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

        const payload = {
          therapy_session_id: sessionId,
        };

        const res = await requestApi({
          endpoint: "therapist-call-joined",
          method: "POST",
          data: payload,
          isFormData: false,
        });
        console.log("therapist-call-joined API call", res);
        if (res && (res.success || res.code === 200) && res.data) {
          setJoinedCallData(res.data);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              `call_joined_${sessionId}`,
              JSON.stringify(res.data)
            );
            window.dispatchEvent(
              new CustomEvent("callJoinedUpdated", { detail: res.data })
            );
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
    const getFullImgUrl = (
      imgRelPath?: string,
      fallback: string = "/images/header-user-right-profile.svg"
    ) => {
      if (!imgRelPath) return fallback;
      const trimmed = imgRelPath.trim();
      if (!trimmed) return fallback;
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("data:")
      ) {
        return trimmed;
      }
      return `${Base_image_url.replace(/\/+$/, "")}/${trimmed.replace(
        /^\/+/,
        ""
      )}`;
    };

    const therapistData = joinedCallData?.therapist;
    const patientData = joinedCallData?.patient;

    const tName = therapistData?.name
      ? `Dr. ${therapistData.name} ${therapistData.surname_one || ""}`.trim() +
      " (Host)"
      : `${doctorFullName} (Host)`;

    const tImg = therapistData?.profile_image
      ? getFullImgUrl(therapistData.profile_image, doctorProfileImgUrl)
      : doctorProfileImgUrl;

    const pName = patientData?.name
      ? `${patientData.name} ${patientData.surname_one || ""}`.trim()
      : dynamicPatientName || "Patient";

    const pImg = patientData?.profile_image
      ? getFullImgUrl(
        patientData.profile_image,
        "/images/header-user-right-profile.svg"
      )
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

  // Publish Audio & Video Tracks independently so audio NEVER depends on camera
  usePublish([localMicrophoneTrack], Boolean(localMicrophoneTrack));
  usePublish(
    [localCameraTrack],
    Boolean(localCameraTrack && hasCameraDevice && cameraActive)
  );

  const router = useRouter();

  const [showLeavePopup, setShowLeavePopup] = useState<boolean>(false);
  const [isEndingCall, setIsEndingCall] = useState<boolean>(false);
  const [isCallEnded, setIsCallEnded] = useState<boolean>(false);
  const pendingDestinationRef = useRef<string | null>(null);

  const isPatientJoined = Boolean(
    remoteUsers.length > 0 ||
    primaryRemoteUser ||
    joinedCallData?.patient
  );

  const isCallActive = Boolean(!isCallEnded);

  const executeRecordingUpload = async (blob: Blob, transcriptToSend: string) => {
    const sessionId =
      activeSessionId ||
      rawSessionId ||
      therapySessionId ||
      videoCallSession.therapy_session_id ||
      searchParams.get("therapy_session_id") ||
      searchParams.get("session_id") ||
      searchParams.get("id") ||
      "";

    const audioFile = new File(
      [blob],
      `session_recording_${sessionId}_${Date.now()}.webm`,
      {
        type: blob.type || "audio/webm",
      }
    );

    const textToSend = (transcriptToSend || "").trim();

    const formData = new FormData();
    formData.append("therapy_session_id", String(sessionId));
    formData.append("session_recording_url", audioFile);
    formData.append(
      "session_recording_text",
      textToSend || "Session audio recording transcript."
    );
    formData.append(
      "transcript",
      textToSend || "Session audio recording transcript."
    );

    let token: string | undefined;
    try {
      const savedDetails = localStorage.getItem("loginUser");
      const parsed = savedDetails ? JSON.parse(savedDetails) : null;
      token = parsed?.token;
    } catch (err) {
      console.error("Error reading token:", err);
    }

    const res = await axios.post("/api/store-session-recording", formData, {
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    return res.data;
  };

  const handleConfirmLeaveAndEndSession = async () => {
    setIsEndingCall(true);
    const sessionId =
      activeSessionId ||
      rawSessionId ||
      therapySessionId ||
      videoCallSession.therapy_session_id ||
      searchParams.get("therapy_session_id") ||
      searchParams.get("session_id") ||
      searchParams.get("id") ||
      "";

    try {
      // 1. Stop voice recording if recording
      let blobToUpload = audioBlob;
      let transcriptToUpload =
        transcriptTextRef.current ||
        finalTranscriptRef.current ||
        transcriptText ||
        "Session audio recording transcript.";

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error("Recording stop error:", e);
        }
      }

      if (!blobToUpload && audioChunksRef.current.length > 0) {
        blobToUpload = new Blob(audioChunksRef.current, { type: "audio/webm" });
      }

      // 2. Update Firebase call status to "ended"
      if (sessionId) {
        try {
          const callDocRef = doc(db, "video_session_calls", String(sessionId));
          await setDoc(
            callDocRef,
            {
              status: "ended",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (firebaseErr) {
          console.error("Firebase update ended error:", firebaseErr);
        }

        // 3. Call therapist-end-call and therapist-refresh-token APIs
        const payload = {
          therapy_session_id: String(sessionId),
        };

        try {
          await Promise.allSettled([
            requestApi({
              endpoint: "therapist-end-call",
              method: "POST",
              data: payload,
              isFormData: false,
            }),
            requestApi({
              endpoint: "therapist-refresh-token",
              method: "POST",
              data: payload,
              isFormData: false,
            }),
          ]);
        } catch (callEndErr) {
          console.error("Error calling therapist-end-call API:", callEndErr);
        }

        // 4. Call session-end API
        try {
          const res = await requestApi({
            endpoint: "session-end",
            method: "POST",
            data: payload,
            isFormData: false,
          });
          console.log("session-end API response:", res);
        } catch (sessionEndErr) {
          console.error("Error calling session-end API:", sessionEndErr);
        }

        // 5. Upload recording and transcript via store-session-recording API
        try {
          const fallbackBlob =
            blobToUpload && blobToUpload.size > 0
              ? blobToUpload
              : new Blob([""], { type: "audio/webm" });

          const uploadRes = await executeRecordingUpload(
            fallbackBlob,
            transcriptToUpload
          );
          console.log("store-session-recording API response:", uploadRes);
        } catch (uploadErr) {
          console.error("Error uploading recording on leave:", uploadErr);
        }

        // 6. Clean up localStorage / sessionStorage
        try {
          localStorage.removeItem(`call_joined_${sessionId}`);
          window.dispatchEvent(
            new CustomEvent("callJoinedUpdated", { detail: null })
          );
          sessionStorage.removeItem("start_session_data");
        } catch (e) { }
      }

      // 7. Stop local Agora tracks
      try {
        if (localMicrophoneTrack) {
          localMicrophoneTrack.stop();
          localMicrophoneTrack.close();
        }
        if (localCameraTrack) {
          localCameraTrack.stop();
          localCameraTrack.close();
        }
      } catch (e) { }

      setIsCallEnded(true);
      setShowLeavePopup(false);
      toast.success("Session ended successfully.");

      // 8. Seedha dashboard par bhejein
      router.replace("/dashboard");
    } catch (err) {
      console.error("Error during leave and end session:", err);
      setIsEndingCall(false);
      setShowLeavePopup(false);
      router.replace("/dashboard");
    }
  };

  // const handleConfirmLeaveAndEndSession = async () => {
  //   setIsEndingCall(true);
  //   const sessionId =
  //     activeSessionId ||
  //     rawSessionId ||
  //     therapySessionId ||
  //     videoCallSession.therapy_session_id ||
  //     searchParams.get("therapy_session_id") ||
  //     searchParams.get("session_id") ||
  //     searchParams.get("id") ||
  //     "";

  //   try {
  //     // 1. Stop voice recording if recording
  //     let blobToUpload = audioBlob;
  //     let transcriptToUpload =
  //       transcriptTextRef.current ||
  //       finalTranscriptRef.current ||
  //       transcriptText ||
  //       "Session audio recording transcript.";

  //     if (
  //       mediaRecorderRef.current &&
  //       mediaRecorderRef.current.state === "recording"
  //     ) {
  //       try {
  //         mediaRecorderRef.current.stop();
  //       } catch (e) {
  //         console.error("Recording stop error:", e);
  //       }
  //     }

  //     if (!blobToUpload && audioChunksRef.current.length > 0) {
  //       blobToUpload = new Blob(audioChunksRef.current, { type: "audio/webm" });
  //     }

  //     // 2. Update Firebase call status to "ended"
  //     if (sessionId) {
  //       try {
  //         const callDocRef = doc(db, "video_session_calls", String(sessionId));
  //         await setDoc(
  //           callDocRef,
  //           {
  //             status: "ended",
  //             updatedAt: serverTimestamp(),
  //           },
  //           { merge: true }
  //         );
  //       } catch (firebaseErr) {
  //         console.error("Firebase update ended error:", firebaseErr);
  //       }

  //       // 3. Call therapist-end-call and therapist-refresh-token APIs
  //       const payload = {
  //         therapy_session_id: String(sessionId),
  //       };

  //       try {
  //         await Promise.allSettled([
  //           requestApi({
  //             endpoint: "therapist-end-call",
  //             method: "POST",
  //             data: payload,
  //             isFormData: false,
  //           }),
  //           requestApi({
  //             endpoint: "therapist-refresh-token",
  //             method: "POST",
  //             data: payload,
  //             isFormData: false,
  //           }),
  //         ]);
  //       } catch (callEndErr) {
  //         console.error("Error calling therapist-end-call API:", callEndErr);
  //       }

  //       // 4. Call session-end API
  //       try {
  //         const res = await requestApi({
  //           endpoint: "session-end",
  //           method: "POST",
  //           data: payload,
  //           isFormData: false,
  //         });
  //         console.log("session-end API response:", res);
  //       } catch (sessionEndErr) {
  //         console.error("Error calling session-end API:", sessionEndErr);
  //       }

  //       // 5. Upload recording and transcript via store-session-recording API
  //       try {
  //         const fallbackBlob =
  //           blobToUpload && blobToUpload.size > 0
  //             ? blobToUpload
  //             : new Blob([""], { type: "audio/webm" });

  //         const uploadRes = await executeRecordingUpload(
  //           fallbackBlob,
  //           transcriptToUpload
  //         );
  //         console.log("store-session-recording API response:", uploadRes);
  //       } catch (uploadErr) {
  //         console.error("Error uploading recording on leave:", uploadErr);
  //       }

  //       // 6. Clean up localStorage / sessionStorage
  //       try {
  //         localStorage.removeItem(`call_joined_${sessionId}`);
  //         window.dispatchEvent(
  //           new CustomEvent("callJoinedUpdated", { detail: null })
  //         );
  //         sessionStorage.removeItem("start_session_data");
  //       } catch (e) { }
  //     }

  //     // 7. Stop local Agora tracks
  //     try {
  //       if (localMicrophoneTrack) {
  //         localMicrophoneTrack.stop();
  //         localMicrophoneTrack.close();
  //       }
  //       if (localCameraTrack) {
  //         localCameraTrack.stop();
  //         localCameraTrack.close();
  //       }
  //     } catch (e) { }

  //     setIsCallEnded(true);
  //     setShowLeavePopup(false);
  //     toast.success("Session ended successfully.");

  //     // 8. Redirect to the pending destination
  //     const targetDest = pendingDestinationRef.current || "/dashboard";
  //     if (targetDest === "back") {
  //       router.back();
  //     } else {
  //       router.push(targetDest);
  //     }
  //   } catch (err) {
  //     console.error("Error during leave and end session:", err);
  //     setIsEndingCall(false);
  //     setShowLeavePopup(false);
  //     const targetDest = pendingDestinationRef.current || "/dashboard";
  //     if (targetDest === "back") {
  //       router.back();
  //     } else {
  //       router.push(targetDest);
  //     }
  //   }
  // };

  const handleCancelLeave = () => {
    setShowLeavePopup(false);
    pendingDestinationRef.current = null;
  };

  // Intercept navigation clicks outside the conference area while therapist and patient are in the call
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleClickCapture = (e: MouseEvent) => {
      if (!isCallActive) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore clicks inside our leave popup
      if (
        target.closest("#sessionLeaveConfirmModal") ||
        target.closest(".ps-leave-session-overlay")
      ) {
        return;
      }

      // Ignore intentional End Call / End Session buttons (they already open #endSessionModal)
      if (
        target.closest('[data-bs-target="#endSessionModal"]') ||
        target.closest(".ps-session-dock-btn-end") ||
        target.closest(".action-btn-outline")
      ) {
        return;
      }

      // Ignore "View Filled Form" which opens in a new tab
      if (
        target.closest('a[target="_blank"]') ||
        (target.closest("button") &&
          target.textContent?.includes("View Filled Form"))
      ) {
        return;
      }

      // If clicked inside conference workspace (video, notes, chat, upload, controls), don't intercept
      const isInsideConference = Boolean(
        target.closest(".ps-session-conference-main")
      );
      if (isInsideConference) {
        return;
      }

      // User clicked outside the conference work area (Sidebar, Header, brand block, back button, nav link)
      let destination: string = "/dashboard";
      const anchor = target.closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href");
        if (href && href !== "#" && !href.startsWith("javascript:")) {
          destination = href;
        }
      } else if (target.closest(".gl-header-panel-title")) {
        destination = "/back-to-calendar";
      } else if (target.closest(".gl-brand-block")) {
        destination = "/dashboard";
      } else if (target.closest(".gl-menu-item")) {
        const a = target.closest(".gl-menu-item")?.querySelector("a");
        const href = a?.getAttribute("href");
        if (href && href !== "#") {
          destination = href;
        }
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      pendingDestinationRef.current = destination;
      setShowLeavePopup(true);
    };

    window.addEventListener("click", handleClickCapture, true);

    const handlePopState = (e: PopStateEvent) => {
      if (!isCallActive) return;
      window.history.pushState(null, "", window.location.href);
      pendingDestinationRef.current = "back";
      setShowLeavePopup(true);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isCallActive) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("click", handleClickCapture, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isCallActive]);

  const handleEndCall = useCallback(async () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("start_session_data");
      } catch (e) {
        console.error("Error clearing start_session_data on end call:", e);
      }
    }
    const sessionId =
      therapySessionId ||
      videoCallSession.therapy_session_id ||
      searchParams.get("therapy_session_id") ||
      searchParams.get("session_id") ||
      searchParams.get("id") ||
      "";

    if (sessionId) {
      try {
        const payload = {
          therapy_session_id: String(sessionId),
        };

        await Promise.allSettled([
          requestApi({
            endpoint: "therapist-end-call",
            method: "POST",
            data: payload,
            isFormData: false,
          }),
          requestApi({
            endpoint: "therapist-refresh-token",
            method: "POST",
            data: payload,
            isFormData: false,
          }),
        ]);
      } catch (err) {
        console.error("Error calling end-call / refresh-token endpoints:", err);
      }
    }

    if (onEndCall) {
      onEndCall();
    }
  }, [therapySessionId, videoCallSession, searchParams, onEndCall]);

  // LocalStorage time monitor: 5 min pehle warning toast aur time khatam hone par auto handleEndCall()
  const warningShownRef = useRef<boolean>(false);
  const endCallTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!rawSessionId || typeof window === "undefined") return;

    warningShownRef.current = false;
    endCallTriggeredRef.current = false;

    const getCallDataFromStorage = () => {
      try {
        const stored = localStorage.getItem(`call_joined_${rawSessionId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setJoinedCallData((prev: any) => prev || parsed);
          return parsed;
        }
      } catch (e) { }
      return null;
    };

    let currentCallData = getCallDataFromStorage();

    const handleCallJoinedUpdate = (e: any) => {
      if (e?.detail) {
        currentCallData = e.detail;
        setJoinedCallData(e.detail);
      } else {
        currentCallData = getCallDataFromStorage();
      }
    };

    window.addEventListener("callJoinedUpdated", handleCallJoinedUpdate);

    const checkSessionTimer = () => {
      if (!currentCallData) {
        currentCallData = getCallDataFromStorage();
      }
      if (!currentCallData?.started_at) return;

      const startTimeMs = new Date(currentCallData.started_at).getTime();
      if (isNaN(startTimeMs) || startTimeMs <= 0) return;

      const maxDurationSec =
        Number(
          currentCallData?.patient?.ai_chat_duration ||
          currentCallData?.ai_chat_duration ||
          currentCallData?.duration ||
          1800
        ) || 1800;

      const warningThresholdSec = Math.max(0, maxDurationSec - 300); // 5 min (300s) pehle
      const elapsedSec = Math.floor((Date.now() - startTimeMs) / 1000);

      // 1. Time khatam hone se 5 min pehle warning toast (sirf ek baar)
      if (
        !warningShownRef.current &&
        elapsedSec >= warningThresholdSec &&
        elapsedSec < maxDurationSec
      ) {
        warningShownRef.current = true;
        toast("Call will end in 5 minutes", {
          icon: "⏳",
          duration: 5000,
        });
      }

      // 2. Time pura hone par automatically handleEndCall() hit karein (sirf ek baar)
      if (!endCallTriggeredRef.current && elapsedSec >= maxDurationSec) {
        endCallTriggeredRef.current = true;
        clearInterval(intervalId);
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          try {
            mediaRecorderRef.current.stop();
          } catch (e) { }
        }
        handleEndCall();
      }
    };

    checkSessionTimer();
    const intervalId = setInterval(checkSessionTimer, 1000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("callJoinedUpdated", handleCallJoinedUpdate);
    };
  }, [rawSessionId, handleEndCall]);

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
    if (!hasCameraDevice) {
      toast.error("No camera device detected on your system.");
      return;
    }
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
    <main className="gl-content-body ps-session-conference-main">
      <style>{`
        .ps-session-conference-main {
          min-height: calc(100vh - 79px);
          overflow-y: auto !important;
          padding: 20px 30px;
        }
        .ps-session-page-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 20px;
          max-width: 1400px;
          margin: 0 auto;
          height: calc(100vh - 120px) !important;
          min-height: 520px;
          overflow: visible !important;
        }
        body.video-zoomed-active {
          overflow: hidden !important;
        }
        body.video-zoomed-active .gl-sidebar,
        body.video-zoomed-active .gl-header,
        body.video-zoomed-active .ps-session-right-sidebar {
          display: none !important;
        }
        body.video-zoomed-active .gl-dashboard-layout {
          padding: 0 !important;
          margin: 0 !important;
          background: #000000 !important;
        }
        body.video-zoomed-active .gl-main-content-wrapper {
          width: 100vw !important;
          max-width: 100vw !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #000000 !important;
        }
        body.video-zoomed-active .ps-session-conference-main {
          padding: 0 !important;
          margin: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          background: #000000 !important;
        }
        body.video-zoomed-active .ps-session-page-grid {
          display: block !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .ps-session-video-panel {
          display: flex !important;
          flex-direction: column !important;
          background-color: #000000;
          border-radius: 28px;
          overflow: hidden !important;
          height: 100% !important;
          min-height: 480px;
          position: relative;
          transition: border-radius 0.2s ease;
        }
        .ps-session-video-panel.is-fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          border-radius: 0 !important;
          z-index: 9999999 !important;
          margin: 0 !important;
          background-color: #000000 !important;
        }
        .ps-session-video-panel:fullscreen,
        .ps-session-video-panel:-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          border-radius: 0 !important;
          background-color: #000000 !important;
        }
        .ps-session-zoom-top-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: rgba(0, 0, 0, 0.6);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          backdrop-filter: blur(6px);
          transition: all 0.2s ease;
        }
        .ps-session-zoom-top-btn:hover {
          background-color: rgba(0, 0, 0, 0.85);
          border-color: rgba(255, 255, 255, 0.45);
          transform: scale(1.03);
        }
        .ps-session-video-viewport {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          background-color: #e5c5b5;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .ps-session-video-controls-dock {
          flex-shrink: 0 !important;
          background-color: #000000;
          padding: 14px 24px !important;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 28px;
          position: relative;
          z-index: 15;
        }
        .ps-session-right-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100% !important;
          max-height: calc(100vh - 120px) !important;
          overflow-y: auto !important;
          padding-right: 8px;
        }
        @media (max-width: 1024px) {
          .ps-session-page-grid {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          .ps-session-video-panel {
            height: 60vh !important;
            min-height: 400px !important;
            max-height: 580px !important;
            margin-bottom: 20px;
          }
          .ps-session-right-sidebar {
            height: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
          }
        }
      `}</style>
      <div className="ps-session-page-grid">
        <div
          ref={videoPanelRef}
          className={`ps-session-video-panel${isVideoZoomed ? " is-fullscreen" : ""
            }`}
        >
          {/* Main Video Viewport */}
          <div className="ps-session-video-viewport">
            {/* Top Right Zoom / Small Screen Toggle Button */}
            <button
              type="button"
              onClick={toggleZoomScreen}
              className="ps-session-zoom-top-btn"
              title={isVideoZoomed ? "Small Screen (Exit Zoom)" : "Zoom Full Screen"}
            >
              {isVideoZoomed ? (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                  <span>Small Screen</span>
                </>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                  <span>Zoom Screen</span>
                </>
              )}
            </button>

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
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "14px",
                  height: "100%",
                  width: "100%",
                  color: "#fff",
                  textAlign: "center",
                }}
              >
                {typeof patientImgUrl === "string" &&
                  patientImgUrl
                    .replace(/\\\//g, "/")
                    .trim()
                    .startsWith("https://onyba.tgastaging.com/") ? (
                  <img
                    src={patientImgUrl.replace(/\\\//g, "/").trim()}
                    alt={patientDisplayName || dynamicPatientName || "Participant"}
                    onError={() => setPatientImgUrl("")}
                    style={{
                      width: "84px",
                      height: "84px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "84px",
                      height: "84px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "28px",
                      fontWeight: 600,
                      color: "#ffffff",
                    }}
                  >
                    {(patientDisplayName || dynamicPatientName || "P")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <p
                  style={{
                    fontSize: "16px",
                    color: "#ffffff",
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  Waiting for{" "}
                  {patientDisplayName || dynamicPatientName || "participant"} to
                  join...
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
                videoTrack={
                  hasCameraDevice && cameraActive ? localCameraTrack : undefined
                }
                cameraOn={
                  hasCameraDevice && cameraActive && Boolean(localCameraTrack)
                }
                micOn={micActive}
                playAudio={false}
                cover={doctorProfileImgUrl || "/images/dash-user-icon.svg"}
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
                  You ({doctorFullName})
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

            {/* Zoom / Fullscreen Button */}
            <button
              type="button"
              className="ps-session-dock-btn"
              onClick={toggleZoomScreen}
              title={isVideoZoomed ? "Small Screen (Exit Zoom)" : "Zoom Full Screen"}
            >
              <div
                className="ps-session-dock-icon-circle"
                style={{
                  backgroundColor: isVideoZoomed ? "#603741" : undefined,
                  color: isVideoZoomed ? "#fff" : undefined,
                }}
              >
                {isVideoZoomed ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: "20px", height: "20px" }}
                  >
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: "20px", height: "20px" }}
                  >
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </div>
              {isVideoZoomed ? "Small Screen" : "Zoom Screen"}
            </button>

            {/* <button className="ps-session-dock-btn">
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
            </button> */}

            <button
              className="ps-session-dock-btn ps-session-dock-btn-end"
              data-bs-toggle="modal"
              data-bs-target="#endSessionModal"
              onClick={async () => {
                // Stop recording
                if (
                  mediaRecorderRef.current &&
                  mediaRecorderRef.current.state === "recording"
                ) {
                  try {
                    mediaRecorderRef.current.stop();
                  } catch (e) {
                    console.error("Recording stop error:", e);
                  }
                }

                // Update Firebase directly
                try {
                  const sessionId = activeSessionId;

                  if (!sessionId) {
                    console.error("Session ID not found");
                    return;
                  }

                  const callDocRef = doc(db, "video_session_calls", sessionId);

                  await setDoc(
                    callDocRef,
                    {
                      status: "ended",
                      updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                  );

                  console.log("Firebase call status updated: ended");
                } catch (error) {
                  console.error("Firebase End Call Error:", error);
                }
              }}
            >
              <div className="ps-session-dock-icon-circle">
                <img src="/images/endCallicon.png" alt="endCallicon" />
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                {/* Font Size Dropdown */}
                <span
                  style={{
                    cursor: "pointer",
                    position: "relative",
                    fontSize: "13px",
                  }}
                >
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
                    onChange={(e) =>
                      execNotesCommand("fontSize", e.target.value)
                    }
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
                <span
                  style={{
                    cursor: "pointer",
                    position: "relative",
                    fontSize: "14px",
                  }}
                >
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
                    onChange={(e) =>
                      execNotesCommand("foreColor", e.target.value)
                    }
                  />
                </span>

                {/* Bold */}
                <strong
                  style={{
                    cursor: "pointer",
                    padding: "2px 6px",
                    userSelect: "none",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("bold");
                  }}
                >
                  B
                </strong>

                {/* Italic */}
                <em
                  style={{
                    cursor: "pointer",
                    padding: "2px 6px",
                    userSelect: "none",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("italic");
                  }}
                >
                  I
                </em>

                {/* Underline */}
                <span
                  style={{
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: "2px 6px",
                    userSelect: "none",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execNotesCommand("underline");
                  }}
                >
                  U
                </span>

                {/* Strikethrough */}
                <span
                  style={{
                    textDecoration: "line-through",
                    cursor: "pointer",
                    padding: "2px 6px",
                    userSelect: "none",
                  }}
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

                  const rawFileUrl =
                    msg.fileUrl ||
                    (msg as any).file_url ||
                    (msg as any).url ||
                    "";
                  const rawFileName =
                    msg.fileName ||
                    (msg as any).file_name ||
                    (msg as any).name ||
                    "";
                  const rawFileType = (
                    msg.fileType ||
                    (msg as any).file_type ||
                    ""
                  ).toLowerCase();

                  const isRawImageUrl =
                    !rawFileUrl &&
                    typeof msgText === "string" &&
                    /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(
                      msgText.trim()
                    );

                  const effectiveFileUrl =
                    rawFileUrl || (isRawImageUrl ? msgText.trim() : "");
                  const effectiveFileName =
                    rawFileName ||
                    (effectiveFileUrl
                      ? effectiveFileUrl.split("/").pop()?.split("?")[0]
                      : "");

                  const isImg =
                    Boolean(effectiveFileUrl) &&
                    (rawFileType === "image" ||
                      rawFileType.startsWith("image/") ||
                      /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic)(\?.*)?$/i.test(
                        (effectiveFileName || effectiveFileUrl).toLowerCase()
                      ));

                  const displayText =
                    effectiveFileUrl &&
                      msgText.trim() === effectiveFileUrl.trim()
                      ? ""
                      : msgText;

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
                              : patientImgUrl ||
                              "/images/header-user-right-profile.svg"
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
                        <div
                          className="ps-session-msg-text-bubble"
                          style={
                            isImg && !displayText
                              ? {
                                padding: "4px",
                                backgroundColor: "transparent",
                              }
                              : undefined
                          }
                        >
                          {effectiveFileUrl && isImg && (
                            <a
                              href={effectiveFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "block",
                                textDecoration: "none",
                              }}
                            >
                              <img
                                src={effectiveFileUrl}
                                alt={effectiveFileName || "Image"}
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "220px",
                                  borderRadius: "10px",
                                  objectFit: "cover",
                                  display: "block",
                                  cursor: "pointer",
                                  marginBottom: displayText ? "6px" : "0",
                                }}
                                loading="lazy"
                              />
                            </a>
                          )}

                          {effectiveFileUrl && !isImg && (
                            <a
                              href={effectiveFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                backgroundColor: isDoctorMsg
                                  ? "rgba(255, 255, 255, 0.18)"
                                  : "rgba(0, 0, 0, 0.05)",
                                color: "inherit",
                                textDecoration: "none",
                                marginBottom: displayText ? "6px" : "0",
                              }}
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ flexShrink: 0 }}
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                              </svg>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  wordBreak: "break-all",
                                  flexGrow: 1,
                                }}
                              >
                                {effectiveFileName || "View File"}
                              </span>
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ flexShrink: 0 }}
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          )}

                          {displayText
                            ? displayText
                            : !effectiveFileUrl
                              ? msgText
                              : null}
                        </div>
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
                className={`ps-session-tab ${docTab === "therapist" ? "ps-session-active-tab" : ""
                  }`}
                style={{ cursor: "pointer" }}
                onClick={() => setDocTab("therapist")}
              >
                Shared by you{" "}
                <span className="ps-session-badge-count">
                  {therapistDocuments.length}
                </span>
              </div>
              <div
                className={`ps-session-tab ${docTab === "patient" ? "ps-session-active-tab" : ""
                  }`}
                style={{ cursor: "pointer" }}
                onClick={() => setDocTab("patient")}
              >
                Shared by Patient{" "}
                <span className="ps-session-badge-count">
                  {patientDocuments.length}
                </span>
              </div>
            </div>

            {/* Document Items List */}
            {isFetchingDocs ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "12px",
                  fontSize: "12px",
                  color: "#8c8c8c",
                }}
              >
                Loading documents...
              </div>
            ) : (docTab === "therapist" ? therapistDocuments : patientDocuments)
              .length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "12px",
                  fontSize: "12px",
                  color: "#8c8c8c",
                }}
              >
                No documents found.
              </div>
            ) : (
              (docTab === "therapist"
                ? therapistDocuments
                : patientDocuments
              ).map((docItem, idx) => (
                <div
                  className="ps-session-file-attachment-row"
                  key={docItem.id || idx}
                >
                  <div>
                    <div className="ps-session-file-title">
                      {docItem.file_name}
                    </div>
                    <div className="ps-session-file-meta">
                      {docItem.file_type
                        ? `${docItem.file_type} File`
                        : "Document"}
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

          {/* Dynamic Participants Card */}
          {(() => {
            const patientData = joinedCallData?.patient;
            const expectedPatientUid =
              videoCallSession?.patient_uid ||
              patientData?.uid ||
              patientData?.id;

            // Identify which remoteUser is the patient so we don't render them twice
            const patientRemoteUser =
              remoteUsers.find(
                (u) =>
                  expectedPatientUid &&
                  String(u.uid) === String(expectedPatientUid)
              ) ||
              (remoteUsers.length === 1 && patientData
                ? remoteUsers[0]
                : undefined);

            const extraRemoteUsers = remoteUsers.filter(
              (u) =>
                !patientRemoteUser ||
                String(u.uid) !== String(patientRemoteUser.uid)
            );

            const hasPatient = Boolean(patientData || patientRemoteUser);
            const totalParticipantsCount =
              1 + (hasPatient ? 1 : 0) + extraRemoteUsers.length;

            const isPatientMicOn = patientRemoteUser
              ? patientRemoteUser.hasAudio
              : true;

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
                      <span>
                        {therapistDisplayName || `${doctorFullName} (Host)`}
                      </span>
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

                  {/* Patient Participant (Merged API + Agora Stream) */}
                  {hasPatient && (
                    <div className="ps-session-participant-line">
                      <div className="ps-session-participant-meta">
                        <div className="ps-session-chat-sender-avatar">
                          <img
                            src={
                              patientImgUrl ||
                              "/images/header-user-right-profile.svg"
                            }
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
                        <span>
                          {patientDisplayName ||
                            dynamicPatientName ||
                            (patientRemoteUser
                              ? `Participant (${patientRemoteUser.uid})`
                              : "Patient")}
                        </span>
                      </div>
                      <svg
                        className={`ps-session-status-icon-right ${isPatientMicOn
                          ? "ps-session-mic-on"
                          : "ps-session-mic-off"
                          }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        {isPatientMicOn ? (
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
                  )}

                  {/* Extra Remote Users (Excluding Patient) */}
                  {extraRemoteUsers.map((user) => (
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
                              objectFit: "cover",
                              overflow: "hidden",
                            }}
                          />
                        </div>
                        <span>Participant ({user.uid})</span>
                      </div>
                      <svg
                        className={`ps-session-status-icon-right ${user.hasAudio
                          ? "ps-session-mic-on"
                          : "ps-session-mic-off"
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
      <EndSession
        sessionId={rawSessionId || undefined}
        audioBlob={audioBlob}
        transcript={transcriptText || transcriptTextRef.current}
        getRecordingData={getRecordingData}
        onConfirmEnd={handleEndCall}
      />

      {/* Leave Session Confirmation Modal */}
      {showLeavePopup && (
        <div
          className="modal fade show"
          id="sessionLeaveConfirmModal"
          tabIndex={-1}
          style={{
            display: "block",
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            zIndex: 999999,
          }}
          aria-modal="true"
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered onyba-end-dialog">
            <div className="modal-content onyba-end-content">
              <button
                type="button"
                className="onyba-end-close-cross"
                onClick={handleCancelLeave}
                disabled={isEndingCall}
                aria-label="Close"
              >
                <img src="/images/close-btn-popup.svg" alt="&times;" />
              </button>

              <div className="modal-body onyba-end-body">
                <div className="onyba-end-icon-circle">
                  <img src="/images/call-cut.svg" alt="End Call" />
                </div>

                <h5 className="onyba-end-title">End Session & Leave?</h5>

                <p className="onyba-end-desc">
                  You are currently in an active session with the patient.<br />
                  Leaving this page will end the session and save your recording.
                </p>

                <div className="onyba-end-info-panel">
                  <div className="onyba-end-log-row">
                    <span className="onyba-end-check-icon">
                      <img src="/images/check-icon-popup.svg" alt="" />
                    </span>
                    <p>Session call will be ended</p>
                  </div>
                  <div className="onyba-end-log-row">
                    <span className="onyba-end-check-icon">
                      <img src="/images/check-icon-popup.svg" alt="" />
                    </span>
                    <p>Audio recording will be saved</p>
                  </div>
                  <div className="onyba-end-log-row">
                    <span className="onyba-end-check-icon">
                      <img src="/images/check-icon-popup.svg" alt="" />
                    </span>
                    <p>You will be redirected safely</p>
                  </div>
                </div>

                <div className="onyba-end-actions-row">
                  <button
                    type="button"
                    className="onyba-end-btn-cancel"
                    onClick={handleCancelLeave}
                    disabled={isEndingCall}
                  >
                    No, Stay
                  </button>
                  <button
                    type="button"
                    className="onyba-end-btn-confirm"
                    onClick={handleConfirmLeaveAndEndSession}
                    disabled={isEndingCall}
                  >
                    {isEndingCall ? "Ending Session..." : "Yes, End Session"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

// 2. Exported Parent Wrapper providing the Agora RTC Client
const VideoConfrence: React.FC<VideoConferenceProps> = (props) => {
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );

  return (
    <AgoraRTCProvider client={client}>
      <VideoRoomInner {...props} />
    </AgoraRTCProvider>
  );
};

export default VideoConfrence;

//date20-11-2026

// "use client";

// import React, { useState, useEffect, useRef, useCallback } from "react";
// import { useSearchParams, useRouter } from "next/navigation";
// import toast from "react-hot-toast";
// import EndSession from "@/src/component/meetingmodal/EndSession";
// import AgoraRTC, {
//   AgoraRTCProvider,
//   useRTCClient,
//   useLocalMicrophoneTrack,
//   useLocalCameraTrack,
//   usePublish,
//   useJoin,
//   useRemoteUsers,
//   LocalUser,
//   RemoteUser,
// } from "agora-rtc-react";
// import { requestApi } from "@/src/utils/api";
// import { Base_image_url } from "@/src/config";
// import { db } from "@/src/utils/firebaseConfig";
// import {
//   collection,
//   addDoc,
//   updateDoc,
//   doc,
//   query,
//   orderBy,
//   onSnapshot,
//   serverTimestamp,
//   Timestamp,
//   getDoc,
//   setDoc,
// } from "firebase/firestore";
// import { uploadMedia } from "@/src/utils/formdataApi";
// import axios from "axios";

// export interface FirebaseChatMessage {
//   id?: string;
//   message?: string;
//   text?: string;
//   senderId?: string;
//   receiverId?: string;
//   seen?: boolean;
//   timestamp?: any;
//   sender?: string;
//   sender_name?: string;
//   sender_type?: string;
//   sender_id?: string | number;
//   created_at?: any;
//   fileUrl?: string;
//   fileName?: string;
//   fileType?: string;
//   file_url?: string;
//   file_name?: string;
//   file_type?: string;
// }

// export interface VideoCallSession {
//   APP_ID: string;
//   security: string;
//   channel_name: string;
//   token: string;
//   call_id?: number | string;
//   uid?: number | string;
//   patient_uid?: number | string;
//   therapist_uid?: number | string;
//   expires_in?: string;
//   therapy_session_id?: string;
//   patient_name?: string;
// }

// export interface VideoConferenceProps {
//   videoCallSession: VideoCallSession;
//   therapySessionId?: string;
//   patientName?: string;
//   onEndCall?: () => void;
// }

// const getDocList = (docData: any) => {
//   if (!docData) return [];

//   const processSingleDoc = (item: any, idx: number) => {
//     if (!item) return null;
//     if (typeof item === "string") {
//       const trimmed = item.trim();
//       if (!trimmed) return null;
//       const parts = trimmed.split("/");
//       const fileName = parts[parts.length - 1] || trimmed;
//       const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
//       const ext = extMatch ? extMatch[1].toUpperCase() : "DOC";
//       const fullUrl =
//         trimmed.startsWith("http://") ||
//         trimmed.startsWith("https://") ||
//         trimmed.startsWith("data:")
//           ? trimmed
//           : `${Base_image_url.replace(/\/+$/, "")}/${trimmed.replace(
//               /^\/+/,
//               ""
//             )}`;
//       return {
//         id: idx,
//         file_name: fileName,
//         file_type: ext,
//         file_url: fullUrl,
//       };
//     }
//     if (typeof item === "object") {
//       const rawUrl =
//         item.file_url || item.url || item.path || item.file_name || "";
//       const fullUrl = rawUrl
//         ? rawUrl.startsWith("http://") ||
//           rawUrl.startsWith("https://") ||
//           rawUrl.startsWith("data:")
//           ? rawUrl
//           : `${Base_image_url.replace(/\/+$/, "")}/${rawUrl.replace(
//               /^\/+/,
//               ""
//             )}`
//         : "";
//       const fileName =
//         item.file_name ||
//         item.name ||
//         (rawUrl ? rawUrl.split("/").pop() : `Document_${idx + 1}`);
//       const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
//       const fileType =
//         item.file_type ||
//         item.ext ||
//         (extMatch ? extMatch[1].toUpperCase() : "PDF");

//       return {
//         ...item,
//         id: item.id || idx,
//         file_name: fileName,
//         file_type: fileType,
//         file_url: fullUrl,
//       };
//     }
//     return null;
//   };

//   if (typeof docData === "string") {
//     const paths = docData
//       .split(",")
//       .map((s) => s.trim())
//       .filter(Boolean);
//     return paths
//       .map((path, idx) => processSingleDoc(path, idx))
//       .filter(Boolean);
//   }

//   if (Array.isArray(docData)) {
//     return docData
//       .map((item, idx) => processSingleDoc(item, idx))
//       .filter(Boolean);
//   }

//   if (typeof docData === "object") {
//     const doc = processSingleDoc(docData, 0);
//     return doc ? [doc] : [];
//   }

//   return [];
// };

// // 1. Inner Room Component containing all Agora Hooks & UI
// const VideoRoomInner: React.FC<VideoConferenceProps> = ({
//   videoCallSession,
//   therapySessionId,
//   patientName,
//   onEndCall,
// }) => {
//   const searchParams = useSearchParams();
//   // console.log(videoCallSession, "video call session***");
//   const appIdToUse = videoCallSession.APP_ID;
//   const { channel_name, token } = videoCallSession;
//   const loginUserData =
//     typeof window !== "undefined" ? localStorage.getItem("loginUser") : null;
//   const parsedUser = loginUserData ? JSON.parse(loginUserData) : null;

//   // Get the full name with Dr. prefix
//   const doctorFirstName = parsedUser?.user?.name || "Doctor";
//   const doctorLastName = parsedUser?.user?.surname_one || "";
//   const doctorFullName = `Dr. ${doctorFirstName} ${doctorLastName}`.trim();
//   // const [certainEndCall, setCertainEndCall] = useState<boolean>(false);
//   // Get profile picture from localStorage loginUser
//   const rawDoctorImg =
//     parsedUser?.user?.profile_image || parsedUser?.profile_image;
//   const doctorProfileImgUrl = rawDoctorImg
//     ? rawDoctorImg.startsWith("http") ||
//       rawDoctorImg.startsWith("data:") ||
//       rawDoctorImg.startsWith("/")
//       ? rawDoctorImg
//       : `${Base_image_url}${
//           rawDoctorImg.startsWith("/") ? "" : "/"
//         }${rawDoctorImg}`
//     : "/images/dash-user-icon.svg";

//   // Camera Device Presence Detection
//   const [hasCameraDevice, setHasCameraDevice] = useState<boolean>(false);
//   const [micActive, setMicActive] = useState<boolean>(true);
//   const [cameraActive, setCameraActive] = useState<boolean>(false);

//   useEffect(() => {
//     let isMounted = true;
//     AgoraRTC.getCameras()
//       .then((cams) => {
//         if (isMounted) {
//           const available = Boolean(cams && cams.length > 0);
//           setHasCameraDevice(available);
//           setCameraActive(available);
//         }
//       })
//       .catch((err) => {
//         console.warn("Could not check camera devices:", err);
//         if (isMounted) {
//           setHasCameraDevice(false);
//           setCameraActive(false);
//         }
//       });

//     const handleDeviceChange = async () => {
//       try {
//         const cams = await AgoraRTC.getCameras();
//         if (isMounted) {
//           const available = Boolean(cams && cams.length > 0);
//           setHasCameraDevice(available);
//           if (!available) {
//             setCameraActive(false);
//           }
//         }
//       } catch (e) {
//         console.warn("Error checking camera devices on change:", e);
//       }
//     };

//     AgoraRTC.onCameraChanged = handleDeviceChange;
//     return () => {
//       isMounted = false;
//       AgoraRTC.onCameraChanged = undefined;
//     };
//   }, []);

//   // Agora Hooks (Audio always initialized; Camera initialized ONLY when camera device exists and is active)
//   const { localMicrophoneTrack } = useLocalMicrophoneTrack(true);
//   const { localCameraTrack, error: cameraError } = useLocalCameraTrack(
//     hasCameraDevice && cameraActive
//   );

//   useEffect(() => {
//     if (cameraError) {
//       console.warn("Camera track error:", cameraError);
//       setHasCameraDevice(false);
//       setCameraActive(false);
//     }
//   }, [cameraError]);

//   const remoteUsers = useRemoteUsers();

//   const primaryRemoteUser = remoteUsers[0];

//   // Dynamic Patient Name detection
//   const dynamicPatientName =
//     patientName ||
//     videoCallSession?.patient_name ||
//     searchParams.get("patient_name") ||
//     searchParams.get("patient") ||
//     searchParams.get("name") ||
//     (primaryRemoteUser ? `Patient (${primaryRemoteUser.uid})` : "John Carter");
//   const [joinedCallData, setJoinedCallData] = useState<any>(null);

//   // Global Profile Image & Display Name States
//   const [therapistImgUrl, setTherapistImgUrl] = useState<string>("");
//   const [therapistDisplayName, setTherapistDisplayName] = useState<string>("");
//   const [patientImgUrl, setPatientImgUrl] = useState<string>("");
//   const [patientDisplayName, setPatientDisplayName] = useState<string>("");

//   // Firebase Real-time Chat States
//   const [chatMessages, setChatMessages] = useState<FirebaseChatMessage[]>([]);
//   const [chatInputText, setChatInputText] = useState<string>("");
//   const chatTimelineRef = useRef<HTMLDivElement>(null);

//   // Extract raw session ID
//   const rawSessionId =
//     therapySessionId ||
//     videoCallSession?.therapy_session_id ||
//     searchParams.get("therapy_session_id") ||
//     searchParams.get("session_id") ||
//     searchParams.get("id");

//   // Audio recording & Speech recognition for ongoing video call transcript
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const audioChunksRef = useRef<Blob[]>([]);
//   const audioStreamRef = useRef<MediaStream | null>(null);
//   const recognitionRef = useRef<any>(null);
//   const transcriptTextRef = useRef<string>("");
//   const finalTranscriptRef = useRef<string>("");
//   const [transcriptText, setTranscriptText] = useState<string>("");
//   const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

//   const startAudioAndTranscriptCapture = useCallback(async () => {
//     try {
//       if (
//         typeof window === "undefined" ||
//         !navigator.mediaDevices?.getUserMedia
//       )
//         return;

//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       audioStreamRef.current = stream;

//       const mediaRecorder = new MediaRecorder(stream);
//       mediaRecorderRef.current = mediaRecorder;
//       audioChunksRef.current = [];

//       const SpeechRecognition =
//         (window as any).SpeechRecognition ||
//         (window as any).webkitSpeechRecognition;

//       if (SpeechRecognition) {
//         try {
//           const recognition = new SpeechRecognition();
//           recognition.continuous = true;
//           recognition.interimResults = true;
//           recognition.lang =
//             typeof navigator !== "undefined" && navigator.language
//               ? navigator.language
//               : "en-US";

//           recognition.onresult = (event: any) => {
//             let interim = "";
//             for (let i = event.resultIndex; i < event.results.length; ++i) {
//               const piece = event.results[i][0].transcript;
//               if (event.results[i].isFinal) {
//                 finalTranscriptRef.current +=
//                   (finalTranscriptRef.current ? " " : "") + piece.trim();
//               } else {
//                 interim += (interim ? " " : "") + piece.trim();
//               }
//             }
//             const fullTranscript = [finalTranscriptRef.current, interim]
//               .filter(Boolean)
//               .join(" ")
//               .trim();

//             setTranscriptText(fullTranscript);
//             transcriptTextRef.current = fullTranscript;
//           };

//           recognition.onend = () => {
//             if (
//               mediaRecorderRef.current &&
//               mediaRecorderRef.current.state === "recording"
//             ) {
//               try {
//                 recognition.start();
//               } catch (e) {}
//             }
//           };

//           recognition.start();
//           recognitionRef.current = recognition;
//         } catch (e) {
//           console.error("Speech recognition error:", e);
//         }
//       }

//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data && event.data.size > 0) {
//           audioChunksRef.current.push(event.data);
//         }
//       };

//       mediaRecorder.onstop = () => {
//         if (recognitionRef.current) {
//           try {
//             recognitionRef.current.stop();
//           } catch (e) {}
//         }
//         if (audioChunksRef.current.length > 0) {
//           const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
//           setAudioBlob(blob);
//         }
//       };

//       mediaRecorder.start(1000);
//     } catch (err) {
//       console.warn(
//         "Could not start background audio recording/transcript:",
//         err
//       );
//     }
//   }, []);

//   useEffect(() => {
//     startAudioAndTranscriptCapture();

//     return () => {
//       if (recognitionRef.current) {
//         try {
//           recognitionRef.current.stop();
//         } catch (e) {}
//       }
//       if (
//         mediaRecorderRef.current &&
//         mediaRecorderRef.current.state !== "inactive"
//       ) {
//         try {
//           mediaRecorderRef.current.stop();
//         } catch (e) {}
//       }
//       if (audioStreamRef.current) {
//         audioStreamRef.current.getTracks().forEach((track) => track.stop());
//       }
//     };
//   }, [startAudioAndTranscriptCapture]);

//   //call end

//   const getRecordingData = useCallback(async (): Promise<{
//     blob: Blob;
//     transcript: string;
//   }> => {
//     return new Promise((resolve) => {
//       const currentTranscript =
//         transcriptTextRef.current ||
//         finalTranscriptRef.current ||
//         transcriptText ||
//         "Session audio recording transcript.";

//       if (
//         mediaRecorderRef.current &&
//         mediaRecorderRef.current.state === "recording"
//       ) {
//         mediaRecorderRef.current.onstop = () => {
//           const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
//           setAudioBlob(blob);
//           resolve({ blob, transcript: currentTranscript });
//         };
//         try {
//           mediaRecorderRef.current.stop();
//         } catch (e) {
//           const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
//           resolve({ blob, transcript: currentTranscript });
//         }
//       } else {
//         const blob =
//           audioBlob || new Blob(audioChunksRef.current, { type: "audio/webm" });
//         resolve({ blob, transcript: currentTranscript });
//       }
//     });
//   }, [audioBlob, transcriptText]);

//   // Private Notes State & Rich Text Editor Handlers
//   const [privateNotesText, setPrivateNotesText] = useState<string>("");
//   const [isSubmittingPrivateNotes, setIsSubmittingPrivateNotes] =
//     useState<boolean>(false);
//   const [isNotesExpanded, setIsNotesExpanded] = useState<boolean>(false);
//   const privateNotesEditorRef = useRef<HTMLDivElement>(null);

//   const execNotesCommand = (command: string, value?: string) => {
//     document.execCommand(command, false, value);
//     if (privateNotesEditorRef.current) {
//       privateNotesEditorRef.current.focus();
//       setPrivateNotesText(privateNotesEditorRef.current.innerHTML);
//     }
//   };

//   const clearPrivateNotes = () => {
//     setPrivateNotesText("");
//     if (privateNotesEditorRef.current) {
//       privateNotesEditorRef.current.innerHTML = "";
//     }
//   };

//   const handleSavePrivateNotes = async () => {
//     if (!rawSessionId) {
//       toast.error("Session ID is required to save notes.");
//       return;
//     }

//     setIsSubmittingPrivateNotes(true);
//     try {
//       const payload = {
//         session_id: String(rawSessionId),
//         type: "private",
//         notes: privateNotesText,
//       };

//       const response = await requestApi({
//         endpoint: "/api/submit-notes",
//         method: "POST",
//         data: payload,
//         isFormData: false,
//       });

//       if (response && (response.success || response.status)) {
//         toast.success("Private notes submitted successfully!");
//       } else {
//         toast.error(response?.message || "Failed to submit private notes.");
//       }
//     } catch (err: any) {
//       console.error("Error submitting private notes:", err);
//       toast.error(
//         err?.response?.data?.message ||
//           err?.message ||
//           "Error submitting private notes"
//       );
//     } finally {
//       setIsSubmittingPrivateNotes(false);
//     }
//   };

//   const fetchSessionDetails = useCallback(async () => {
//     if (!rawSessionId) return;
//     try {
//       const response = await requestApi({
//         endpoint: `get-session-details/${rawSessionId}`,
//         method: "POST",
//         data: {
//           therapy_session_id: String(rawSessionId),
//         },
//       });

//       if (response && (response.success || response.status || response.data)) {
//         const data = response.data || response;
//         const notes =
//           data.therapist_private_notes ||
//           data.private_notes ||
//           data.therapist_notes ||
//           data.notes ||
//           "";
//         if (notes) {
//           setPrivateNotesText(notes);
//           if (privateNotesEditorRef.current) {
//             privateNotesEditorRef.current.innerHTML = notes;
//           }
//         }
//       }
//     } catch (err) {
//       console.error("Error fetching session details in VideoConfrence:", err);
//     }
//   }, [rawSessionId]);

//   useEffect(() => {
//     fetchSessionDetails();
//   }, [fetchSessionDetails]);

//   useEffect(() => {
//     if (
//       privateNotesEditorRef.current &&
//       privateNotesText &&
//       !privateNotesEditorRef.current.innerHTML
//     ) {
//       privateNotesEditorRef.current.innerHTML = privateNotesText;
//     }
//   }, [privateNotesText]);

//   // Documents & Attachments States
//   const [docTab, setDocTab] = useState<"therapist" | "patient">("therapist");
//   const [therapistDocuments, setTherapistDocuments] = useState<any[]>([]);
//   const [patientDocuments, setPatientDocuments] = useState<any[]>([]);
//   const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
//   const [isFetchingDocs, setIsFetchingDocs] = useState<boolean>(false);
//   const docFileInputRef = useRef<HTMLInputElement>(null);

//   const fetchSessionDocuments = useCallback(async () => {
//     const sessionId =
//       therapySessionId ||
//       videoCallSession?.therapy_session_id ||
//       searchParams.get("therapy_session_id") ||
//       searchParams.get("session_id") ||
//       searchParams.get("id");

//     if (!sessionId) return;

//     setIsFetchingDocs(true);
//     try {
//       const response = await requestApi({
//         endpoint: `get-session-documents/${sessionId}`,
//         method: "POST",
//       });

//       console.log("Fetched get-session-documents response:", response);

//       const docData =
//         response?.data?.documents ||
//         response?.data ||
//         response?.documents ||
//         response;
//       if (docData) {
//         const therapistDocs = getDocList(
//           docData.therapist_document ||
//             docData.shared_by_therapist ||
//             docData.therapist_documents
//         );
//         const patientDocs = getDocList(
//           docData.patient_document ||
//             docData.shared_by_patient ||
//             docData.patient_documents
//         );
//         setTherapistDocuments(therapistDocs);
//         setPatientDocuments(patientDocs);
//       }
//     } catch (err) {
//       console.error("Error fetching session documents in VideoConfrence:", err);
//     } finally {
//       setIsFetchingDocs(false);
//     }
//   }, [therapySessionId, videoCallSession, searchParams]);

//   useEffect(() => {
//     fetchSessionDocuments();
//   }, [fetchSessionDocuments]);
//   //
//   const handleDocumentUpload = async (
//     e: React.ChangeEvent<HTMLInputElement>
//   ) => {
//     const file = e.target.files?.[0];
//     if (!file || !rawSessionId) return;

//     setIsUploadingDoc(true);
//     try {
//       const parsedSessionId = parseInt(String(rawSessionId), 10);
//       const formData = new FormData();
//       formData.append("session_id", parsedSessionId.toString());
//       formData.append("type", "therapist");

//       // Check key name: Postman screenshot shows 'documen...' (likely 'documents' or 'document')
//       formData.append("document", file);

//       // 1. Retrieve the bearer token from localStorage
//       let token: string | undefined;
//       try {
//         const savedDetails = localStorage.getItem("loginUser");
//         const parsed = savedDetails ? JSON.parse(savedDetails) : null;
//         token = parsed?.token;
//       } catch (err) {
//         console.error("Error reading token:", err);
//       }

//       // 2. Call your local Next.js proxy route directly
//       const res = await axios.post("/api/upload-session-documents", formData, {
//         headers: {
//           Accept: "*/*",
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//         },
//       });

//       const response = res.data;

//       // 3. Handle success response
//       if (
//         response &&
//         (response.success || response.code === 200 || response.status)
//       ) {
//         toast.success("Document uploaded successfully!");
//         const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);

//         // In Postman response, data is an array of strings: data: ["uploads/..."]
//         const uploadedFilePath = Array.isArray(response?.data)
//           ? response.data[0]
//           : response?.data?.file_url ||
//             response?.data?.url ||
//             response?.data?.document;

//         const uploadedDocObj = {
//           id: Date.now(),
//           file_name: file.name,
//           file_type: extMatch ? extMatch[1].toUpperCase() : "DOC",
//           file_url: uploadedFilePath || URL.createObjectURL(file),
//         };

//         setTherapistDocuments((prev) => [...prev, uploadedDocObj]);
//         fetchSessionDocuments();
//       } else {
//         toast.error(response?.message || "Failed to upload document.");
//       }
//     } catch (err: any) {
//       console.error("Error uploading document in VideoConference:", err);
//       toast.error(
//         err?.response?.data?.message ||
//           err?.message ||
//           "Error uploading document"
//       );
//     } finally {
//       setIsUploadingDoc(false);
//       if (e.target) e.target.value = "";
//     }
//   };

//   const chatChannelName = `session_${rawSessionId}`;

//   // Helper to extract timestamp in ms from any Firestore or JS message format
//   const getMsgTime = (msg: FirebaseChatMessage): number => {
//     const extractMs = (val: any): number => {
//       if (val === null || val === undefined) return 0;

//       if (typeof val?.toMillis === "function") {
//         try {
//           const res = val.toMillis();
//           if (typeof res === "number" && !isNaN(res) && res > 0) return res;
//         } catch (e) {}
//       }
//       if (typeof val?.toDate === "function") {
//         try {
//           const d = val.toDate();
//           if (d && !isNaN(d.getTime())) return d.getTime();
//         } catch (e) {}
//       }

//       if (
//         typeof val?.seconds === "number" &&
//         !isNaN(val.seconds) &&
//         val.seconds > 0
//       ) {
//         return val.seconds * 1000;
//       }

//       if (typeof val === "number" && !isNaN(val) && val > 0) {
//         if (val < 1e11) return val * 1000;
//         return val;
//       }

//       if (typeof val === "string" && val.trim() !== "") {
//         const parsed = new Date(val).getTime();
//         if (
//           !isNaN(parsed) &&
//           parsed > 0 &&
//           new Date(parsed).getFullYear() > 1970
//         ) {
//           return parsed;
//         }
//       }

//       return 0;
//     };

//     const candidateFields = [
//       msg.timestamp,
//       msg.created_at,
//       (msg as any).createdAt,
//       (msg as any).time,
//       (msg as any).date,
//       (msg as any).sentAt,
//     ];

//     for (const field of candidateFields) {
//       const ms = extractMs(field);
//       if (ms > 0) return ms;
//     }

//     return 0;
//   };

//   // Firestore Chat Real-Time Subscription (Path: chats -> session_{id} -> messages)
//   useEffect(() => {
//     if (!db || !chatChannelName) return;

//     const messagesCollection = collection(
//       db,
//       "chats",
//       chatChannelName,
//       "messages"
//     );

//     const unsubscribe = onSnapshot(
//       messagesCollection,
//       (snapshot) => {
//         const msgs: FirebaseChatMessage[] = [];
//         snapshot.forEach((docSnap) => {
//           const data = docSnap.data();
//           msgs.push({ id: docSnap.id, ...data });

//           // If incoming message from patient is unread (seen: false), mark as seen
//           const isPatientSender =
//             data.senderId?.startsWith("patient") ||
//             data.sender_type === "patient" ||
//             data.sender_type === "client";

//           if (isPatientSender && data.seen === false && docSnap.id) {
//             try {
//               updateDoc(
//                 doc(db, "chats", chatChannelName, "messages", docSnap.id),
//                 {
//                   seen: true,
//                 }
//               );
//             } catch (err) {
//               console.error("Error updating seen status:", err);
//             }
//           }
//         });

//         // Client-side sort by timestamp / created_at
//         msgs.sort((a, b) => getMsgTime(a) - getMsgTime(b));

//         setChatMessages(msgs);
//       },
//       (err) => {
//         console.error("Firebase chat snapshot listener error:", err);
//       }
//     );

//     return () => unsubscribe();
//   }, [chatChannelName]);

//   // Auto-scroll chat timeline to bottom without scrolling outer window
//   useEffect(() => {
//     if (chatTimelineRef.current) {
//       chatTimelineRef.current.scrollTop = chatTimelineRef.current.scrollHeight;
//     }
//   }, [chatMessages]);

//   //call end initilze
//   // const [callStatus, setCallStatus] = useState<"ongoing" | "ended">("ongoing");
//   // useEffect(() => {
//   //   if (!rawSessionId) return;

//   //   // 1. Exact collection & document reference from your Firestore screenshot
//   //   const callsCollectionRef = collection(db, "video_session_calls");
//   //   const callDocRef = doc(callsCollectionRef, String(rawSessionId));

//   //   // 2. First Time Initialize: Sirf tab "ongoing" set karo jab document pehle se na ho
//   //   // (Agar pehle se "ended" hai toh page reload par overwrite hokar "ongoing" nahi hoga)
//   //   const initCallStatus = async () => {
//   //     try {
//   //       const existingSnap = await getDoc(callDocRef);
//   //       if (!existingSnap.exists()) {
//   //         const therapistId =
//   //           parsedUser?.user?.id || videoCallSession?.therapist_uid || "";

//   //         await setDoc(callDocRef, {
//   //           status: "ongoing",
//   //           ...(therapistId ? { therapist_id: String(therapistId) } : {}),
//   //           createdAt: serverTimestamp(),
//   //         });
//   //       }
//   //     } catch (error) {
//   //       console.error("Error initializing video_session_calls status:", error);
//   //     }
//   //   };

//   //   initCallStatus();

//   //   // 3. Real-time Listener (Page reload par bhi Firestore ka "ended" status read karega)
//   //   const unsubscribe = onSnapshot(callDocRef, (snapshot) => {
//   //     if (snapshot.exists()) {
//   //       const currentStatus = snapshot.data()?.status;

//   //       if (currentStatus === "ended") {
//   //         setCallStatus("ended");
//   //         if (onEndCall) {
//   //           onEndCall(); // Reload par bhi agar "ended" hai toh ended screen/redirect trigger karega
//   //         }
//   //       } else {
//   //         setCallStatus("ongoing");
//   //       }
//   //     }
//   //   });

//   //   return () => unsubscribe();
//   // }, [rawSessionId]);

//   // Send Message Handler
//   const handleSendChatMessage = async (e?: React.FormEvent) => {
//     if (e) e.preventDefault();
//     const textToSend = chatInputText.trim();
//     if (!textToSend || !db || !chatChannelName) return;

//     try {
//       const messagesCollection = collection(
//         db,
//         "chats",
//         chatChannelName,
//         "messages"
//       );
//       setChatInputText("");
//       const therapistId = parsedUser?.user?.id || videoCallSession?.uid || "";
//       const currentSenderId = therapistId
//         ? `therapist_${therapistId}`
//         : "therapist";
//       const currentReceiverId = "patient";

//       await addDoc(messagesCollection, {
//         message: textToSend,
//         text: textToSend,
//         senderId: currentSenderId,
//         receiverId: currentReceiverId,
//         seen: false,
//         timestamp: Date.now(),
//         sender: doctorFullName || "Doctor",
//         sender_name: doctorFullName || "Doctor",
//         sender_type: "therapist",
//         sender_id: therapistId || "therapist",
//         created_at: new Date().toISOString(),
//       });
//     } catch (err) {
//       console.error("Error sending message to Firebase Firestore:", err);
//     }
//   };

//   const formatChatTime = (msg: FirebaseChatMessage): string => {
//     const ms = getMsgTime(msg);
//     if (ms > 0) {
//       const d = new Date(ms);
//       if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
//         return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//       }
//     }

//     const candidateFields = [
//       msg.timestamp,
//       msg.created_at,
//       (msg as any).createdAt,
//       (msg as any).time,
//       (msg as any).date,
//     ];

//     for (const field of candidateFields) {
//       if (
//         typeof field === "string" &&
//         /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(field.trim())
//       ) {
//         return field.trim();
//       }
//     }

//     return "";
//   };

//   // Call therapist-call-joined API endpoint when joining the room
//   useEffect(() => {
//     const notifyCallJoined = async () => {
//       try {
//         const sessionId =
//           therapySessionId || videoCallSession.therapy_session_id || "";

//         if (!sessionId) return;

//         const payload = {
//           therapy_session_id: sessionId,
//         };

//         const res = await requestApi({
//           endpoint: "therapist-call-joined",
//           method: "POST",
//           data: payload,
//           isFormData: false,
//         });
//         console.log("therapist-call-joined API call", res);
//         if (res && (res.success || res.code === 200) && res.data) {
//           setJoinedCallData(res.data);
//           if (typeof window !== "undefined") {
//             window.localStorage.setItem(
//               `call_joined_${sessionId}`,
//               JSON.stringify(res.data)
//             );
//             window.dispatchEvent(
//               new CustomEvent("callJoinedUpdated", { detail: res.data })
//             );
//           }
//         }
//       } catch (err) {
//         console.error("therapist-call-joined API call error:", err);
//       }
//     };

//     notifyCallJoined();
//   }, [therapySessionId, videoCallSession]);

//   // Compute and update global profile image URLs & display names from joined call data
//   useEffect(() => {
//     const getFullImgUrl = (
//       imgRelPath?: string,
//       fallback: string = "/images/header-user-right-profile.svg"
//     ) => {
//       if (!imgRelPath) return fallback;
//       const trimmed = imgRelPath.trim();
//       if (!trimmed) return fallback;
//       if (
//         trimmed.startsWith("http://") ||
//         trimmed.startsWith("https://") ||
//         trimmed.startsWith("data:")
//       ) {
//         return trimmed;
//       }
//       return `${Base_image_url.replace(/\/+$/, "")}/${trimmed.replace(
//         /^\/+/,
//         ""
//       )}`;
//     };

//     const therapistData = joinedCallData?.therapist;
//     const patientData = joinedCallData?.patient;

//     const tName = therapistData?.name
//       ? `Dr. ${therapistData.name} ${therapistData.surname_one || ""}`.trim() +
//         " (Host)"
//       : `${doctorFullName} (Host)`;

//     const tImg = therapistData?.profile_image
//       ? getFullImgUrl(therapistData.profile_image, doctorProfileImgUrl)
//       : doctorProfileImgUrl;

//     const pName = patientData?.name
//       ? `${patientData.name} ${patientData.surname_one || ""}`.trim()
//       : dynamicPatientName || "Patient";

//     const pImg = patientData?.profile_image
//       ? getFullImgUrl(
//           patientData.profile_image,
//           "/images/header-user-right-profile.svg"
//         )
//       : "/images/header-user-right-profile.svg";

//     setTherapistDisplayName(tName);
//     setTherapistImgUrl(tImg);
//     setPatientDisplayName(pName);
//     setPatientImgUrl(pImg);
//   }, [joinedCallData, doctorFullName, doctorProfileImgUrl, dynamicPatientName]);

//   // Join Agora Channel
//   useJoin({
//     appid: appIdToUse,
//     channel: channel_name,
//     token: token || null,
//     uid: videoCallSession.uid ? Number(videoCallSession.uid) : null,
//   });

//   // Publish Audio & Video Tracks independently so audio NEVER depends on camera
//   usePublish([localMicrophoneTrack], Boolean(localMicrophoneTrack));
//   usePublish(
//     [localCameraTrack],
//     Boolean(localCameraTrack && hasCameraDevice && cameraActive)
//   );

//   const router = useRouter();

//   // const handleEndCall = async () => {
//   //   if (typeof window !== "undefined") {
//   //     try {
//   //       sessionStorage.removeItem("start_session_data");
//   //     } catch (e) {
//   //       console.error("Error clearing start_session_data on end call:", e);
//   //     }
//   //   }

//   //   const sessionId =
//   //     rawSessionId ||
//   //     therapySessionId ||
//   //     videoCallSession.therapy_session_id ||
//   //     searchParams.get("therapy_session_id") ||
//   //     searchParams.get("session_id") ||
//   //     searchParams.get("id") ||
//   //     "";

//   //   if (sessionId) {
//   //     try {
//   //       // 1. Firestore me status ko "ended" update karein
//   //       const callDocRef = doc(db, "video_session_calls", String(sessionId));
//   //       await setDoc(
//   //         callDocRef,
//   //         {
//   //           status: "ended",
//   //           updatedAt: serverTimestamp(),
//   //         },
//   //         { merge: true }
//   //       );
//   //       setCallStatus("ended");

//   //       // 2. Backend APIs call karein
//   //       const payload = {
//   //         therapy_session_id: String(sessionId),
//   //       };

//   //       await Promise.allSettled([
//   //         requestApi({
//   //           endpoint: "therapist-end-call",
//   //           method: "POST",
//   //           data: payload,
//   //           isFormData: false,
//   //         }),
//   //         requestApi({
//   //           endpoint: "therapist-refresh-token",
//   //           method: "POST",
//   //           data: payload,
//   //           isFormData: false,
//   //         }),
//   //       ]);
//   //     } catch (err) {
//   //       console.error("Error ending call:", err);
//   //     }
//   //   }

//   //   if (onEndCall) {
//   //     onEndCall();
//   //   }
//   // };

//   const handleEndCall = async () => {
//     if (typeof window !== "undefined") {
//       try {
//         sessionStorage.removeItem("start_session_data");
//       } catch (e) {
//         console.error("Error clearing start_session_data on end call:", e);
//       }
//     }
//     const sessionId =
//       therapySessionId ||
//       videoCallSession.therapy_session_id ||
//       searchParams.get("therapy_session_id") ||
//       searchParams.get("session_id") ||
//       searchParams.get("id") ||
//       "";

//     if (sessionId) {
//       try {
//         const payload = {
//           therapy_session_id: String(sessionId),
//         };

//         await Promise.allSettled([
//           requestApi({
//             endpoint: "therapist-end-call",
//             method: "POST",
//             data: payload,
//             isFormData: false,
//           }),
//           requestApi({
//             endpoint: "therapist-refresh-token",
//             method: "POST",
//             data: payload,
//             isFormData: false,
//           }),
//         ]);
//       } catch (err) {
//         console.error("Error calling end-call / refresh-token endpoints:", err);
//       }
//     }

//     if (onEndCall) {
//       onEndCall();
//     }
//   };

//   // Toggle Controls
//   const toggleMic = async () => {
//     const nextState = !micActive;
//     if (localMicrophoneTrack) {
//       try {
//         await localMicrophoneTrack.setEnabled(nextState);
//       } catch (err) {
//         console.error("Error toggling mic track:", err);
//       }
//     }
//     setMicActive(nextState);
//   };

//   const toggleCamera = async () => {
//     if (!hasCameraDevice) {
//       toast.error("No camera device detected on your system.");
//       return;
//     }
//     const nextState = !cameraActive;
//     if (localCameraTrack) {
//       try {
//         await localCameraTrack.setEnabled(nextState);
//       } catch (err) {
//         console.error("Error toggling camera track:", err);
//       }
//     }
//     setCameraActive(nextState);
//   };

//   return (
//     <main className="gl-content-body ps-session-conference-main">
//       <style>{`
//         .ps-session-conference-main {
//           min-height: calc(100vh - 79px);
//           overflow-y: auto !important;
//           padding: 20px 30px;
//         }
//         .ps-session-page-grid {
//           display: grid;
//           grid-template-columns: 1.4fr 1fr;
//           gap: 20px;
//           max-width: 1400px;
//           margin: 0 auto;
//           height: calc(100vh - 120px) !important;
//           min-height: 520px;
//           overflow: visible !important;
//         }
//         .ps-session-video-panel {
//           display: flex !important;
//           flex-direction: column !important;
//           background-color: #000000;
//           border-radius: 28px;
//           overflow: hidden !important;
//           height: 100% !important;
//           min-height: 480px;
//           position: relative;
//         }
//         .ps-session-video-viewport {
//           flex: 1 1 0 !important;
//           min-height: 0 !important;
//           background-color: #e5c5b5;
//           position: relative;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           overflow: hidden;
//         }
//         .ps-session-video-controls-dock {
//           flex-shrink: 0 !important;
//           background-color: #000000;
//           padding: 14px 24px !important;
//           display: flex;
//           justify-content: center;
//           align-items: center;
//           gap: 28px;
//           position: relative;
//           z-index: 15;
//         }
//         .ps-session-right-sidebar {
//           display: flex;
//           flex-direction: column;
//           gap: 20px;
//           height: 100% !important;
//           max-height: calc(100vh - 120px) !important;
//           overflow-y: auto !important;
//           padding-right: 8px;
//         }
//         @media (max-width: 1024px) {
//           .ps-session-page-grid {
//             grid-template-columns: 1fr !important;
//             height: auto !important;
//             min-height: auto !important;
//             overflow: visible !important;
//           }
//           .ps-session-video-panel {
//             height: 60vh !important;
//             min-height: 400px !important;
//             max-height: 580px !important;
//             margin-bottom: 20px;
//           }
//           .ps-session-right-sidebar {
//             height: auto !important;
//             max-height: none !important;
//             overflow-y: visible !important;
//           }
//         }
//       `}</style>
//       <div className="ps-session-page-grid">
//         <div className="ps-session-video-panel">
//           {/* Main Video Viewport */}
//           <div className="ps-session-video-viewport">
//             {primaryRemoteUser ? (
//               <RemoteUser
//                 user={primaryRemoteUser}
//                 playAudio={true}
//                 playVideo={true}
//                 style={{ width: "100%", height: "100%", objectFit: "cover" }}
//               />
//             ) : (
//               <div
//                 style={{
//                   display: "flex",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   height: "100%",
//                   width: "100%",
//                   color: "#fff",
//                 }}
//               >
//                 <p
//                   style={{
//                     fontSize: "16px",
//                     color: "#ffffff",
//                     fontWeight: 500,
//                   }}
//                 >
//                   Waiting for{" "}
//                   {patientDisplayName || dynamicPatientName || "participant"} to
//                   join...
//                 </p>
//               </div>
//             )}

//             {/* Remote User Top Left Olive Badge */}
//             <div
//               className="ps-session-overlay-badge-top"
//               style={{
//                 position: "absolute",
//                 top: "16px",
//                 left: "16px",
//                 backgroundColor: "rgba(105, 114, 76, 0.88)",
//                 backdropFilter: "blur(4px)",
//                 padding: "6px 14px",
//                 borderRadius: "20px",
//                 color: "#ffffff",
//                 fontSize: "12px",
//                 fontWeight: 500,
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "8px",
//                 zIndex: 10,
//               }}
//             >
//               <svg
//                 width="13"
//                 height="13"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="#ffffff"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 style={{ display: "block" }}
//               >
//                 <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
//                 <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
//                 <line x1="12" y1="19" x2="12" y2="22" />
//               </svg>
//               <span>{patientDisplayName || dynamicPatientName}</span>
//               <span
//                 style={{
//                   display: "inline-flex",
//                   alignItems: "flex-end",
//                   gap: "2px",
//                   height: "12px",
//                   marginLeft: "2px",
//                 }}
//               >
//                 <span
//                   style={{
//                     width: "2px",
//                     height: "4px",
//                     backgroundColor: "#52c41a",
//                     borderRadius: "1px",
//                   }}
//                 />
//                 <span
//                   style={{
//                     width: "2px",
//                     height: "7px",
//                     backgroundColor: "#52c41a",
//                     borderRadius: "1px",
//                   }}
//                 />
//                 <span
//                   style={{
//                     width: "2px",
//                     height: "10px",
//                     backgroundColor: "#52c41a",
//                     borderRadius: "1px",
//                   }}
//                 />
//                 <span
//                   style={{
//                     width: "2px",
//                     height: "12px",
//                     backgroundColor: "#52c41a",
//                     borderRadius: "1px",
//                   }}
//                 />
//               </span>
//             </div>

//             {/* Left Side Vertical Volume Slider Capsule */}
//             <div
//               className="ps-session-volume-slider-container"
//               style={{
//                 position: "absolute",
//                 left: "20px",
//                 top: "110px",
//                 backgroundColor: "rgba(110, 78, 91, 0.88)",
//                 borderRadius: "24px",
//                 padding: "16px 8px",
//                 display: "flex",
//                 flexDirection: "column",
//                 alignItems: "center",
//                 gap: "12px",
//                 width: "36px",
//                 backdropFilter: "blur(4px)",
//                 zIndex: 10,
//               }}
//             >
//               <div
//                 className="ps-session-volume-track"
//                 style={{
//                   width: "4px",
//                   height: "120px",
//                   backgroundColor: "rgba(255, 255, 255, 0.3)",
//                   borderRadius: "2px",
//                   position: "relative",
//                 }}
//               >
//                 <div
//                   className="ps-session-volume-fill"
//                   style={{
//                     width: "100%",
//                     height: "65%",
//                     backgroundColor: "#ffffff",
//                     borderRadius: "2px",
//                     position: "absolute",
//                     bottom: 0,
//                   }}
//                 />
//                 <div
//                   className="ps-session-volume-handle"
//                   style={{
//                     width: "10px",
//                     height: "10px",
//                     backgroundColor: "#ffffff",
//                     borderRadius: "50%",
//                     position: "absolute",
//                     bottom: "65%",
//                     left: "-3px",
//                   }}
//                 />
//               </div>
//               <svg
//                 className="ps-session-volume-icon"
//                 fill="none"
//                 stroke="#ffffff"
//                 strokeWidth="2"
//                 viewBox="0 0 24 24"
//                 style={{ width: "16px", height: "16px" }}
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z"
//                 />
//               </svg>
//             </div>

//             {/* Local Stream PIP Box */}
//             <div
//               className="ps-session-pip-doctor-box"
//               style={{
//                 position: "absolute",
//                 bottom: "16px",
//                 right: "16px",
//                 width: "230px",
//                 height: "135px",
//                 borderRadius: "16px",
//                 overflow: "hidden",
//                 border: "2.5px solid #ffffff",
//                 boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
//                 zIndex: 10,
//               }}
//             >
//               <LocalUser
//                 audioTrack={localMicrophoneTrack}
//                 videoTrack={
//                   hasCameraDevice && cameraActive ? localCameraTrack : undefined
//                 }
//                 cameraOn={
//                   hasCameraDevice && cameraActive && Boolean(localCameraTrack)
//                 }
//                 micOn={micActive}
//                 playAudio={false}
//                 cover={doctorProfileImgUrl || "/images/dash-user-icon.svg"}
//                 style={{
//                   width: "100%",
//                   height: "100%",
//                   objectFit: "cover",
//                   display: "block",
//                 }}
//               />

//               {/* Name Pill Badge inside PIP (Bottom Left) */}
//               <div
//                 className="ps-session-pip-label"
//                 style={{
//                   position: "absolute",
//                   bottom: "10px",
//                   left: "10px",
//                   display: "flex",
//                   alignItems: "center",
//                   gap: "8px",
//                   backgroundColor: "rgba(105, 114, 76, 0.88)",
//                   backdropFilter: "blur(4px)",
//                   padding: "6px 12px",
//                   borderRadius: "20px",
//                   color: "#ffffff",
//                   zIndex: 12,
//                   boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
//                 }}
//               >
//                 {/* Microphone Icon */}
//                 <svg
//                   width="13"
//                   height="13"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="#ffffff"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   style={{ display: "block" }}
//                 >
//                   <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
//                   <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
//                   <line x1="12" y1="19" x2="12" y2="22" />
//                 </svg>

//                 {/* Name Label */}
//                 <span
//                   style={{
//                     color: "#ffffff",
//                     fontSize: "12px",
//                     fontWeight: 500,
//                     lineHeight: 1,
//                     whiteSpace: "nowrap",
//                   }}
//                 >
//                   You ({doctorFullName})
//                 </span>

//                 {/* Voice Level / Signal Indicator Bars */}
//                 <span
//                   style={{
//                     display: "inline-flex",
//                     alignItems: "flex-end",
//                     gap: "2px",
//                     height: "12px",
//                     marginLeft: "2px",
//                   }}
//                 >
//                   <span
//                     style={{
//                       width: "2px",
//                       height: "4px",
//                       backgroundColor: "#52c41a",
//                       borderRadius: "1px",
//                     }}
//                   />
//                   <span
//                     style={{
//                       width: "2px",
//                       height: "7px",
//                       backgroundColor: "#52c41a",
//                       borderRadius: "1px",
//                     }}
//                   />
//                   <span
//                     style={{
//                       width: "2px",
//                       height: "10px",
//                       backgroundColor: "#52c41a",
//                       borderRadius: "1px",
//                     }}
//                   />
//                   <span
//                     style={{
//                       width: "2px",
//                       height: "12px",
//                       backgroundColor: "#52c41a",
//                       borderRadius: "1px",
//                     }}
//                   />
//                 </span>
//               </div>
//             </div>
//           </div>

//           {/* Action Control Dock (Separate Black Bar at Bottom) */}
//           <div className="ps-session-video-controls-dock">
//             <button className="ps-session-dock-btn" onClick={toggleMic}>
//               <div
//                 className="ps-session-dock-icon-circle"
//                 style={{
//                   backgroundColor: !micActive ? "#ff4d4f" : undefined,
//                   color: !micActive ? "#fff" : undefined,
//                 }}
//               >
//                 <svg
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                 >
//                   {micActive ? (
//                     <>
//                       <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
//                       <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" />
//                     </>
//                   ) : (
//                     <>
//                       <line x1="1" y1="1" x2="23" y2="23"></line>
//                       <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
//                     </>
//                   )}
//                 </svg>
//               </div>
//               {micActive ? "Mute" : "Unmute"}
//             </button>

//             <button className="ps-session-dock-btn" onClick={toggleCamera}>
//               <div
//                 className="ps-session-dock-icon-circle"
//                 style={{
//                   backgroundColor: !cameraActive ? "#ff4d4f" : undefined,
//                   color: !cameraActive ? "#fff" : undefined,
//                 }}
//               >
//                 <svg
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                 >
//                   <path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z" />
//                 </svg>
//               </div>
//               {cameraActive ? "Camera Off" : "Camera On"}
//             </button>

//             {/* <button className="ps-session-dock-btn">
//               <div className="ps-session-dock-icon-circle">
//                 <svg
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                 >
//                   <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
//                 </svg>
//               </div>
//               Chat
//             </button> */}

//             <button
//               className="ps-session-dock-btn ps-session-dock-btn-end"
//               data-bs-toggle="modal"
//               data-bs-target="#endSessionModal"
//               onClick={() => {
//                 if (
//                   mediaRecorderRef.current &&
//                   mediaRecorderRef.current.state === "recording"
//                 ) {
//                   try {
//                     mediaRecorderRef.current.stop();
//                   } catch (e) {}
//                 }
//               }}
//             >
//               <div className="ps-session-dock-icon-circle">
//                 <img src="/images/endCallicon.png" alt="endCallicon" />
//               </div>
//               End Call
//             </button>
//           </div>
//         </div>

//         {/* Sidebar Cards */}
//         <div className="ps-session-right-sidebar">
//           {/* Notes Card */}
//           <div className="ps-session-module-card">
//             <div className="ps-session-card-head">
//               <h3 className="ps-session-card-title">
//                 <svg
//                   className="ps-session-head-icon-plum"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                 >
//                   <path d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3Z" />
//                   <path d="M12 14c-4.418 0-8 2.239-8 5v2h16v-2c0-2.761-3.582-5-8-5Z" />
//                 </svg>
//                 Private Notes{" "}
//                 <span className="ps-session-title-aside">(Only you)</span>
//               </h3>
//               <button
//                 type="button"
//                 className="ps-session-btn-clear"
//                 onClick={clearPrivateNotes}
//               >
//                 Clear
//               </button>
//             </div>

//             {/* Rich Text ContentEditable Editor */}
//             <div
//               ref={privateNotesEditorRef}
//               className="ps-session-notes-textarea"
//               contentEditable={true}
//               suppressContentEditableWarning={true}
//               data-placeholder="Write your private observation during the session..."
//               onInput={(e) => setPrivateNotesText(e.currentTarget.innerHTML)}
//               style={{
//                 minHeight: "120px",
//                 maxHeight: isNotesExpanded ? "400px" : "180px",
//                 overflowY: "auto",
//                 outline: "none",
//                 padding: "10px",
//                 backgroundColor: "#ffffff",
//                 border: "1px solid #e2e8f0",
//                 borderRadius: "8px 8px 0 0",
//               }}
//             />

//             {/* Editor Toolbar */}
//             <div
//               className="ps-session-notes-toolbar"
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "space-between",
//                 padding: "6px 12px",
//                 backgroundColor: "#f8fafc",
//                 border: "1px solid #e2e8f0",
//                 borderTop: "none",
//                 borderRadius: "0 0 8px 8px",
//                 gap: "8px",
//                 flexWrap: "wrap",
//               }}
//             >
//               <div
//                 className="ps-session-toolbar-left-items"
//                 style={{
//                   display: "flex",
//                   alignItems: "center",
//                   gap: "10px",
//                   flexWrap: "wrap",
//                 }}
//               >
//                 {/* Font Size Dropdown */}
//                 <span
//                   style={{
//                     cursor: "pointer",
//                     position: "relative",
//                     fontSize: "13px",
//                   }}
//                 >
//                   14 ▾
//                   <select
//                     style={{
//                       position: "absolute",
//                       opacity: 0,
//                       top: 0,
//                       left: 0,
//                       width: "100%",
//                       height: "100%",
//                       cursor: "pointer",
//                     }}
//                     onChange={(e) =>
//                       execNotesCommand("fontSize", e.target.value)
//                     }
//                     defaultValue="3"
//                   >
//                     <option value="1">10</option>
//                     <option value="2">12</option>
//                     <option value="3">14</option>
//                     <option value="4">18</option>
//                     <option value="5">24</option>
//                     <option value="6">32</option>
//                   </select>
//                 </span>

//                 {/* Color Picker */}
//                 <span
//                   style={{
//                     cursor: "pointer",
//                     position: "relative",
//                     fontSize: "14px",
//                   }}
//                 >
//                   ⚫
//                   <input
//                     type="color"
//                     style={{
//                       position: "absolute",
//                       opacity: 0,
//                       top: 0,
//                       left: 0,
//                       width: "100%",
//                       height: "100%",
//                       cursor: "pointer",
//                     }}
//                     onChange={(e) =>
//                       execNotesCommand("foreColor", e.target.value)
//                     }
//                   />
//                 </span>

//                 {/* Bold */}
//                 <strong
//                   style={{
//                     cursor: "pointer",
//                     padding: "2px 6px",
//                     userSelect: "none",
//                   }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("bold");
//                   }}
//                 >
//                   B
//                 </strong>

//                 {/* Italic */}
//                 <em
//                   style={{
//                     cursor: "pointer",
//                     padding: "2px 6px",
//                     userSelect: "none",
//                   }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("italic");
//                   }}
//                 >
//                   I
//                 </em>

//                 {/* Underline */}
//                 <span
//                   style={{
//                     textDecoration: "underline",
//                     cursor: "pointer",
//                     padding: "2px 6px",
//                     userSelect: "none",
//                   }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("underline");
//                   }}
//                 >
//                   U
//                 </span>

//                 {/* Strikethrough */}
//                 <span
//                   style={{
//                     textDecoration: "line-through",
//                     cursor: "pointer",
//                     padding: "2px 6px",
//                     userSelect: "none",
//                   }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("strikeThrough");
//                   }}
//                 >
//                   S
//                 </span>

//                 {/* Align Left */}
//                 <svg
//                   width="14"
//                   height="14"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   viewBox="0 0 24 24"
//                   style={{ cursor: "pointer" }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("justifyLeft");
//                   }}
//                 >
//                   <path d="M4 6h16M4 12h10M4 18h16" />
//                 </svg>

//                 {/* Align Center */}
//                 <svg
//                   width="14"
//                   height="14"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   viewBox="0 0 24 24"
//                   style={{ cursor: "pointer" }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("justifyCenter");
//                   }}
//                 >
//                   <path d="M4 6h16M4 12h16M4 18h16" />
//                 </svg>

//                 {/* Align Right */}
//                 <svg
//                   width="14"
//                   height="14"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   viewBox="0 0 24 24"
//                   style={{ cursor: "pointer" }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("justifyRight");
//                   }}
//                 >
//                   <path d="M4 6h16M10 12h10M4 18h16" />
//                 </svg>

//                 {/* Unordered List */}
//                 <svg
//                   width="14"
//                   height="14"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   viewBox="0 0 24 24"
//                   style={{ cursor: "pointer" }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("insertUnorderedList");
//                   }}
//                 >
//                   <line x1="8" y1="6" x2="21" y2="6"></line>
//                   <line x1="8" y1="12" x2="21" y2="12"></line>
//                   <line x1="8" y1="18" x2="21" y2="18"></line>
//                   <line x1="3" y1="6" x2="3.01" y2="6"></line>
//                   <line x1="3" y1="12" x2="3.01" y2="12"></line>
//                   <line x1="3" y1="18" x2="3.01" y2="18"></line>
//                 </svg>

//                 {/* Ordered List */}
//                 <svg
//                   width="14"
//                   height="14"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   viewBox="0 0 24 24"
//                   style={{ cursor: "pointer" }}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     execNotesCommand("insertOrderedList");
//                   }}
//                 >
//                   <line x1="10" y1="6" x2="21" y2="6"></line>
//                   <line x1="10" y1="12" x2="21" y2="12"></line>
//                   <line x1="10" y1="18" x2="21" y2="18"></line>
//                   <path d="M4 6h1v4"></path>
//                   <path d="M4 10h2"></path>
//                   <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
//                 </svg>
//               </div>

//               {/* Expand / Fullscreen Toggle */}
//               <svg
//                 width="14"
//                 height="14"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2"
//                 viewBox="0 0 24 24"
//                 style={{ cursor: "pointer" }}
//                 onClick={() => setIsNotesExpanded(!isNotesExpanded)}
//               >
//                 <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
//               </svg>
//             </div>

//             <button
//               type="button"
//               className="ps-session-btn-save-note"
//               onClick={handleSavePrivateNotes}
//               disabled={isSubmittingPrivateNotes}
//               style={{ marginTop: "12px" }}
//             >
//               {isSubmittingPrivateNotes ? "Saving..." : "Save Notes"}
//             </button>
//           </div>

//           {/* Live Chat Card */}
//           <div className="ps-session-module-card">
//             <div className="ps-session-card-head">
//               <h3 className="ps-session-card-title">
//                 <svg
//                   className="ps-session-head-icon-plum"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                 >
//                   <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
//                 </svg>
//                 Live Chat
//               </h3>
//             </div>
//             <div className="ps-session-chat-timeline" ref={chatTimelineRef}>
//               <div className="ps-session-chat-day-label">Today</div>
//               {chatMessages.length === 0 ? (
//                 <p
//                   style={{
//                     textAlign: "center",
//                     fontSize: "12px",
//                     color: "#a3a3a3",
//                     marginTop: "12px",
//                   }}
//                 >
//                   No messages yet. Send a message to start chatting.
//                 </p>
//               ) : (
//                 chatMessages.map((msg, index) => {
//                   const msgText = msg.text || msg.message || "";
//                   const isDoctorMsg =
//                     msg.sender_type === "therapist" ||
//                     msg.sender_type === "doctor" ||
//                     msg.sender === doctorFullName ||
//                     String(msg.sender_id) === String(parsedUser?.user?.id) ||
//                     (typeof msg.senderId === "string" &&
//                       (msg.senderId.startsWith("therapist") ||
//                         msg.senderId.startsWith("doctor") ||
//                         msg.senderId === String(parsedUser?.user?.id)));

//                   const rawFileUrl =
//                     msg.fileUrl ||
//                     (msg as any).file_url ||
//                     (msg as any).url ||
//                     "";
//                   const rawFileName =
//                     msg.fileName ||
//                     (msg as any).file_name ||
//                     (msg as any).name ||
//                     "";
//                   const rawFileType = (
//                     msg.fileType ||
//                     (msg as any).file_type ||
//                     ""
//                   ).toLowerCase();

//                   const isRawImageUrl =
//                     !rawFileUrl &&
//                     typeof msgText === "string" &&
//                     /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(
//                       msgText.trim()
//                     );

//                   const effectiveFileUrl =
//                     rawFileUrl || (isRawImageUrl ? msgText.trim() : "");
//                   const effectiveFileName =
//                     rawFileName ||
//                     (effectiveFileUrl
//                       ? effectiveFileUrl.split("/").pop()?.split("?")[0]
//                       : "");

//                   const isImg =
//                     Boolean(effectiveFileUrl) &&
//                     (rawFileType === "image" ||
//                       rawFileType.startsWith("image/") ||
//                       /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic)(\?.*)?$/i.test(
//                         (effectiveFileName || effectiveFileUrl).toLowerCase()
//                       ));

//                   const displayText =
//                     effectiveFileUrl &&
//                     msgText.trim() === effectiveFileUrl.trim()
//                       ? ""
//                       : msgText;

//                   return (
//                     <div
//                       key={msg.id || index}
//                       className={`ps-session-chat-msg-bubble-line ${
//                         isDoctorMsg ? "ps-session-msg-row-user" : ""
//                       }`}
//                     >
//                       <div className="ps-session-chat-sender-avatar">
//                         <img
//                           src={
//                             isDoctorMsg
//                               ? therapistImgUrl || doctorProfileImgUrl
//                               : patientImgUrl ||
//                                 "/images/header-user-right-profile.svg"
//                           }
//                           alt="Avatar"
//                           style={{
//                             width: "25px",
//                             height: "25px",
//                             borderRadius: "50%",
//                             objectFit: "cover",
//                             overflow: "hidden",
//                           }}
//                         />
//                       </div>
//                       <div className="ps-session-msg-wrapper-inner">
//                         <div
//                           className="ps-session-msg-text-bubble"
//                           style={
//                             isImg && !displayText
//                               ? {
//                                   padding: "4px",
//                                   backgroundColor: "transparent",
//                                 }
//                               : undefined
//                           }
//                         >
//                           {effectiveFileUrl && isImg && (
//                             <a
//                               href={effectiveFileUrl}
//                               target="_blank"
//                               rel="noopener noreferrer"
//                               style={{
//                                 display: "block",
//                                 textDecoration: "none",
//                               }}
//                             >
//                               <img
//                                 src={effectiveFileUrl}
//                                 alt={effectiveFileName || "Image"}
//                                 style={{
//                                   maxWidth: "100%",
//                                   maxHeight: "220px",
//                                   borderRadius: "10px",
//                                   objectFit: "cover",
//                                   display: "block",
//                                   cursor: "pointer",
//                                   marginBottom: displayText ? "6px" : "0",
//                                 }}
//                                 loading="lazy"
//                               />
//                             </a>
//                           )}

//                           {effectiveFileUrl && !isImg && (
//                             <a
//                               href={effectiveFileUrl}
//                               target="_blank"
//                               rel="noopener noreferrer"
//                               style={{
//                                 display: "flex",
//                                 alignItems: "center",
//                                 gap: "8px",
//                                 padding: "6px 10px",
//                                 borderRadius: "8px",
//                                 backgroundColor: isDoctorMsg
//                                   ? "rgba(255, 255, 255, 0.18)"
//                                   : "rgba(0, 0, 0, 0.05)",
//                                 color: "inherit",
//                                 textDecoration: "none",
//                                 marginBottom: displayText ? "6px" : "0",
//                               }}
//                             >
//                               <svg
//                                 width="20"
//                                 height="20"
//                                 viewBox="0 0 24 24"
//                                 fill="none"
//                                 stroke="currentColor"
//                                 strokeWidth="2"
//                                 strokeLinecap="round"
//                                 strokeLinejoin="round"
//                                 style={{ flexShrink: 0 }}
//                               >
//                                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
//                                 <polyline points="14 2 14 8 20 8" />
//                                 <line x1="16" y1="13" x2="8" y2="13" />
//                                 <line x1="16" y1="17" x2="8" y2="17" />
//                               </svg>
//                               <span
//                                 style={{
//                                   fontSize: "12px",
//                                   fontWeight: 500,
//                                   wordBreak: "break-all",
//                                   flexGrow: 1,
//                                 }}
//                               >
//                                 {effectiveFileName || "View File"}
//                               </span>
//                               <svg
//                                 width="14"
//                                 height="14"
//                                 viewBox="0 0 24 24"
//                                 fill="none"
//                                 stroke="currentColor"
//                                 strokeWidth="2"
//                                 strokeLinecap="round"
//                                 strokeLinejoin="round"
//                                 style={{ flexShrink: 0 }}
//                               >
//                                 <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
//                                 <polyline points="15 3 21 3 21 9" />
//                                 <line x1="10" y1="14" x2="21" y2="3" />
//                               </svg>
//                             </a>
//                           )}

//                           {displayText
//                             ? displayText
//                             : !effectiveFileUrl
//                             ? msgText
//                             : null}
//                         </div>
//                         <span
//                           className="ps-session-chat-time-text"
//                           style={{ textAlign: isDoctorMsg ? "right" : "left" }}
//                         >
//                           {formatChatTime(msg)}
//                           {isDoctorMsg && (
//                             <svg
//                               width="14"
//                               height="14"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke={msg.seen ? "#1890ff" : "#52c41a"}
//                               strokeWidth="2.5"
//                               strokeLinecap="round"
//                               strokeLinejoin="round"
//                               style={{
//                                 display: "inline-block",
//                                 verticalAlign: "middle",
//                                 marginLeft: "4px",
//                               }}
//                             >
//                               <path d="M18 6L7 17l-5-5" />
//                               <path d="M22 10l-7.5 7.5L13 16" />
//                             </svg>
//                           )}
//                         </span>
//                       </div>
//                     </div>
//                   );
//                 })
//               )}
//             </div>
//             <form
//               onSubmit={handleSendChatMessage}
//               className="ps-session-chat-input-row"
//             >
//               <input
//                 type="text"
//                 className="ps-session-chat-text-input"
//                 placeholder="Type a message..."
//                 value={chatInputText}
//                 onChange={(e) => setChatInputText(e.target.value)}
//               />
//               <button type="submit" className="ps-session-chat-btn-send">
//                 <svg
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                 >
//                   <line x1="22" y1="2" x2="11" y2="13"></line>
//                   <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
//                 </svg>
//               </button>
//             </form>
//           </div>

//           {/* Documents Card */}
//           <div className="ps-session-module-card">
//             <div className="ps-session-card-head">
//               <h3 className="ps-session-card-title">
//                 <svg
//                   className="ps-session-head-icon-plum"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                 >
//                   <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
//                 </svg>
//                 Documents & Attachments
//               </h3>
//             </div>

//             <div className="ps-session-tabs-row">
//               <div
//                 className={`ps-session-tab ${
//                   docTab === "therapist" ? "ps-session-active-tab" : ""
//                 }`}
//                 style={{ cursor: "pointer" }}
//                 onClick={() => setDocTab("therapist")}
//               >
//                 Shared by you{" "}
//                 <span className="ps-session-badge-count">
//                   {therapistDocuments.length}
//                 </span>
//               </div>
//               <div
//                 className={`ps-session-tab ${
//                   docTab === "patient" ? "ps-session-active-tab" : ""
//                 }`}
//                 style={{ cursor: "pointer" }}
//                 onClick={() => setDocTab("patient")}
//               >
//                 Shared by Patient{" "}
//                 <span className="ps-session-badge-count">
//                   {patientDocuments.length}
//                 </span>
//               </div>
//             </div>

//             {/* Document Items List */}
//             {isFetchingDocs ? (
//               <div
//                 style={{
//                   textAlign: "center",
//                   padding: "12px",
//                   fontSize: "12px",
//                   color: "#8c8c8c",
//                 }}
//               >
//                 Loading documents...
//               </div>
//             ) : (docTab === "therapist" ? therapistDocuments : patientDocuments)
//                 .length === 0 ? (
//               <div
//                 style={{
//                   textAlign: "center",
//                   padding: "12px",
//                   fontSize: "12px",
//                   color: "#8c8c8c",
//                 }}
//               >
//                 No documents found.
//               </div>
//             ) : (
//               (docTab === "therapist"
//                 ? therapistDocuments
//                 : patientDocuments
//               ).map((docItem, idx) => (
//                 <div
//                   className="ps-session-file-attachment-row"
//                   key={docItem.id || idx}
//                 >
//                   <div>
//                     <div className="ps-session-file-title">
//                       {docItem.file_name}
//                     </div>
//                     <div className="ps-session-file-meta">
//                       {docItem.file_type
//                         ? `${docItem.file_type} File`
//                         : "Document"}
//                     </div>
//                   </div>
//                   {docItem.file_url ? (
//                     <a
//                       href={docItem.file_url}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="ps-session-view-link"
//                     >
//                       View ▾
//                     </a>
//                   ) : null}
//                 </div>
//               ))
//             )}

//             {/* Hidden File Input */}
//             <input
//               type="file"
//               ref={docFileInputRef}
//               style={{ display: "none" }}
//               onChange={handleDocumentUpload}
//               accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
//             />

//             {/* Upload Dropzone (Visible on Therapist Tab) */}
//             {docTab === "therapist" && (
//               <div
//                 className="ps-session-upload-dashed-dropzone"
//                 style={{ cursor: isUploadingDoc ? "not-allowed" : "pointer" }}
//                 onClick={() => {
//                   if (!isUploadingDoc) docFileInputRef.current?.click();
//                 }}
//               >
//                 <p className="ps-session-upload-main-text">
//                   {isUploadingDoc ? "Uploading Document..." : "Upload Document"}
//                 </p>
//                 <p className="ps-session-upload-sub-text">
//                   Allowed: PDF, DOC, DOCX, JPG, PNG (Max: 10MB)
//                 </p>
//               </div>
//             )}
//           </div>

//           {/* Dynamic Participants Card */}

//           {/* Dynamic Participants Card */}
//           {(() => {
//             const patientData = joinedCallData?.patient;
//             const expectedPatientUid =
//               videoCallSession?.patient_uid ||
//               patientData?.uid ||
//               patientData?.id;

//             // Identify which remoteUser is the patient so we don't render them twice
//             const patientRemoteUser =
//               remoteUsers.find(
//                 (u) =>
//                   expectedPatientUid &&
//                   String(u.uid) === String(expectedPatientUid)
//               ) ||
//               (remoteUsers.length === 1 && patientData
//                 ? remoteUsers[0]
//                 : undefined);

//             const extraRemoteUsers = remoteUsers.filter(
//               (u) =>
//                 !patientRemoteUser ||
//                 String(u.uid) !== String(patientRemoteUser.uid)
//             );

//             const hasPatient = Boolean(patientData || patientRemoteUser);
//             const totalParticipantsCount =
//               1 + (hasPatient ? 1 : 0) + extraRemoteUsers.length;

//             const isPatientMicOn = patientRemoteUser
//               ? patientRemoteUser.hasAudio
//               : true;

//             return (
//               <div className="ps-session-module-card">
//                 <div className="ps-session-card-head">
//                   <h3 className="ps-session-card-title">
//                     <svg
//                       className="ps-session-head-icon-plum"
//                       viewBox="0 0 24 24"
//                       fill="none"
//                       stroke="currentColor"
//                       strokeWidth="2"
//                     >
//                       <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
//                     </svg>
//                     Participants{" "}
//                     <span className="ps-session-title-aside">
//                       ({totalParticipantsCount})
//                     </span>
//                   </h3>
//                 </div>
//                 <div className="ps-session-participants-list-holder">
//                   {/* Therapist (Host) */}
//                   <div className="ps-session-participant-line">
//                     <div className="ps-session-participant-meta">
//                       <div className="ps-session-chat-sender-avatar">
//                         <img
//                           src={therapistImgUrl || doctorProfileImgUrl}
//                           alt="Therapist Profile"
//                           style={{
//                             width: "25px",
//                             height: "25px",
//                             borderRadius: "50%",
//                             objectFit: "cover",
//                             overflow: "hidden",
//                           }}
//                         />
//                       </div>
//                       <span>
//                         {therapistDisplayName || `${doctorFullName} (Host)`}
//                       </span>
//                     </div>
//                     <svg
//                       className={`ps-session-status-icon-right ${
//                         micActive ? "ps-session-mic-on" : "ps-session-mic-off"
//                       }`}
//                       viewBox="0 0 24 24"
//                       fill="none"
//                       stroke="currentColor"
//                       strokeWidth="2"
//                     >
//                       {micActive ? (
//                         <>
//                           <rect x="4" y="9" width="3" height="6" rx="1.5" />
//                           <rect x="10" y="5" width="3" height="14" rx="1.5" />
//                           <rect x="16" y="7" width="3" height="10" rx="1.5" />
//                         </>
//                       ) : (
//                         <>
//                           <line x1="1" y1="1" x2="23" y2="23"></line>
//                           <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
//                         </>
//                       )}
//                     </svg>
//                   </div>

//                   {/* Patient Participant (Merged API + Agora Stream) */}
//                   {hasPatient && (
//                     <div className="ps-session-participant-line">
//                       <div className="ps-session-participant-meta">
//                         <div className="ps-session-chat-sender-avatar">
//                           <img
//                             src={
//                               patientImgUrl ||
//                               "/images/header-user-right-profile.svg"
//                             }
//                             alt="Patient Profile"
//                             style={{
//                               width: "25px",
//                               height: "25px",
//                               borderRadius: "50%",
//                               objectFit: "cover",
//                               overflow: "hidden",
//                             }}
//                           />
//                         </div>
//                         <span>
//                           {patientDisplayName ||
//                             dynamicPatientName ||
//                             (patientRemoteUser
//                               ? `Participant (${patientRemoteUser.uid})`
//                               : "Patient")}
//                         </span>
//                       </div>
//                       <svg
//                         className={`ps-session-status-icon-right ${
//                           isPatientMicOn
//                             ? "ps-session-mic-on"
//                             : "ps-session-mic-off"
//                         }`}
//                         viewBox="0 0 24 24"
//                         fill="none"
//                         stroke="currentColor"
//                         strokeWidth="2"
//                       >
//                         {isPatientMicOn ? (
//                           <>
//                             <rect x="4" y="9" width="3" height="6" rx="1.5" />
//                             <rect x="10" y="5" width="3" height="14" rx="1.5" />
//                             <rect x="16" y="7" width="3" height="10" rx="1.5" />
//                           </>
//                         ) : (
//                           <>
//                             <line x1="1" y1="1" x2="23" y2="23"></line>
//                             <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
//                           </>
//                         )}
//                       </svg>
//                     </div>
//                   )}

//                   {/* Extra Remote Users (Excluding Patient) */}
//                   {extraRemoteUsers.map((user) => (
//                     <div className="ps-session-participant-line" key={user.uid}>
//                       <div className="ps-session-participant-meta">
//                         <div className="ps-session-chat-sender-avatar">
//                           <img
//                             src="/images/header-user-right-profile.svg"
//                             alt="User Profile"
//                             style={{
//                               width: "25px",
//                               height: "25px",
//                               borderRadius: "50%",
//                               objectFit: "cover",
//                               overflow: "hidden",
//                             }}
//                           />
//                         </div>
//                         <span>Participant ({user.uid})</span>
//                       </div>
//                       <svg
//                         className={`ps-session-status-icon-right ${
//                           user.hasAudio
//                             ? "ps-session-mic-on"
//                             : "ps-session-mic-off"
//                         }`}
//                         viewBox="0 0 24 24"
//                         fill="none"
//                         stroke="currentColor"
//                         strokeWidth="2"
//                       >
//                         {user.hasAudio ? (
//                           <>
//                             <rect x="4" y="9" width="3" height="6" rx="1.5" />
//                             <rect x="10" y="5" width="3" height="14" rx="1.5" />
//                             <rect x="16" y="7" width="3" height="10" rx="1.5" />
//                           </>
//                         ) : (
//                           <>
//                             <line x1="1" y1="1" x2="23" y2="23"></line>
//                             <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
//                           </>
//                         )}
//                       </svg>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             );
//           })()}
//         </div>
//       </div>
//       <EndSession
//         sessionId={rawSessionId || undefined}
//         audioBlob={audioBlob}
//         transcript={transcriptText || transcriptTextRef.current}
//         getRecordingData={getRecordingData}
//         onConfirmEnd={handleEndCall}
//       />
//     </main>
//   );
// };

// // 2. Exported Parent Wrapper providing the Agora RTC Client
// const VideoConfrence: React.FC<VideoConferenceProps> = (props) => {
//   const [client] = useState(() =>
//     AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
//   );

//   return (
//     <AgoraRTCProvider client={client}>
//       <VideoRoomInner {...props} />
//     </AgoraRTCProvider>
//   );
// };

// export default VideoConfrence;

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

// {(() => {
//   const patientData = joinedCallData?.patient;
//   const totalParticipantsCount =
//     remoteUsers.length > 0
//       ? remoteUsers.length + 1
//       : patientData
//       ? 2
//       : 1;

//   return (
//     <div className="ps-session-module-card">
//       <div className="ps-session-card-head">
//         <h3 className="ps-session-card-title">
//           <svg
//             className="ps-session-head-icon-plum"
//             viewBox="0 0 24 24"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="2"
//           >
//             <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
//           </svg>
//           Participants{" "}
//           <span className="ps-session-title-aside">
//             ({totalParticipantsCount})
//           </span>
//         </h3>
//       </div>
//       <div className="ps-session-participants-list-holder">
//         {/* Therapist (Host) */}
//         <div className="ps-session-participant-line">
//           <div className="ps-session-participant-meta">
//             <div className="ps-session-chat-sender-avatar">
//               <img
//                 src={therapistImgUrl || doctorProfileImgUrl}
//                 alt="Therapist Profile"
//                 style={{
//                   width: "25px",
//                   height: "25px",
//                   borderRadius: "50%",
//                   objectFit: "cover",
//                   overflow: "hidden",
//                 }}
//               />
//             </div>
//             <span>
//               {therapistDisplayName || `${doctorFullName} (Host)`}
//             </span>
//           </div>
//           <svg
//             className={`ps-session-status-icon-right ${
//               micActive ? "ps-session-mic-on" : "ps-session-mic-off"
//             }`}
//             viewBox="0 0 24 24"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="2"
//           >
//             {micActive ? (
//               <>
//                 <rect x="4" y="9" width="3" height="6" rx="1.5" />
//                 <rect x="10" y="5" width="3" height="14" rx="1.5" />
//                 <rect x="16" y="7" width="3" height="10" rx="1.5" />
//               </>
//             ) : (
//               <>
//                 <line x1="1" y1="1" x2="23" y2="23"></line>
//                 <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
//               </>
//             )}
//           </svg>
//         </div>

//         {/* Patient Participant */}
//         {(patientData || remoteUsers.length > 0) && (
//           <div className="ps-session-participant-line">
//             <div className="ps-session-participant-meta">
//               <div className="ps-session-chat-sender-avatar">
//                 <img
//                   src={
//                     patientImgUrl ||
//                     "/images/header-user-right-profile.svg"
//                   }
//                   alt="Patient Profile"
//                   style={{
//                     width: "25px",
//                     height: "25px",
//                     borderRadius: "50%",
//                     objectFit: "cover",
//                     overflow: "hidden",
//                   }}
//                 />
//               </div>
//               <span>
//                 {patientDisplayName ||
//                   dynamicPatientName ||
//                   "Patient"}
//               </span>
//             </div>
//             <svg
//               className="ps-session-status-icon-right ps-session-mic-on"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//             >
//               <rect x="4" y="9" width="3" height="6" rx="1.5" />
//               <rect x="10" y="5" width="3" height="14" rx="1.5" />
//               <rect x="16" y="7" width="3" height="10" rx="1.5" />
//             </svg>
//           </div>
//         )}

//         {/* Extra Remote Users (if any) */}
//         {remoteUsers.map((user) => (
//           <div className="ps-session-participant-line" key={user.uid}>
//             <div className="ps-session-participant-meta">
//               <div className="ps-session-chat-sender-avatar">
//                 <img
//                   src="/images/header-user-right-profile.svg"
//                   alt="User Profile"
//                   style={{
//                     width: "25px",
//                     height: "25px",
//                     borderRadius: "50%",
//                     overflow: "hidden",
//                   }}
//                 />
//               </div>
//               <span>Participant ({user.uid})</span>
//             </div>
//             <svg
//               className={`ps-session-status-icon-right ${
//                 user.hasAudio
//                   ? "ps-session-mic-on"
//                   : "ps-session-mic-off"
//               }`}
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//             >
//               {user.hasAudio ? (
//                 <>
//                   <rect x="4" y="9" width="3" height="6" rx="1.5" />
//                   <rect x="10" y="5" width="3" height="14" rx="1.5" />
//                   <rect x="16" y="7" width="3" height="10" rx="1.5" />
//                 </>
//               ) : (
//                 <>
//                   <line x1="1" y1="1" x2="23" y2="23"></line>
//                   <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
//                 </>
//               )}
//             </svg>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// })()}
