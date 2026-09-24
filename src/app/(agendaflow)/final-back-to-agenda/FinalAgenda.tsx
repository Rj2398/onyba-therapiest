"use client";
import AgendaCalendarPopup from "@/src/component/AgendaCalendarPopup";
import CancelSessionPopup from "@/src/component/CancelSessionPopup";
import EndSession from "@/src/component/meetingmodal/EndSession";
import Link from "next/link";
import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Base_image_url } from "@/src/config";
import { requestApi } from "@/src/utils/api";
import axios from "axios";
import { API_BASE_URL } from "@/src/config";

export interface FinalAgendaProps {
  sessionData?: any;
  isLoading?: boolean;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatTime = (timeStr?: string) => {
  if (!timeStr) return "";
  try {
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    return timeStr;
  } catch {
    return timeStr;
  }
};

const formatTimeRange = (start?: string, end?: string) => {
  if (!start && !end) return "";
  if (start && !end) return formatTime(start);
  if (!start && end) return formatTime(end);
  return `${formatTime(start)} - ${formatTime(end)}`;
};

const formatCurrencyValue = (val: any) => {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).trim();
  if (str.startsWith("$")) return str;
  const num = Number(str);
  if (!isNaN(num)) {
    return `$${num.toFixed(2)}`;
  }
  return `$${str}`;
};

const formatStatus = (status?: string) => {
  if (!status) return "";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

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

const FinalAgendaContent: React.FC<FinalAgendaProps> = ({
  sessionData: initialSessionData,
  isLoading: initialLoading,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionData, setSessionData] = useState<any>(
    initialSessionData || null
  );

  console.log(sessionData?.session_mode, "Session data****");
  const [loading, setLoading] = useState<boolean>(initialLoading || false);

  const session_id =
    searchParams.get("session_id") ||
    searchParams.get("therapy_session_id") ||
    searchParams.get("id") ||
    sessionData?.therapy_session_id ||
    sessionData?.id ||
    initialSessionData?.id;
  const hide_button: boolean = searchParams.get("hide") === "true";

  const startSessionUrl =
    searchParams && searchParams.toString()
      ? `/video-confrenece?${searchParams.toString()}`
      : "/video-confrenece";

  const [otp, setOtp] = useState(["", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [resendTimer, setResendTimer] = useState<number>(0);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [savingPrivateNotes, setSavingPrivateNotes] = useState(false);
  const [savingPublicNotes, setSavingPublicNotes] = useState(false);

  const [isEditingAiSummary, setIsEditingAiSummary] = useState<boolean>(false);
  const [aiSummaryText, setAiSummaryText] = useState<string>("");
  const [isSavingAiSummary, setIsSavingAiSummary] = useState<boolean>(false);

  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [taskInput, setTaskInput] = useState<string>("");
  const [isSavingTask, setIsSavingTask] = useState<boolean>(false);

  const [privateNotes, setPrivateNotes] = useState<string>(
    initialSessionData?.therapist_private_notes || ""
  );
  const [publicNotes, setPublicNotes] = useState<string>(
    initialSessionData?.therapist_public_notes || ""
  );
  const [taskList, setTaskList] = useState<any[]>(
    initialSessionData?.task_list || []
  );
  const [activeDocTab, setActiveDocTab] = useState<"therapist" | "patient">(
    "therapist"
  );
  const [prevSessionSearch, setPrevSessionSearch] = useState<string>("");

  const isOnline = sessionData?.session_mode?.toLowerCase() === "online";
  const isStartedCall = Boolean(sessionData?.is_started_call);
  const canReschedule = Boolean(sessionData?.can_reschedule);

  const [serviceList, setServiceList] = useState<{ id: any; name: string }[]>(
    []
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | number>(
    ""
  );
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);

  const addedServiceIdentifiers = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(sessionData?.additional_services)) {
      sessionData.additional_services.forEach((item: any) => {
        if (item.id !== undefined && item.id !== null)
          set.add(String(item.id).toLowerCase());
        if (item.service_id !== undefined && item.service_id !== null)
          set.add(String(item.service_id).toLowerCase());
        if (item.service_name)
          set.add(String(item.service_name).toLowerCase().trim());
        if (item.name) set.add(String(item.name).toLowerCase().trim());
      });
    }
    return set;
  }, [sessionData?.additional_services]);

  const availableDropdownServices = useMemo(() => {
    return serviceList.filter((item) => {
      const itemId = String(item.id).toLowerCase();
      const itemName = String(item.name || "")
        .toLowerCase()
        .trim();
      return (
        !addedServiceIdentifiers.has(itemId) &&
        !addedServiceIdentifiers.has(itemName)
      );
    });
  }, [serviceList, addedServiceIdentifiers]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await requestApi({
          endpoint: "get-session-type",
          method: "POST",
        });

        const list =
          res?.data?.session_types ||
          (Array.isArray(res?.data) ? res.data : []);

        if (Array.isArray(list)) {
          const formatted = list.map((item: any) => ({
            id: item.id,
            name: item.name || item.session_type || `Service #${item.id}`,
          }));
          setServiceList(formatted);
        }
      } catch (err) {
        console.error("Error fetching session types in FinalAgenda:", err);
      }
    };

    fetchServices();
  }, []);

  const fetchSessionDetails = async () => {
    if (!session_id) return;
    try {
      const response = await requestApi({
        endpoint: `get-session-details/${session_id}`,
        method: "POST",
      });
      if (response && response.success === true && response.data) {
        if (response.data.patient_type === "clinic_patient") {
          router.push(
            session_id
              ? `/back-to-agenda?session_id=${session_id}`
              : "/back-to-agenda"
          );
          return;
        }
        setSessionData(response.data);
        setPrivateNotes(response.data.therapist_private_notes || "");
        setPublicNotes(response.data.therapist_public_notes || "");
        if (response.data.task_list && Array.isArray(response.data.task_list)) {
          setTaskList(response.data.task_list);
        }
      } else if (response && response.success === false) {
        toast.error(response.message || "Failed to fetch session details.");
      }
    } catch (err) {
      console.error("Error fetching session details in FinalAgenda:", err);
    }
  };

  useEffect(() => {
    if (initialSessionData) {
      if (initialSessionData.patient_type === "clinic_patient") {
        router.push(
          session_id
            ? `/back-to-agenda?session_id=${session_id}`
            : "/back-to-agenda"
        );
        return;
      }
      setSessionData(initialSessionData);
      setPrivateNotes(initialSessionData.therapist_private_notes || "");
      setPublicNotes(initialSessionData.therapist_public_notes || "");
      if (
        initialSessionData.task_list &&
        Array.isArray(initialSessionData.task_list)
      ) {
        setTaskList(initialSessionData.task_list);
      }
    } else if (session_id) {
      fetchSessionDetails();
    }
  }, [initialSessionData, session_id]);

  useEffect(() => {
    if (sessionData && sessionData.patient_type === "clinic_patient") {
      router.push(
        session_id
          ? `/back-to-agenda?session_id=${session_id}`
          : "/back-to-agenda"
      );
    }
  }, [sessionData, router, session_id]);

  const handleSelectService = async (service: any) => {
    setSelectedServiceId(service.id);
    setIsServiceDropdownOpen(false);

    const effectiveSessionId =
      session_id || sessionData?.id || sessionData?.therapy_session_id;

    if (!effectiveSessionId) {
      toast.error("Session ID not found.");
      return;
    }

    try {
      toast.loading("Adding service...", { id: "add-service" });

      const response = await requestApi({
        endpoint: "add-session-additional-services",
        method: "POST",
        data: {
          therapy_session_id: String(effectiveSessionId),
          service_id: String(service.id),
        },
      });

      toast.dismiss("add-service");
      if (response && response.success === true) {
        toast.success(response.message || "Service added successfully.");
        await fetchSessionDetails();
      } else {
        toast.error(response?.message || "Failed to add service.");
      }
    } catch (err: any) {
      toast.dismiss("add-service");
      console.error("Error adding session additional service:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Error adding service"
      );
    }
  };

  const handleRequestAdditionalPayment = async () => {
    const effectiveSessionId =
      session_id ||
      sessionData?.id ||
      sessionData?.therapy_session_id ||
      sessionData?.patient_id;

    if (!effectiveSessionId) {
      toast.error("Session ID not found.");
      return;
    }

    const pDetails = Array.isArray(sessionData?.payment_details)
      ? sessionData.payment_details[0]
      : sessionData?.payment_details;

    const addServices =
      pDetails?.additional_services &&
      Array.isArray(pDetails.additional_services) &&
      pDetails.additional_services.length > 0
        ? pDetails.additional_services
        : Array.isArray(sessionData?.additional_services) &&
          sessionData.additional_services.length > 0
        ? sessionData.additional_services
        : [];

    let serviceIds: any[] = addServices
      .map((srv: any) => srv.service_id ?? srv.id)
      .filter((id: any) => id !== undefined && id !== null);

    if (serviceIds.length === 0) {
      const mainId = sessionData?.service_id || selectedServiceId;
      if (mainId !== undefined && mainId !== null && mainId !== "") {
        serviceIds.push(mainId);
      }
    }

    const formattedServiceIds = serviceIds.map((id: any) =>
      typeof id === "number" ? id : Number(id) || id
    );

    if (formattedServiceIds.length === 0) {
      toast.error("No service selected for payment request.");
      return;
    }

    let totalAmount = 0;
    if (addServices.length > 0) {
      totalAmount = addServices.reduce((acc: number, srv: any) => {
        const price = parseFloat(srv.service_price || srv.price || 0);
        return acc + (isNaN(price) ? 0 : price);
      }, 0);
    }

    if (totalAmount === 0) {
      const basePrice = parseFloat(
        pDetails?.session_amount || sessionData?.session_price || "0"
      );
      totalAmount = isNaN(basePrice) ? 50 : basePrice;
    }

    setIsRequestingPayment(true);
    try {
      toast.loading("Sending payment request...", { id: "req-payment" });

      const response = await requestApi({
        endpoint: "additional-payment-request",
        method: "POST",
        data: {
          therapy_session_id: String(effectiveSessionId),
          service_id: formattedServiceIds,
          amount: totalAmount,
        },
      });

      toast.dismiss("req-payment");
      if (
        response &&
        (response.success === true ||
          response.code === 200 ||
          response.status === true)
      ) {
        toast.success(
          response.message || "Additional payment requested successfully."
        );
        await fetchSessionDetails();
      } else {
        toast.error(
          response?.message || "Failed to request additional payment."
        );
      }
    } catch (err: any) {
      toast.dismiss("req-payment");
      console.error("Error requesting additional payment:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Error requesting additional payment."
      );
    } finally {
      setIsRequestingPayment(false);
    }
  };

  useEffect(() => {
    if (sessionData?.service_id) {
      setSelectedServiceId(sessionData.service_id);
    } else if (sessionData?.service_name && serviceList.length > 0) {
      const match = serviceList.find(
        (s) => s.name.toLowerCase() === sessionData.service_name.toLowerCase()
      );
      if (match) {
        setSelectedServiceId(match.id);
      }
    }
  }, [sessionData, serviceList]);

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value !== "" && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 5) {
      toast.error("Please enter a 5-digit verification code.");
      return;
    }
    setVerifyingOtp(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(session_id));
      formData.append("otp", otpCode);

      const response = await requestApi({
        endpoint: "verify-walkin",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && response.success === true) {
        toast.success("Patient verified successfully!");
        const backToCalendarUrl = session_id
          ? `/back-to-calendar?therapy_session_id=${session_id}`
          : "/back-to-calendar";
        router.push(backToCalendarUrl);
      } else {
        toast.error(
          response?.message || "OTP verification failed. Please check code."
        );
      }
    } catch (err: any) {
      console.error("Error verifying walk-in OTP:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Error verifying OTP"
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleStartSessionNotOnline = async () => {
    if (!session_id) {
      toast.error("Session ID not found.");
      return;
    }
    const otpCode = otp.join("");
    setVerifyingOtp(true);
    try {
      let response: any = null;
      if (otpCode.length === 5) {
        const formData = new FormData();
        formData.append("session_id", String(session_id));
        formData.append("otp", otpCode);

        response = await requestApi({
          endpoint: "verify-walkin",
          method: "POST",
          data: formData,
          isFormData: true,
        });
      } else {
        response = await requestApi({
          endpoint: `start-session/${session_id}`,
          method: "POST",
        });
      }

      if (response && response.success === true) {
        toast.success(response.message || "Session started successfully!");
        const backToCalendarUrl = session_id
          ? `/back-to-calendar?therapy_session_id=${session_id}`
          : "/back-to-calendar";
        router.push(backToCalendarUrl);
      } else {
        toast.error(
          response?.message || "Failed to start session. Please try again."
        );
      }
    } catch (err: any) {
      console.error("Error starting session:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Error starting session"
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  // 30-Second Resend Countdown Timer
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (resendTimer > 0) {
      timerId = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [resendTimer]);

  const handleResendVerificationCode = async () => {
    if (resendTimer > 0 || isResendingCode) return;

    const rawSessionId = session_id || initialSessionData?.id;
    if (!rawSessionId) {
      toast.error("Session ID is required to resend verification code.");
      return;
    }

    setIsResendingCode(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(rawSessionId));

      const response = await requestApi({
        endpoint: "resend-verification-code",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && response.success === true) {
        toast.success(
          response?.message || "Verification code resent successfully."
        );
        setResendTimer(30);
      } else {
        toast.error(response?.message || "Failed to resend verification code.");
      }
    } catch (err: any) {
      console.error("Error resending verification code:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Error resending verification code"
      );
    } finally {
      setIsResendingCode(false);
    }
  };

  const handleSaveAiSummary = async () => {
    const rawSessionId = session_id || initialSessionData?.id;
    if (!rawSessionId) {
      toast.error("Session ID is required to update AI summary.");
      return;
    }

    setIsSavingAiSummary(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(rawSessionId));
      formData.append("summary", aiSummaryText);

      const response = await requestApi({
        endpoint: "update-ai-summary",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && response.success === true) {
        toast.success(response?.message || "AI summary updated successfully!");
        setSessionData((prev: any) => ({
          ...prev,
          post_session_ai_summary: aiSummaryText,
        }));
        setIsEditingAiSummary(false);
      } else {
        toast.error(response?.message || "Failed to update AI summary.");
      }
    } catch (err: any) {
      console.error("Error updating AI summary:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Error updating AI summary"
      );
    } finally {
      setIsSavingAiSummary(false);
    }
  };

  const handleOpenTaskModal = () => {
    setTaskInput("");
    setShowTaskModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setTaskInput("");
    fetchSessionDetails();
  };

  const handleSaveTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!taskInput || !taskInput.trim()) {
      toast.error("Please enter task details");
      return;
    }
    if (!session_id) {
      toast.error("Session ID is missing");
      return;
    }

    setIsSavingTask(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(session_id));
      formData.append("task", taskInput.trim());

      const response = await requestApi({
        endpoint: "add-session-task",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (
        response &&
        (response.success || response.code === 200 || response.status)
      ) {
        toast.success(response.message || "Task added successfully!");
      }
      await fetchSessionDetails();
      setShowTaskModal(false);
      setTaskInput("");
    } catch (err: any) {
      console.error("Error adding session task:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Error adding task"
      );
      await fetchSessionDetails();
    } finally {
      setIsSavingTask(false);
    }
  };
  // const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];

  //   if (!file) return;

  //   const targetSessionId =
  //     session_id ||
  //     sessionData?.therapy_session_id ||
  //     sessionData?.id ||
  //     initialSessionData?.id;

  //   if (!targetSessionId) {
  //     toast.error("Session ID is missing");
  //     e.target.value = "";
  //     return;
  //   }

  //   setUploadingDoc(true);

  //   try {
  //     // ==========================================
  //     // Get token
  //     // ==========================================
  //     let token = "";

  //     if (typeof window !== "undefined") {
  //       const stored = window.localStorage.getItem("loginUser");

  //       if (stored) {
  //         try {
  //           const parsed = JSON.parse(stored);

  //           token = parsed?.token || parsed?.user_details?.token || "";
  //         } catch (error) {
  //           console.error("Failed to parse loginUser:", error);
  //         }
  //       }
  //     }

  //     // ==========================================
  //     // Create FormData
  //     // ==========================================
  //     const formData = new FormData();

  //     formData.append("session_id", String(targetSessionId));

  //     formData.append(
  //       "type",
  //       activeDocTab === "therapist" ? "therapist" : "patient"
  //     );

  //     formData.append("document", file);

  //     // ==========================================
  //     // Debug FormData
  //     // ==========================================
  //     for (const [key, value] of formData.entries()) {
  //       console.log("FormData:", key, value);
  //     }

  //     // ==========================================
  //     // Upload API
  //     // ==========================================
  //     const response = await axios.post(
  //       `${API_BASE_URL}/upload-session-documents`,
  //       formData,
  //       {
  //         headers: {
  //           Accept: "application/json",
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );

  //     console.log("Upload response:", response.data);

  //     const responseData = response.data;

  //     // ==========================================
  //     // SUCCESS
  //     // ==========================================
  //     if (
  //       responseData?.success === true ||
  //       responseData?.code === 200 ||
  //       responseData?.status === true ||
  //       responseData?.status === "success"
  //     ) {
  //       toast.success("Document uploaded successfully!");

  //       // ========================================
  //       // Get updated session details
  //       // ========================================
  //       const refreshResponse = await axios.post(
  //         `${API_BASE_URL}/get-session-details/${targetSessionId}`,
  //         null,
  //         {
  //           headers: {
  //             Accept: "application/json",
  //             Authorization: `Bearer ${token}`,
  //             "Content-Type": "application/json",
  //           },
  //         }
  //       );

  //       console.log("Session details:", refreshResponse.data);

  //       if (refreshResponse.data?.success && refreshResponse.data?.data) {
  //         setSessionData(refreshResponse.data.data);
  //       }
  //     } else {
  //       // ==========================================
  //       // API VALIDATION ERROR
  //       // ==========================================
  //       let errMsg = responseData?.message || "Failed to upload document.";

  //       if (responseData?.data && typeof responseData.data === "object") {
  //         const errList: string[] = [];

  //         Object.values(responseData.data).forEach((val: any) => {
  //           if (Array.isArray(val)) {
  //             errList.push(...val);
  //           } else if (typeof val === "string") {
  //             errList.push(val);
  //           }
  //         });

  //         if (errList.length > 0) {
  //           errMsg = errList.join(" ");
  //         }
  //       }

  //       toast.error(errMsg);
  //     }
  //   } catch (err: any) {
  //     console.error("Error uploading document:", err);

  //     console.error("Status:", err?.response?.status);

  //     console.error("Response:", err?.response?.data);

  //     let errMsg =
  //       err?.response?.data?.message ||
  //       err?.message ||
  //       "Error uploading document";

  //     const errorData = err?.response?.data?.data;

  //     if (errorData && typeof errorData === "object") {
  //       const errList: string[] = [];

  //       Object.values(errorData).forEach((val: any) => {
  //         if (Array.isArray(val)) {
  //           errList.push(...val);
  //         } else if (typeof val === "string") {
  //           errList.push(val);
  //         }
  //       });

  //       if (errList.length > 0) {
  //         errMsg = errList.join(" ");
  //       }
  //     }

  //     toast.error(errMsg);
  //   } finally {
  //     setUploadingDoc(false);

  //     // Reset file input
  //     if (e.target) {
  //       e.target.value = "";
  //     }
  //   }
  // };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetSessionId =
      session_id ||
      sessionData?.therapy_session_id ||
      sessionData?.id ||
      initialSessionData?.id;

    if (!targetSessionId) {
      toast.error("Session ID is missing");
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(targetSessionId));
      formData.append(
        "type",
        activeDocTab === "therapist" ? "therapist" : "patient"
      );
      formData.append("document", file);

      const response = await requestApi({
        endpoint: "upload-session-documents",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (
        response &&
        (response.success === true ||
          response.code === 200 ||
          response.status === true ||
          response.status === "success")
      ) {
        toast.success("Document uploaded successfully!");
        const refreshRes = await requestApi({
          endpoint: `get-session-details/${targetSessionId}`,
          method: "POST",
        });
        if (refreshRes?.success && refreshRes?.data) {
          setSessionData(refreshRes.data);
        }
      } else {
        let errMsg = response?.message || "Failed to upload document.";
        if (response?.data && typeof response.data === "object") {
          const errList: string[] = [];
          Object.values(response.data).forEach((val: any) => {
            if (Array.isArray(val)) {
              errList.push(...val);
            } else if (typeof val === "string") {
              errList.push(val);
            }
          });
          if (errList.length > 0) {
            errMsg = errList.join(" ");
          }
        }
        toast.error(errMsg);
      }
    } catch (err: any) {
      console.error("Error uploading document:", err);
      let errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Error uploading document";
      if (
        err?.response?.data?.data &&
        typeof err.response.data.data === "object"
      ) {
        const errList: string[] = [];
        Object.values(err.response.data.data).forEach((val: any) => {
          if (Array.isArray(val)) {
            errList.push(...val);
          } else if (typeof val === "string") {
            errList.push(val);
          }
        });
        if (errList.length > 0) {
          errMsg = errList.join(" ");
        }
      }
      toast.error(errMsg);
    } finally {
      setUploadingDoc(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSubmitNotes = async (type: "private" | "public") => {
    const notesText = type === "private" ? privateNotes : publicNotes;
    if (type === "private") setSavingPrivateNotes(true);
    else setSavingPublicNotes(true);

    try {
      const formData = new FormData();
      formData.append("session_id", String(session_id));
      formData.append("type", type);
      formData.append("notes", notesText);

      const response = await requestApi({
        endpoint: "submit-notes",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && response.success === true) {
        toast.success(
          `${
            type === "private" ? "Private" : "Public"
          } notes submitted successfully!`
        );
      } else {
        toast.error(response?.message || `Failed to submit ${type} notes.`);
      }
    } catch (err: any) {
      console.error(`Error submitting ${type} notes:`, err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          `Error submitting ${type} notes`
      );
    } finally {
      if (type === "private") setSavingPrivateNotes(false);
      else setSavingPublicNotes(false);
    }
  };

  const therapistDocs = getDocList(sessionData?.documents?.shared_by_therapist);
  const patientDocs = getDocList(sessionData?.documents?.shared_by_patient);

  return (
    <>
      <main className="gl-content-body">
        {loading && (
          <div className="p-3 text-center text-muted">
            Fetching session details...
          </div>
        )}
        <div className="patients-profile-wrp">
          <div className="dbt-pcard-top-nav">
            <Link href="/agenda" className="dbt-pcard-back-btn">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-chevron-left"
                viewBox="0 0 16 16"
              >
                <path
                  fillRule="evenodd"
                  d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"
                />
              </svg>
              Back to Agendas
            </Link>
            <div className="patient-nav-container">
              {!hide_button && (
                <>
                  {isOnline ? (
                    <>
                      {isStartedCall ? (
                        <>
                          <button
                            type="button"
                            className="patient-link-start-session"
                            disabled
                            style={{
                              opacity: 0.6,
                              cursor: "not-allowed",
                              backgroundColor: "#9e9e9e",
                              borderColor: "#9e9e9e",
                            }}
                          >
                            Start Session
                          </button>
                          <Link
                            href={startSessionUrl}
                            className="patient-link-cancel-session"
                            style={{
                              backgroundColor: "#28a745",
                              borderColor: "#28a745",
                              color: "#fff",
                            }}
                          >
                            Back To Video Call
                          </Link>
                        </>
                      ) : (
                        <Link
                          href={startSessionUrl}
                          className="patient-link-start-session"
                        >
                          Start Session
                        </Link>
                      )}

                      {canReschedule && (
                        <button
                          type="button"
                          className="patient-link-back-to-patients"
                          onClick={() => setShowRescheduleModal(true)}
                        >
                          <img src="images/reschedule.svg" alt="" />
                          Reschedule
                        </button>
                      )}

                      <button
                        type="button"
                        className="patient-link-cancel-session"
                        data-bs-toggle="modal"
                        data-bs-target="#cancelSessionModal"
                        style={{ background: "none" }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="patient-link-start-session"
                        onClick={handleStartSessionNotOnline}
                        style={
                          isStartedCall
                            ? { opacity: 0.6, cursor: "not-allowed" }
                            : {
                                backgroundColor: "#6c2b3b",
                                borderColor: "#6c2b3b",
                                color: "#fff",
                              }
                        }
                      >
                        Start Session
                      </button>

                      <button
                        type="button"
                        className="patient-link-start-session"
                        data-bs-toggle="modal"
                        data-bs-target="#endSessionModal"
                        style={{
                          backgroundColor: "#6c2b3b",
                          borderColor: "#6c2b3b",
                          color: "#fff",
                        }}
                      >
                        End Session
                      </button>

                      {canReschedule && (
                        <button
                          type="button"
                          className="patient-link-back-to-patients"
                          onClick={() => setShowRescheduleModal(true)}
                        >
                          <img src="images/reschedule.svg" alt="" />
                          Reschedule
                        </button>
                      )}

                      <button
                        type="button"
                        className="patient-link-cancel-session"
                        data-bs-toggle="modal"
                        data-bs-target="#cancelSessionModal"
                        style={{ background: "none" }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                        Cancel
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="dbt-pcard-container">
            <div className="dbt-pcard-section dbt-pcard-profile">
              <div className="dbt-pcard-avatar-wrapper">
                <img
                  src={
                    sessionData?.profile_image
                      ? sessionData.profile_image.startsWith("http")
                        ? sessionData.profile_image
                        : `${Base_image_url}${sessionData.profile_image}`
                      : "images/patientes-profile.svg"
                  }
                  alt={sessionData?.name || "Patient Profile"}
                  className="dbt-pcard-avatar-img"
                />
              </div>
              <div className="dbt-pcard-meta-main">
                <h2 className="dbt-pcard-name">
                  {sessionData?.name || "Ethan Walker Hall"}{" "}
                  <a href="#">
                    <img src="images/right-icon.svg" alt="" />
                  </a>
                </h2>
                <p className="dbt-pcard-age-gender">
                  Age {sessionData?.age ?? 36}{" "}
                  <span className="dbt-pcard-bullet">•</span>{" "}
                  {sessionData?.gender
                    ? sessionData.gender.charAt(0).toUpperCase() +
                      sessionData.gender.slice(1)
                    : "Male"}
                </p>
                <div className="dbt-pcard-ids">
                  <p>
                    Patient ID:{" "}
                    <span>
                      {sessionData?.patient_code ||
                        (sessionData?.patient_id
                          ? `PT-${sessionData.patient_id}`
                          : "PT-59")}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="dbt-pcard-section dbt-pcard-details">
              <div className="dbt-pcard-info-row">
                History No. -: {sessionData?.history_number ?? 11221153}
              </div>
              <div className="dbt-pcard-info-row">
                Session Type -:{" "}
                <span>{sessionData?.service_name || "Adult"}</span>
              </div>
              <div className="dbt-pcard-info-row">
                Session Price -:{" "}
                <span>
                  {formatCurrencyValue(sessionData?.session_price) ||
                    "$1730.00"}
                </span>
              </div>
              <div className="dbt-pcard-info-row">
                Services Added -:{" "}
                <span>
                  {sessionData?.service_name
                    ? `${sessionData.service_name}`
                    : "Adult"}
                </span>
              </div>
            </div>

            <div className="dbt-pcard-section dbt-pcard-session-last">
              <div className="dbt-pcard-info-row">
                Session Mode -:{" "}
                <a
                  href="#"
                  className="session-mode"
                  style={{ textTransform: "capitalize" }}
                >
                  <span></span>
                  {sessionData?.session_mode
                    ? formatStatus(sessionData.session_mode)
                    : "Online"}
                </a>
              </div>
              <div className="dbt-pcard-info-row">
                Date -:{" "}
                <span>
                  {formatDate(sessionData?.session_date) || "Aug 06, 2026"}
                </span>
              </div>
              <div className="dbt-pcard-info-row">
                Time -:{" "}
                <span>
                  {formatTimeRange(
                    sessionData?.session_start_time,
                    sessionData?.session_end_time
                  ) || "5:00 PM - 6:00 PM"}
                </span>
              </div>
            </div>
          </div>
          {!hide_button && sessionData?.session_mode !== "online" && (
            <div className="session-verify-card">
              <div className="session-verify-left">
                <div className="session-verify-icon-wrapper">
                  <img src="images/otp-login-icon.svg" alt="" />
                </div>
                <div className="session-verify-text-content">
                  <h2 className="session-verify-title">
                    Verify Patient to Start Session
                  </h2>
                  <p className="session-verify-subtitle">
                    Ask the patient for the verification code at the clinic.
                  </p>
                </div>
              </div>

              <div className="session-verify-right">
                <div className="session-code-inputs-container">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      className="session-code-field"
                      maxLength={1}
                      placeholder={(index + 1).toString()}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      required
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleVerify}
                  className="session-submit-btn"
                  id="btnVerifySession"
                  disabled={verifyingOtp}
                >
                  {verifyingOtp ? "Verifying..." : "Verify & Start Session"}
                </button>

                <p className="session-resend-text">
                  Didn’t receive code?{" "}
                  {resendTimer > 0 ? (
                    <span style={{ color: "#8c8c8c", fontWeight: 500 }}>
                      Resend in {resendTimer}s
                    </span>
                  ) : (
                    <span
                      className="session-resend-link"
                      id="lnkResendSessionCode"
                      onClick={handleResendVerificationCode}
                      style={{
                        cursor: isResendingCode ? "not-allowed" : "pointer",
                        opacity: isResendingCode ? 0.6 : 1,
                      }}
                    >
                      {isResendingCode ? "Resending..." : "Resend"}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="service-selection-card">
            <div className="container ps-sessions-page-container">
              <div
                className="accordion ps-sessions-accordion"
                id="accordionExample"
              >
                <div className="accordion-item">
                  <h2 className="accordion-header" id="headingOne">
                    <button
                      className="accordion-button"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target="#collapseOne"
                      aria-expanded="true"
                      aria-controls="collapseOne"
                    >
                      <div className="ps-sessions-header-main d-flex align-items-center">
                        <div className="ps-sessions-header-icon">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                            />
                          </svg>
                        </div>
                        <span className="ps-sessions-title">
                          Previous Sessions
                        </span>
                      </div>
                    </button>
                  </h2>

                  <div
                    id="collapseOne"
                    className="accordion-collapse collapse show"
                    aria-labelledby="headingOne"
                    data-bs-parent="#accordionExample"
                  >
                    <div className="accordion-body">
                      <div className="ps-sessions-search-wrapper">
                        <svg
                          className="ps-sessions-search-icon"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          ></path>
                        </svg>
                        <input
                          type="text"
                          className="ps-sessions-search-input"
                          placeholder="Search"
                          value={prevSessionSearch}
                          onChange={(e) => setPrevSessionSearch(e.target.value)}
                        />
                      </div>

                      <div className="ps-sessions-inner-box">
                        {(() => {
                          const listToRender =
                            Array.isArray(sessionData?.previous_sessions) &&
                            sessionData.previous_sessions.length > 0
                              ? sessionData.previous_sessions
                              : [
                                  {
                                    id: 1,
                                    name: "Session 1",
                                    date: "May 20, 2026",
                                    details: "Anxiety & work stress",
                                  },
                                  {
                                    id: 2,
                                    name: "Session 2",
                                    date: "May 22, 2026",
                                    details: "Anxiety & work stress",
                                  },
                                  {
                                    id: 3,
                                    name: "Session 3",
                                    date: "May 24, 2026",
                                    details: "Anxiety & work stress",
                                  },
                                  {
                                    id: 4,
                                    name: "Session 4",
                                    date: "May 26, 2026",
                                    details: "Anxiety & work stress",
                                  },
                                  {
                                    id: 5,
                                    name: "Session 5",
                                    date: "May 30, 2026",
                                    details: "Depression",
                                  },
                                ];

                          const filtered = listToRender.filter((item: any) => {
                            if (!prevSessionSearch.trim()) return true;
                            const query = prevSessionSearch.toLowerCase();
                            const itemDate =
                              item.session_date || item.date || "";
                            const itemDetails =
                              item.session_details || item.details || "";
                            const itemName = item.name || item.title || "";
                            return (
                              itemName.toLowerCase().includes(query) ||
                              itemDetails.toLowerCase().includes(query) ||
                              itemDate.toLowerCase().includes(query)
                            );
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="p-3 text-muted">
                                No sessions match your search.
                              </div>
                            );
                          }

                          return filtered.map((item: any, idx: number) => {
                            const rawDate = item.session_date || item.date;
                            const displayDate = rawDate
                              ? formatDate(rawDate)
                              : "";
                            const displayDetails =
                              item.session_details ||
                              item.details ||
                              "No details available";
                            const displayName =
                              item.name || item.title || `Session ${idx + 1}`;

                            return (
                              <div
                                className="ps-sessions-list-item"
                                key={item.id || idx}
                              >
                                <div className="ps-sessions-col-name">
                                  <span className="ps-sessions-dot"></span>{" "}
                                  {displayName}
                                </div>
                                <div className="ps-sessions-col-date">
                                  <svg
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    ></path>
                                  </svg>
                                  {displayDate || "N/A"}
                                </div>
                                <div className="ps-sessions-col-details">
                                  <span className="ps-sessions-muted-prefix">
                                    Session Details -:
                                  </span>{" "}
                                  {displayDetails}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="service-card-header choose">
              <div className="service-header-icon-wrapper">
                <img src="images/payment-profile-icon.svg" alt="" />
              </div>
              <div>
                <p>
                  Pre-filled information shared by the patient during booking.
                </p>
              </div>
            </div>

            <div
              className="patient-faqs-accordion"
              id="patientFaqsAccordionContainer"
            >
              {Array.isArray(sessionData?.patient_intake_details) &&
              sessionData.patient_intake_details.length > 0 ? (
                sessionData.patient_intake_details.map(
                  (item: any, idx: number) => (
                    <div className="patient-faqs-item" key={idx}>
                      <h2
                        className="patient-faqs-header"
                        id={`patientFaqsHeading${idx}`}
                      >
                        <button
                          className="patient-faqs-button collapsed"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#patientFaqsCollapse${idx}`}
                          aria-expanded="false"
                          aria-controls={`patientFaqsCollapse${idx}`}
                        >
                          {idx + 1}.{" "}
                          {item.question ||
                            item.title ||
                            item.label ||
                            `Question ${idx + 1}`}
                        </button>
                      </h2>
                      <div
                        id={`patientFaqsCollapse${idx}`}
                        className="accordion-collapse collapse"
                        aria-labelledby={`patientFaqsHeading${idx}`}
                        data-bs-parent="#patientFaqsAccordionContainer"
                      >
                        <div className="patient-faqs-body">
                          {typeof item.answer === "string"
                            ? item.answer
                            : item.response ||
                              item.value ||
                              JSON.stringify(item)}
                        </div>
                      </div>
                    </div>
                  )
                )
              ) : sessionData?.patient_intake_details &&
                typeof sessionData.patient_intake_details === "object" ? (
                Object.entries(sessionData.patient_intake_details).map(
                  ([key, val], idx) => (
                    <div className="patient-faqs-item" key={idx}>
                      <h2
                        className="patient-faqs-header"
                        id={`patientFaqsHeading${idx}`}
                      >
                        <button
                          className="patient-faqs-button collapsed"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#patientFaqsCollapse${idx}`}
                          aria-expanded="false"
                          aria-controls={`patientFaqsCollapse${idx}`}
                        >
                          {idx + 1}. {key}
                        </button>
                      </h2>
                      <div
                        id={`patientFaqsCollapse${idx}`}
                        className="accordion-collapse collapse"
                        aria-labelledby={`patientFaqsHeading${idx}`}
                        data-bs-parent="#patientFaqsAccordionContainer"
                      >
                        <div className="patient-faqs-body">
                          {typeof val === "string" ? val : JSON.stringify(val)}
                        </div>
                      </div>
                    </div>
                  )
                )
              ) : (
                <div className="p-3 text-muted">
                  {sessionData?.patient_intake_details
                    ? String(sessionData.patient_intake_details)
                    : "No intake information shared by patient for this session."}
                </div>
              )}
            </div>
          </div>

          <div className="ony-summary-v2-main-container">
            <div className="ony-summary-v2-ai-section">
              <div className="ony-summary-v2-header-wrapper">
                <div className="ony-summary-v2-icon-circle-maroon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8zm-7 14.5l1.8-1.8m11.4-9.4l1.8-1.8M4.2 7.2l1.8 1.8m10.4 7.6l1.8 1.8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>
                <h3 className="ony-summary-v2-main-title">
                  Patient's Ony AI Summary
                </h3>
              </div>

              <div className="ony-summary-v2-content-card">
                {sessionData?.ai_summary ? (
                  typeof sessionData.ai_summary === "string" ? (
                    <p className="p-3 mb-0">{sessionData.ai_summary}</p>
                  ) : Array.isArray(sessionData.ai_summary) ? (
                    <ul className="ony-summary-v2-bullet-list">
                      {sessionData.ai_summary.map((item: any, idx: number) => (
                        <li key={idx}>
                          <strong>
                            {item.title || item.heading || `Point ${idx + 1}`}
                          </strong>
                          <p>
                            {typeof item === "string"
                              ? item
                              : item.description || item.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-3 mb-0">
                      {JSON.stringify(sessionData.ai_summary)}
                    </p>
                  )
                ) : (
                  <div className="p-3 text-muted">
                    No Ony AI summary available for this session.
                  </div>
                )}
              </div>
            </div>

            <div className="ony-summary-v2-service-section">
              <div className="ony-summary-v2-header-wrapper">
                <div className="ony-summary-v2-icon-circle-maroon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3 className="ony-summary-v2-main-title">
                  Choose a applicable service for Patient
                </h3>
              </div>

              <hr className="ony-summary-v2-divider" />

              {/* Horizontal List of Added Services */}
              <div
                className="mb-3"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ fontSize: "13px", fontWeight: 600, color: "#666" }}
                >
                  Added Services:
                </span>
                {Array.isArray(sessionData?.additional_services) &&
                sessionData.additional_services.length > 0 ? (
                  sessionData.additional_services.map(
                    (srv: any, idx: number) => (
                      <div
                        key={srv.id || idx}
                        className="ony-summary-v2-selected-tag"
                        style={{ margin: 0 }}
                      >
                        <span className="ony-summary-v2-tag-text">
                          {srv.service_name || srv.name}{" "}
                          {srv.service_price ? `($${srv.service_price})` : ""}
                        </span>
                      </div>
                    )
                  )
                ) : (
                  <span style={{ fontSize: "13px", color: "#888" }}>
                    {sessionData?.service_name || "None"}
                  </span>
                )}
              </div>

              <div className="ony-summary-v2-input-block">
                <label className="ony-summary-v2-field-label">
                  Service Name*
                </label>

                <div
                  className="ony-summary-v2-select-box-wrapper"
                  style={{ position: "relative", cursor: "pointer" }}
                  onClick={() =>
                    setIsServiceDropdownOpen(!isServiceDropdownOpen)
                  }
                >
                  <div className="ony-summary-v2-selected-tag">
                    <span className="ony-summary-v2-tag-text">
                      {(() => {
                        const selectedService = serviceList.find(
                          (s) => String(s.id) === String(selectedServiceId)
                        );
                        if (selectedService?.name) {
                          return selectedService.name;
                        }
                        return "Select Service to Add";
                      })()}
                    </span>
                    {selectedServiceId && (
                      <button
                        type="button"
                        className="ony-summary-v2-tag-close-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedServiceId("");
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="ony-summary-v2-dropdown-arrow">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path d="M7 10l5 5 5-5H7z" fill="currentColor" />
                    </svg>
                  </div>

                  {isServiceDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        backgroundColor: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        zIndex: 100,
                        maxHeight: "200px",
                        overflowY: "auto",
                        marginTop: "4px",
                      }}
                    >
                      {availableDropdownServices.length > 0 ? (
                        availableDropdownServices.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              padding: "10px 14px",
                              cursor: "pointer",
                              fontSize: "14px",
                              borderBottom: "1px solid #eee",
                              backgroundColor:
                                String(item.id) === String(selectedServiceId)
                                  ? "#f0f4f8"
                                  : "#fff",
                              color: "#333",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectService(item);
                            }}
                          >
                            {item.name}
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            padding: "10px 14px",
                            fontSize: "13px",
                            color: "#888",
                          }}
                        >
                          All available services added
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="ony-dashboard-wrapper">
            <div className="ony-dashboard-col-left">
              <div className="ps-part1-section-block">
                <div className="ps-part1-block-header">
                  <div className="ps-part1-header-main">
                    <div className="ps-part1-icon-circle ps-part1-bg-maroon">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <span className="ps-part1-title">
                      AI Summary{" "}
                      <span className="ps-part1-subtext">(Post-session)</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="edit-icon-patients"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (!isEditingAiSummary) {
                        const currentVal =
                          typeof sessionData?.post_session_ai_summary ===
                          "string"
                            ? sessionData.post_session_ai_summary
                            : sessionData?.post_session_ai_summary
                            ? JSON.stringify(
                                sessionData.post_session_ai_summary
                              )
                            : "";
                        setAiSummaryText(currentVal);
                      }
                      setIsEditingAiSummary(!isEditingAiSummary);
                    }}
                  >
                    <img src="images/edit-icon.svg" alt="" />
                    {isEditingAiSummary ? "Cancel" : "Edit"}
                  </button>
                </div>

                <div className="ps-part1-card-body ps-part1-bg-grey-tint ps-part1-flex-center">
                  <div
                    className="ps-part1-card-body ps-part1-bg-grey-tint"
                    style={{ width: "100%" }}
                  >
                    <div className="ps-part1-summary-card">
                      {isEditingAiSummary ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <textarea
                            className="form-control"
                            rows={4}
                            value={aiSummaryText}
                            onChange={(e) => setAiSummaryText(e.target.value)}
                            placeholder="Enter AI Summary..."
                            style={{
                              borderRadius: "8px",
                              borderColor: "#d9d9d9",
                              fontSize: "14px",
                              padding: "10px",
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: "8px",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => setIsEditingAiSummary(false)}
                              disabled={isSavingAiSummary}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                backgroundColor: "#6e4e5b",
                                color: "#ffffff",
                              }}
                              onClick={handleSaveAiSummary}
                              disabled={isSavingAiSummary}
                            >
                              {isSavingAiSummary ? "Saving..." : "Save Summary"}
                            </button>
                          </div>
                        </div>
                      ) : sessionData?.post_session_ai_summary ? (
                        typeof sessionData.post_session_ai_summary ===
                        "string" ? (
                          <>
                            <h3 className="ps-part1-section-title">
                              Session Overview
                            </h3>
                            <p className="ps-part1-paragraph">
                              {sessionData.post_session_ai_summary}
                            </p>
                          </>
                        ) : (
                          <div className="ps-part1-paragraph">
                            {JSON.stringify(
                              sessionData.post_session_ai_summary
                            )}
                          </div>
                        )
                      ) : (
                        <p className="ps-part1-paragraph text-muted mb-0">
                          No post-session AI summary generated yet for this
                          session.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ps-part2-section-block">
                <div className="ps-part2-block-header">
                  <div className="ps-part2-header-main">
                    <div className="ps-part2-icon-circle ps-part2-bg-maroon">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <span className="ps-part2-title">
                      Documents & Attachments
                    </span>
                  </div>
                </div>

                <div className="ps-part2-tabs-row">
                  <button
                    type="button"
                    className={`ps-part2-tab ${
                      activeDocTab === "therapist" ? "ps-part2-tab-active" : ""
                    }`}
                    onClick={() => setActiveDocTab("therapist")}
                  >
                    Shared by you{" "}
                    <span className="ps-part2-tab-count">
                      {therapistDocs.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`ps-part2-tab ${
                      activeDocTab === "patient" ? "ps-part2-tab-active" : ""
                    }`}
                    onClick={() => setActiveDocTab("patient")}
                  >
                    Shared by Patient{" "}
                    <span className="ps-part2-tab-count">
                      {patientDocs.length}
                    </span>
                  </button>
                </div>

                <div className="ps-part2-attachment-stack">
                  {activeDocTab === "therapist" ? (
                    therapistDocs.length > 0 ? (
                      therapistDocs.map((doc: any, idx: number) => (
                        <div className="ps-part2-doc-row" key={doc.id || idx}>
                          <div className="ps-part2-doc-left">
                            <div className="ps-part2-pdf-icon-box">
                              <span className="ps-part2-pdf-text">
                                {doc.file_type || doc.ext || "PDF"}
                              </span>
                            </div>
                            <div className="ps-part2-doc-meta">
                              <span className="ps-part2-doc-name">
                                {doc.file_name ||
                                  doc.name ||
                                  `Document_${idx + 1}`}
                              </span>
                              <span className="ps-part2-doc-date">
                                Uploaded on{" "}
                                {formatDate(
                                  doc.created_at || sessionData?.session_date
                                )}
                              </span>
                            </div>
                          </div>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ps-part2-view-link"
                            >
                              <span>View</span>
                            </a>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-muted">
                        No documents shared by you yet.
                      </div>
                    )
                  ) : patientDocs.length > 0 ? (
                    patientDocs.map((doc: any, idx: number) => (
                      <div className="ps-part2-doc-row" key={doc.id || idx}>
                        <div className="ps-part2-doc-left">
                          <div className="ps-part2-pdf-icon-box">
                            <span className="ps-part2-pdf-text">
                              {doc.file_type || doc.ext || "PDF"}
                            </span>
                          </div>
                          <div className="ps-part2-doc-meta">
                            <span className="ps-part2-doc-name">
                              {doc.file_name ||
                                doc.name ||
                                `Document_${idx + 1}`}
                            </span>
                            <span className="ps-part2-doc-date">
                              Uploaded on{" "}
                              {formatDate(
                                doc.created_at || sessionData?.session_date
                              )}
                            </span>
                          </div>
                        </div>
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ps-part2-view-link"
                          >
                            <span>View</span>
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-muted">
                      No documents shared by patient yet.
                    </div>
                  )}

                  {activeDocTab === "therapist" && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                      />

                      <div
                        className="ps-part2-upload-zone"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ cursor: "pointer" }}
                      >
                        <svg
                          className="ps-part2-upload-icon"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
                            fill="currentColor"
                          />
                        </svg>
                        <span className="ps-part2-upload-text">
                          {uploadingDoc
                            ? "Uploading Document..."
                            : "Upload Document"}
                        </span>
                        <span className="ps-part2-upload-hint">
                          Allowed: PDF, DOC, DOCX, JPG, PNG (Max. 10MB)
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="ony-dashboard-col-right">
              <div className="ps-part3-wrapper">
                <div className="ps-part3-section-block">
                  <div className="ps-part3-block-header">
                    <div className="ps-part3-header-main">
                      <div className="ps-part3-icon-circle ps-part3-bg-maroon">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925-3.546 5.974 5.974 0 0 0-2.133-1A3.75 3.75 0 0 0 4.5 9a3.75 3.75 0 0 0 .545 1.956 5.973 5.973 0 0 0-.27 1.411 3.75 3.75 0 0 0 5.225 3.738A3.75 3.75 0 0 0 12 18Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 18a3.75 3.75 0 0 1-.495-7.467 5.99 5.99 0 0 1 1.925-3.546 5.974 5.974 0 0 1 2.133-1A3.75 3.75 0 0 1 19.5 9a3.75 3.75 0 0 1-.545 1.956 5.973 5.973 0 0 1 .27 1.411 3.75 3.75 0 0 1-5.225 3.738A3.75 3.75 0 0 1 12 18Z"
                          />
                        </svg>
                      </div>
                      <span className="ps-part3-title">
                        Parent Consent Required
                      </span>
                    </div>
                  </div>

                  <div className="ps-part3-inner-content-card">
                    <p className="ps-part3-content-label">Consent Status</p>

                    <div className="ps-part3-status-badge">
                      <span className="ps-part3-badge-dot"></span>
                      {sessionData?.consent_status ||
                        "Consent form not sent yet"}
                    </div>

                    <p className="ps-part3-content-label">Action Required</p>
                    <p className="ps-part3-description">
                      Send parent/guardian consent form and collect digital
                      signature
                    </p>
                  </div>

                  <button className="ps-part3-action-btn">
                    Send Parent Consent Form
                  </button>

                  <div className="ps-part3-footer-info">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>
                      You will be notified once the consent is completed
                    </span>
                  </div>
                </div>

                <div className="ps-part3-section-block">
                  <div className="ps-part3-block-header">
                    <div className="ps-part3-header-main">
                      <div className="ps-part3-icon-circle ps-part3-bg-maroon">
                        <svg viewBox="0 0 24 24">
                          <path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <span className="ps-part3-title">
                        Private Notes{" "}
                        <span className="ps-part3-subtext">(Only you)</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="edit-icon-patients btn btn-link p-0 border-0 text-decoration-none"
                      onClick={() => handleSubmitNotes("private")}
                      disabled={savingPrivateNotes}
                    >
                      <img src="images/edit-icon.svg" alt="" />
                      {savingPrivateNotes ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <div className="ps-part3-textarea-container">
                    <textarea
                      placeholder="Write notes that you want to keep private..."
                      className="ps-part3-input-field"
                      value={privateNotes}
                      onChange={(e) => setPrivateNotes(e.target.value)}
                    />
                    <div className="ps-part3-corner-icon ps-part3-color-maroon">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ps-part3-section-block">
                <div className="ps-part3-block-header">
                  <div className="ps-part3-header-main">
                    <div className="ps-part3-icon-circle ps-part3-bg-maroon">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <span className="ps-part3-title">
                      Public Notes{" "}
                      <span className="ps-part3-subtext">
                        (To share with the patient)
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="edit-icon-patients btn btn-link p-0 border-0 text-decoration-none"
                    onClick={() => handleSubmitNotes("public")}
                    disabled={savingPublicNotes}
                  >
                    <img src="images/edit-icon.svg" alt="" />
                    {savingPublicNotes ? "Saving..." : "Save"}
                  </button>
                </div>
                <div className="ps-part3-textarea-container">
                  <textarea
                    placeholder="Write notes that you want to share with the patient after the session...&#10;(These notes will be visible to patient.)"
                    className="ps-part3-input-field"
                    value={publicNotes}
                    onChange={(e) => setPublicNotes(e.target.value)}
                  />
                  <div className="ps-part3-corner-icon ps-part3-color-maroon">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="ps-part4-section-block">
                <div className="ps-part4-block-header">
                  <div className="ps-part4-header-main">
                    <div className="ps-part4-icon-circle ps-part4-bg-maroon">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <span className="ps-part4-title">Tasks & Next Steps</span>
                    <button
                      type="button"
                      className="ps-part4-add-btn"
                      aria-label="Add Task"
                      onClick={handleOpenTaskModal}
                    >
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="ps-part4-list-box ps-part4-bg-grey-tint">
                  {taskList && taskList.length > 0 ? (
                    taskList.map((taskItem: any, idx: number) => (
                      <div className="ps-part4-row" key={taskItem.id || idx}>
                        <div className="ps-part4-row-left">
                          <label className="ps-part4-checkbox-wrapper">
                            <input
                              type="checkbox"
                              checked={!!taskItem.status}
                              onChange={() => {
                                setTaskList((prev) =>
                                  prev.map((t, i) =>
                                    (t.id ? t.id === taskItem.id : i === idx)
                                      ? { ...t, status: !t.status }
                                      : t
                                  )
                                );
                              }}
                            />
                            <span className="ps-part4-checkmark"></span>
                          </label>
                          <span
                            className="ps-part4-desc"
                            style={{
                              textDecoration: taskItem.status
                                ? "line-through"
                                : "none",
                            }}
                          >
                            {taskItem.task || taskItem.title || taskItem.name}
                          </span>
                        </div>
                        <span className="ps-part4-date">
                          {formatDate(
                            taskItem.date || sessionData?.session_date
                          ) || "Aug 06, 2026"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-muted">No tasks assigned.</div>
                  )}
                </div>
              </div>

              <div className="ps-part4-section-block">
                <div className="ps-part4-block-header">
                  <div className="ps-part4-header-main">
                    <div className="ps-part4-icon-circle ps-part4-bg-maroon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925-3.546 5.974 5.974 0 0 0-2.133-1A3.75 3.75 0 0 0 4.5 9a3.75 3.75 0 0 0 .545 1.956 5.973 5.973 0 0 0-.27 1.411 3.75 3.75 0 0 0 5.225 3.738A3.75 3.75 0 0 0 12 18Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 18a3.75 3.75 0 0 1-.495-7.467 5.99 5.99 0 0 1 1.925-3.546 5.974 5.974 0 0 1 2.133-1A3.75 3.75 0 0 1 19.5 9a3.75 3.75 0 0 1-.545 1.956 5.973 5.973 0 0 1 .27 1.411 3.75 3.75 0 0 1-5.225 3.738A3.75 3.75 0 0 1 12 18Z"
                        />
                      </svg>
                    </div>
                    <span className="ps-part4-title">Patient Reflection</span>
                  </div>
                </div>

                <div className="ps-part4-content-group">
                  <h4 className="ps-part4-section-subtitle">
                    Mood after session
                  </h4>
                  <div className="ps-part4-mood-container">
                    <span className="ps-part4-emoji-wrapper">
                      {sessionData?.patient_reflection?.emoji ||
                        sessionData?.emoji ||
                        "😆"}
                    </span>
                    <span className="ps-part4-mood-status">
                      {sessionData?.patient_reflection?.mood ||
                        sessionData?.mood ||
                        "Great"}
                    </span>
                  </div>
                  <p className="ps-part4-reflection-text">
                    {sessionData?.patient_reflection?.text ||
                      sessionData?.patient_reflection?.comment ||
                      sessionData?.reflection ||
                      "I feel lighter after talking things through. It helped me clear my thoughts a bit."}
                  </p>
                </div>

                <hr className="ps-part4-divider" />

                <div className="ps-part4-content-group">
                  <h4 className="ps-part4-section-subtitle">
                    Patient Feedback
                  </h4>

                  <div className="ps-part4-rating-stars">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const ratingVal =
                        sessionData?.patient_feedback?.rating ||
                        sessionData?.feedback?.rating ||
                        sessionData?.rating ||
                        4;
                      return (
                        <svg
                          key={index}
                          className="ps-part4-star"
                          viewBox="0 0 24 24"
                          fill={index < ratingVal ? "#F5C443" : "#E2E8F0"}
                        >
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      );
                    })}
                  </div>

                  <p className="ps-part4-reflection-text">
                    {typeof sessionData?.feedback === "string"
                      ? sessionData.feedback
                      : sessionData?.patient_feedback?.text ||
                        sessionData?.patient_feedback?.comment ||
                        sessionData?.feedback?.comment ||
                        sessionData?.feedback?.text ||
                        "The session was really helpful. I liked how the therapist guided me through techniques. I'd like to explore more coping strategies next time."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pfd-wrapper-page">
            <div className="pfd-main-container">
              <div className="pfd-card-wrapper">
                <div className="pfd-card-header">
                  <div className="pfd-icon-circle">
                    <svg
                      className="pfd-icon-svg"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                      />
                    </svg>
                  </div>
                  <h2 className="pfd-header-title">
                    Payment & Financial Details
                  </h2>
                </div>

                <div className="pfd-card-body">
                  <div className="pfd-data-row">
                    <span className="pfd-label-main">Session Type Price</span>
                    <span className="pfd-value-text">
                      {formatCurrencyValue(
                        (Array.isArray(sessionData?.payment_details)
                          ? sessionData.payment_details[0]?.session_amount
                          : sessionData?.payment_details?.session_amount) ||
                          sessionData?.session_price
                      )}{" "}
                      (
                      {formatStatus(
                        (Array.isArray(sessionData?.payment_details)
                          ? sessionData.payment_details[0]
                              ?.session_payment_status
                          : sessionData?.payment_details
                              ?.session_payment_status) ||
                          sessionData?.session_status
                      )}
                      )
                    </span>
                  </div>

                  <div className="pfd-data-row">
                    <span className="pfd-label-main">Payment Method</span>
                    <span className="pfd-value-text">
                      {(Array.isArray(sessionData?.payment_details)
                        ? sessionData.payment_details[0]?.payment_method
                        : sessionData?.payment_details?.payment_method) ||
                        sessionData?.payment_method ||
                        "Paypal"}
                    </span>
                  </div>

                  <div className="pfd-data-row-align-start">
                    <div className="pfd-text-column">
                      <span className="pfd-label-main">Service Added</span>
                      {(() => {
                        const pDetails = Array.isArray(
                          sessionData?.payment_details
                        )
                          ? sessionData.payment_details[0]
                          : sessionData?.payment_details;
                        const addServices =
                          pDetails?.additional_services &&
                          Array.isArray(pDetails.additional_services) &&
                          pDetails.additional_services.length > 0
                            ? pDetails.additional_services
                            : Array.isArray(sessionData?.additional_services) &&
                              sessionData.additional_services.length > 0
                            ? sessionData.additional_services
                            : [];

                        if (addServices.length > 0) {
                          return addServices.map((srv: any, idx: number) => (
                            <span
                              key={srv.id || srv.service_id || idx}
                              className="pfd-label-sub"
                              style={{ display: "block" }}
                            >
                              -1st {srv.service_name || srv.name} Session
                            </span>
                          ));
                        }

                        return (
                          <span className="pfd-label-sub">
                            -1st {sessionData?.service_name || "Adult"} Session
                          </span>
                        );
                      })()}
                    </div>
                    <div
                      className="pfd-value-column"
                      style={{ textAlign: "right" }}
                    >
                      {(() => {
                        const pDetails = Array.isArray(
                          sessionData?.payment_details
                        )
                          ? sessionData.payment_details[0]
                          : sessionData?.payment_details;
                        const addServices =
                          pDetails?.additional_services &&
                          Array.isArray(pDetails.additional_services) &&
                          pDetails.additional_services.length > 0
                            ? pDetails.additional_services
                            : Array.isArray(sessionData?.additional_services) &&
                              sessionData.additional_services.length > 0
                            ? sessionData.additional_services
                            : [];

                        if (addServices.length > 0) {
                          return addServices.map((srv: any, idx: number) => (
                            <span
                              key={srv.id || srv.service_id || idx}
                              className="pfd-value-text"
                              style={{ display: "block" }}
                            >
                              +
                              {formatCurrencyValue(
                                srv.service_price || srv.price || 0
                              )}
                            </span>
                          ));
                        }

                        return <span className="pfd-value-text">+$50.00</span>;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const pDetails = Array.isArray(sessionData?.payment_details)
                  ? sessionData.payment_details[0]
                  : sessionData?.payment_details;

                const isAdditionalPaymentRequested = Boolean(
                  pDetails?.additional_payment_requested ??
                    sessionData?.additional_payment_requested
                );

                const isDisabled =
                  isAdditionalPaymentRequested || isRequestingPayment;

                return (
                  <div className="pfd-btn-area">
                    <button
                      type="button"
                      className="pfd-action-trigger"
                      disabled={isDisabled}
                      onClick={handleRequestAdditionalPayment}
                      style={
                        isDisabled
                          ? {
                              opacity: 0.6,
                              cursor: "not-allowed",
                              backgroundColor: "#8c7b83",
                            }
                          : undefined
                      }
                    >
                      {isRequestingPayment
                        ? "Sending Request..."
                        : isAdditionalPaymentRequested
                        ? "Payment Requested"
                        : "Request Additional Payment"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </main>

      {showTaskModal && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold text-dark fs-5">
                  Add Task & Next Step
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseTaskModal}
                  aria-label="Close"
                ></button>
              </div>
              <form onSubmit={handleSaveTask}>
                <div className="modal-body py-3">
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-secondary small">
                      Task Details
                    </label>
                    <textarea
                      className="form-control rounded-3"
                      rows={3}
                      placeholder="Enter task details..."
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0">
                  <button
                    type="button"
                    className="btn btn-light px-4 py-2 rounded-3 fw-medium"
                    onClick={handleCloseTaskModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white px-4 py-2 rounded-3 fw-medium"
                    style={{
                      backgroundColor: "#800020",
                      borderColor: "#800020",
                    }}
                    disabled={isSavingTask}
                  >
                    {isSavingTask ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <CancelSessionPopup sessionId={session_id} sessionData={sessionData} />
      <AgendaCalendarPopup
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        sessionId={session_id}
        isReschedule={true}
      />
      <EndSession
        sessionId={session_id || undefined}
        onConfirmEnd={() => fetchSessionDetails()}
      />
    </>
  );
};

const FinalAgenda: React.FC<FinalAgendaProps> = (props) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FinalAgendaContent {...props} />
    </Suspense>
  );
};

export default FinalAgenda;
