"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import CancelSessionPopup from "@/src/component/CancelSessionPopup";
import AgendaCalendarPopup from "@/src/component/AgendaCalendarPopup";
import { Base_image_url } from "@/src/config";
import { requestApi } from "@/src/utils/api";

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
  if (val === undefined || val === null || val === "") return "$0.00";
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

const getFullImgUrl = (imgRelPath?: string, fallback: string = "/images/header-user-right-profile.svg") => {
  if (!imgRelPath) return fallback;
  const trimmed = String(imgRelPath).trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `${Base_image_url.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
};

const getFullPaymentAmount = (
  total: number,
  remaining: number,
  isFirstTime: boolean,
  bonus: boolean
) => {
  if (remaining <= 0) return "0.00";
  if (isFirstTime) {
    // 10% discount on first-time full payment if bonus is applied
    const finalVal = bonus ? total * 0.9 : total;
    return finalVal.toFixed(2);
  } else {
    // Remaining payment after partial payment -> NO 10% discount
    return remaining.toFixed(2);
  }
};

const BackToAgendaContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [serviceList, setServiceList] = useState<{ id: any; name: string }[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | number>("");
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [prevSessionSearch, setPrevSessionSearch] = useState<string>("");

  const session_id = searchParams.get("therapy_session_id");

  // Payment form states
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [paymentType, setPaymentType] = useState<string>("full_payment");
  const [amount, setAmount] = useState<string>("");
  const [isBonusApplied, setIsBonusApplied] = useState<boolean>(false);
  const [isCollectingPayment, setIsCollectingPayment] = useState<boolean>(false);
  const [showAmountError, setShowAmountError] = useState<boolean>(false);

  const startSessionUrl = session_id
    ? `/back-to-calendar?therapy_session_id=${session_id}`
    : "/agenda";

  // Added service identifiers set
  const addedServiceIdentifiers = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(sessionData?.additional_services)) {
      sessionData.additional_services.forEach((item: any) => {
        if (item.id !== undefined && item.id !== null) set.add(String(item.id).toLowerCase());
        if (item.service_id !== undefined && item.service_id !== null) set.add(String(item.service_id).toLowerCase());
        if (item.service_name) set.add(String(item.service_name).toLowerCase().trim());
        if (item.name) set.add(String(item.name).toLowerCase().trim());
      });
    }
    return set;
  }, [sessionData?.additional_services]);

  // Available dropdown services
  const availableDropdownServices = useMemo(() => {
    return serviceList.filter((item) => {
      const itemId = String(item.id).toLowerCase();
      const itemName = String(item.name || "").toLowerCase().trim();
      return !addedServiceIdentifiers.has(itemId) && !addedServiceIdentifiers.has(itemName);
    });
  }, [serviceList, addedServiceIdentifiers]);

  // Fetch session details callback
  const fetchSessionDetails = useCallback(async () => {
    if (!session_id) return;
    setLoading(true);
    try {
      const response = await requestApi({
        endpoint: `get-session-details/${session_id}`,
        method: "POST",
      });
      if (response && response.success === true && response.data) {
        setSessionData(response.data);
      } else if (response && response.success === false) {
        toast.error(response.message || "Failed to fetch session details.");
      }
    } catch (err) {
      console.error("Error fetching session details in BackToAgenda:", err);
    } finally {
      setLoading(false);
    }
  }, [session_id]);

  // Fetch available services (session types)
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
        console.error("Error fetching session types in BackToAgenda:", err);
      }
    };

    fetchServices();
  }, []);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  // Handle service selection and API call to add service
  const handleSelectService = async (service: any) => {
    setSelectedServiceId(service.id);
    setIsServiceDropdownOpen(false);

    if (!session_id) {
      toast.error("Session ID not found.");
      return;
    }

    try {
      toast.loading("Adding service...", { id: "add-service" });
      const formData = new FormData();
      formData.append("therapy_session_id", String(session_id));
      formData.append("service_id", String(service.id));

      const response = await requestApi({
        endpoint: "add-session-additional-services",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      toast.dismiss("add-service");
      if (response && (response.success === true || response.code === 200)) {
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

  // Calculate totals
  const baseSessionPriceNum = parseFloat(sessionData?.session_price || "0") || 0;
  const additionalServicesList = Array.isArray(sessionData?.additional_services)
    ? sessionData.additional_services
    : [];

  const additionalServicesTotal = additionalServicesList.reduce((acc: number, srv: any) => {
    const p = parseFloat(srv.service_price || srv.price || "0") || 0;
    return acc + p;
  }, 0);

  const totalSessionAmountNum = baseSessionPriceNum + additionalServicesTotal;
  const formattedTotalAmount = `$${totalSessionAmountNum.toFixed(2)}`;

  // Process clinic_payment_details
  const clinicPaymentList = Array.isArray(sessionData?.clinic_payment_details)
    ? sessionData.clinic_payment_details
    : [];

  const totalPaidSoFar = clinicPaymentList.reduce((acc: number, p: any) => {
    return acc + (parseFloat(p.amount || "0") || 0);
  }, 0);

  const isFirstTimePayment = totalPaidSoFar === 0;
  const remainingAmountNum = Math.max(0, totalSessionAmountNum - totalPaidSoFar);
  const formattedRemainingAmount = `$${remainingAmountNum.toFixed(2)}`;

  // Automatically sync amount based on payment type, bonus, and remaining amount
  useEffect(() => {
    if (paymentType === "full_payment") {
      setAmount(
        getFullPaymentAmount(
          totalSessionAmountNum,
          remainingAmountNum,
          isFirstTimePayment,
          isBonusApplied
        )
      );
    } else if (paymentType === "pay_later") {
      setAmount("0");
    }
  }, [
    paymentType,
    totalSessionAmountNum,
    remainingAmountNum,
    isFirstTimePayment,
    isBonusApplied,
  ]);

  const handlePaymentTypeChange = (type: string) => {
    setPaymentType(type);
    setShowAmountError(false);
    if (type === "full_payment") {
      if (isFirstTimePayment) {
        setIsBonusApplied(true);
        setAmount(
          getFullPaymentAmount(
            totalSessionAmountNum,
            remainingAmountNum,
            true,
            true
          )
        );
      } else {
        setIsBonusApplied(false);
        setAmount(
          getFullPaymentAmount(
            totalSessionAmountNum,
            remainingAmountNum,
            false,
            false
          )
        );
      }
    } else if (type === "pay_later") {
      setAmount("0");
    } else if (type === "partial_payment") {
      if (
        !amount ||
        amount === String(totalSessionAmountNum) ||
        amount ===
          getFullPaymentAmount(
            totalSessionAmountNum,
            remainingAmountNum,
            true,
            true
          ) ||
        amount ===
          getFullPaymentAmount(
            totalSessionAmountNum,
            remainingAmountNum,
            false,
            false
          ) ||
        amount === "0"
      ) {
        setAmount("");
      }
    }
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (val.trim() !== "") {
      setShowAmountError(false);
    }
  };

  // Submit collected payment
  const handleCollectPayment = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    const effectiveSessionId = session_id || sessionData?.id || sessionData?.therapy_session_id;

    if (!effectiveSessionId) {
      toast.error("Session ID not found.");
      return;
    }

    if (paymentType === "partial_payment") {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        setShowAmountError(true);
        toast.error("Please enter a valid partial payment amount.");
        return;
      }
    }

    setShowAmountError(false);

    if (paymentType === "full_payment" && (!amount || parseFloat(amount) <= 0)) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    setIsCollectingPayment(true);
    try {
      const formData = new FormData();
      formData.append("therapy_session_id", String(effectiveSessionId));
      formData.append("payment_mode", paymentMode);
      formData.append("payment_type", paymentType);
      formData.append("amount", amount || "0");
      formData.append("is_bonus_applied", isBonusApplied ? "1" : "0");

      const response = await requestApi({
        endpoint: "collect-clinic-session-payment",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && (response.success === true || response.code === 200)) {
        toast.success(response.message || "Payment collected successfully.");
        await fetchSessionDetails();
      } else {
        toast.error(response?.message || "Failed to collect payment.");
      }
    } catch (err: any) {
      console.error("Error collecting payment:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Error collecting payment"
      );
    } finally {
      setIsCollectingPayment(false);
    }
  };

  // Filter previous sessions
  const previousSessionsList = Array.isArray(sessionData?.previous_sessions)
    ? sessionData.previous_sessions
    : [];

  const filteredPreviousSessions = previousSessionsList.filter((item: any) => {
    if (!prevSessionSearch.trim()) return true;
    const query = prevSessionSearch.toLowerCase();
    const itemDate = item.session_date || item.date || "";
    const itemDetails = item.session_details || item.details || "";
    const itemName = item.name || item.title || "";
    return (
      itemName.toLowerCase().includes(query) ||
      itemDetails.toLowerCase().includes(query) ||
      itemDate.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <main className="gl-content-body">
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
              <Link href={startSessionUrl} className="patient-link-start-session">
                Start Session
              </Link>

              <button
                type="button"
                className="patient-link-back-to-patients"
                onClick={() => setShowRescheduleModal(true)}
              >
                <img src="images/reschedule.svg" alt="" />
                Reschedule
              </button>

              <a
                href="#"
                className="patient-link-cancel-session"
                data-bs-toggle="modal"
                data-bs-target="#cancelSessionModal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
                Cancel
              </a>
            </div>
          </div>

          <div className="dbt-pcard-container">
            {/* Patient Profile Box */}
            <div className="dbt-pcard-section dbt-pcard-profile">
              <div className="dbt-pcard-avatar-wrapper">
                <img
                  src={getFullImgUrl(sessionData?.profile_image)}
                  alt={sessionData?.name || "Patient Profile"}
                  className="dbt-pcard-avatar-img"
                />
              </div>
              <div className="dbt-pcard-meta-main">
                <h2 className="dbt-pcard-name">
                  {sessionData?.name || "N/A"}{" "}
                  <a href="#">
                    <img src="images/right-icon.svg" alt="" />
                  </a>
                </h2>
                <p className="dbt-pcard-age-gender">
                  Age {sessionData?.age || "N/A"}{" "}
                  <span className="dbt-pcard-bullet">•</span>{" "}
                  {sessionData?.gender ? formatStatus(sessionData.gender) : "N/A"}
                </p>
                <div className="dbt-pcard-ids">
                  <p>
                    Patient ID:{" "}
                    <span>
                      {sessionData?.patient_code || sessionData?.patient_id || "N/A"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Patient Details Box */}
            <div className="dbt-pcard-section dbt-pcard-details">
              <div className="dbt-pcard-info-row">
                History No. -: {sessionData?.history_number || "N/A"}
              </div>
              <div className="dbt-pcard-info-row">
                Session Type -: <span>{sessionData?.service_name || "N/A"}</span>
              </div>
              <div className="dbt-pcard-info-row">
                Session Price -:{" "}
                <span>{formatCurrencyValue(sessionData?.session_price)}</span>
              </div>
              <div className="dbt-pcard-info-row">
                Services Added -:{" "}
                <span>
                  {additionalServicesList.length > 0
                    ? additionalServicesList
                      .map((s: any) => s.service_name || s.name)
                      .join(", ")
                    : sessionData?.service_name || "None"}
                </span>
              </div>
            </div>

            {/* Session Time & Status Box */}
            <div className="dbt-pcard-section dbt-pcard-session-last">
              <div className="dbt-pcard-info-row">
                Session Mode -:{" "}
                <a href="#" className="session-mode">
                  <span></span>
                  {sessionData?.session_mode
                    ? formatStatus(sessionData.session_mode)
                    : "N/A"}
                </a>
              </div>
              <div className="dbt-pcard-info-row">
                Date -:{" "}
                <span>
                  {sessionData?.session_date
                    ? formatDate(sessionData.session_date)
                    : "N/A"}
                </span>
              </div>
              <div className="dbt-pcard-info-row">
                Time -:{" "}
                <span>
                  {formatTimeRange(
                    sessionData?.session_start_time,
                    sessionData?.session_end_time
                  ) || "N/A"}
                </span>
              </div>
              <div className="dbt-consent-checkbox">
                <input type="checkbox" id="clinicConsent" />
                <label htmlFor="clinicConsent">In-Clinic Consent Form</label>
              </div>
            </div>
          </div>

          {/* Choose Applicable Service Card */}
          <div className="service-selection-card" style={{ overflow: "visible" }}>
            <div className="service-card-header">
              <div className="service-header-icon-wrapper">
                <img src="images/payment-profile-icon.svg" alt="" />
              </div>
              <h3 className="service-header-title">
                Choose a applicable service for Patient
              </h3>
            </div>

            <hr className="service-card-divider" />

            <div className="service-card-content" style={{ overflow: "visible" }}>
              <label className="service-input-label">Service Name*</label>

              {/* Service Selection Dropdown */}
              <div className="position-relative mb-3" style={{ maxWidth: "400px", zIndex: 100 }}>
                <div
                  className="form-select d-flex align-items-center justify-content-between"
                  style={{ cursor: "pointer", backgroundColor: "#fff" }}
                  onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                >
                  <span>
                    {availableDropdownServices.length === 0
                      ? "All available services added"
                      : "Select a service to add..."}
                  </span>
                </div>

                {isServiceDropdownOpen && availableDropdownServices.length > 0 && (
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
                      zIndex: 9999,
                      maxHeight: "180px",
                      overflowY: "auto",
                      marginTop: "4px",
                    }}
                  >
                    {availableDropdownServices.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 border-bottom hover-bg-light"
                        style={{ cursor: "pointer", fontSize: "14px" }}
                        onClick={() => handleSelectService(item)}
                      >
                        {item.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Added Service Tags */}
              <div className="service-tags-wrapper">
                {additionalServicesList.length > 0 ? (
                  additionalServicesList.map((service: any, idx: number) => (
                    <div
                      className="service-selected-tag"
                      key={service.id || service.service_id || idx}
                    >
                      <span className="service-tag-text">
                        {service.service_name || service.name}
                        {service.service_price
                          ? ` ($${service.service_price})`
                          : ""}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-muted small">
                    No additional services added yet.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Previous Sessions & Financial Details Accordion Card */}
          <div className="financial-details-card">
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
                        {filteredPreviousSessions.length === 0 ? (
                          <div className="p-3 text-muted">
                            No previous sessions found.
                          </div>
                        ) : (
                          filteredPreviousSessions.map((session: any, idx: number) => (
                            <div
                              className="ps-sessions-list-item"
                              key={session.id || idx}
                            >
                              <div className="ps-sessions-col-name">
                                <span className="ps-sessions-dot"></span>{" "}
                                {session.name || session.title || `Session ${idx + 1}`}
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
                                {formatDate(session.session_date || session.date)}
                              </div>
                              <div className="ps-sessions-col-details">
                                <span className="ps-sessions-muted-prefix">
                                  Session Details -:
                                </span>{" "}
                                {session.session_details ||
                                  session.details ||
                                  "No details available"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="financial-card-header">
              <div className="financial-header-icon-box">
                <img src="images/payment-profile-icon.svg" alt="" />
              </div>
              <h3 className="financial-header-title">
                Payment & Financial Details
              </h3>
            </div>

            <hr className="financial-card-divider" />

            <div className="financial-card-content">
              <div className="financial-info-row">
                <span className="financial-row-label">Session Type Price</span>
                <span className="financial-row-value">
                  {formatCurrencyValue(sessionData?.session_price)}
                </span>
              </div>

              <div className="financial-info-row">
                <span className="financial-row-label">Payment Method</span>
                <span className="financial-row-value">
                  {sessionData?.payment_details?.session_payment_status
                    ? formatStatus(sessionData.payment_details.session_payment_status)
                    : "Pending"}
                </span>
              </div>

              <div className="financial-info-row financial-row-align-top">
                <span className="financial-row-label">Service Added</span>
                <div className="financial-row-value-group">
                  {additionalServicesList.length > 0 ? (
                    additionalServicesList.map((srv: any, idx: number) => (
                      <div key={srv.id || srv.service_id || idx}>
                        <span className="financial-row-value">
                          +${parseFloat(srv.service_price || srv.price || "0").toFixed(2)}
                        </span>
                        <span className="financial-row-subtext" style={{ display: "block" }}>
                          - {srv.service_name || srv.name}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="financial-row-value">
                      {sessionData?.service_name || "None"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Collect Payment Section */}
          <div className="collect-payment-wrapper">
            <div className="cp-header">
              <div className="cp-header-left">
                <div className="cp-icon-circle">
                  <img src="images/collect-payment-icon.svg" alt="" />
                </div>
                <h2>Collect Payment</h2>
              </div>
              <div className="cp-remaining-badge">
                Remaining: {formattedRemainingAmount}
              </div>
            </div>

            <hr className="cp-divider" />

            <div className="cp-body">
              <div className="cp-total-row">
                <span className="cp-total-label">Total Session Amount</span>
                <span className="cp-total-val">{formattedTotalAmount}</span>
              </div>

              <div className="cp-grid">
                <div className="cp-form-group">
                  <label>Payment Mode</label>
                  <div className="cp-select-wrapper">
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="qr_scanner">QR Scanner</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="cp-form-group">
                  <label>Payment Type</label>
                  <div className="cp-select-wrapper">
                    <select
                      value={paymentType}
                      onChange={(e) => handlePaymentTypeChange(e.target.value)}
                    >
                      <option value="full_payment">Full Payment</option>
                      <option value="partial_payment">Partial Payment</option>
                      <option value="pay_later">Pay Later</option>
                    </select>
                  </div>
                </div>

                <div className="cp-form-group">
                  <label>
                    {paymentType === "partial_payment" ? "Partial Payment Amount ($) *" : "Collected Amount"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={paymentType === "partial_payment" ? "Enter partial amount" : "Enter amount"}
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    disabled={paymentType === "pay_later"}
                    style={
                      paymentType === "partial_payment"
                        ? { borderColor: showAmountError ? "#dc3545" : "#ffc107", backgroundColor: "#fffdf5" }
                        : {}
                    }
                  />
                  {paymentType === "partial_payment" && showAmountError && (
                    <small style={{ color: "#d97706", display: "block", marginTop: "4px", fontSize: "12px", fontWeight: 500 }}>
                      * Enter partial payment amount to collect now
                    </small>
                  )}
                </div>

                <div className="cp-form-group">
                  <label>Session</label>
                  <div className="cp-select-wrapper">
                    <select disabled>
                      <option>
                        {sessionData?.service_name || "Choose Session"}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="cp-checkbox-row">
                <input
                  type="checkbox"
                  id="bonus-discount"
                  checked={isBonusApplied}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsBonusApplied(checked);
                    if (paymentType === "full_payment") {
                      setAmount(
                        getFullPaymentAmount(
                          totalSessionAmountNum,
                          remainingAmountNum,
                          isFirstTimePayment,
                          checked
                        )
                      );
                    }
                  }}
                />
                <label htmlFor="bonus-discount">Add Bonus up to 10% OFF.</label>
              </div>

              <div className="cp-actions-row">
                <button
                  type="button"
                  className="cp-btn-primary"
                  onClick={handleCollectPayment}
                  disabled={isCollectingPayment}
                  style={{
                    opacity: isCollectingPayment ? 0.7 : 1,
                    cursor: isCollectingPayment ? "not-allowed" : "pointer",
                    border: "none"
                  }}
                >
                  {isCollectingPayment ? "Processing..." : "Collect Payment"}
                </button>
                <a href="#" className="cp-btn-primary" onClick={(e) => e.preventDefault()}>
                  Request Invoice
                </a>
              </div>

              {clinicPaymentList.length > 0 && (
                <div className="cp-info-cards-stack">
                  {clinicPaymentList.map((item: any, idx: number) => {
                    const pType = item.payment_type || "partial_payment";
                    const pAmount = parseFloat(item.amount || "0");
                    const formattedItemAmount = `$${pAmount.toFixed(2)}`;

                    if (pType === "full_payment") {
                      return (
                        <div
                          key={item.id || idx}
                          className="cp-status-card cp-card-green"
                          style={{
                            cursor: "pointer",
                            border: paymentType === "full_payment" ? "2px solid #28a745" : "none"
                          }}
                          onClick={() => handlePaymentTypeChange("full_payment")}
                        >
                          <div className="cp-status-card-header">
                            <h4>Full Payment</h4>
                            <span className="cp-dot"></span>
                          </div>
                          <p>Patient pays the complete session amount now.</p>
                          <div className="cp-card-amount">{formattedItemAmount} Paid</div>
                        </div>
                      );
                    } else if (pType === "partial_payment") {
                      return (
                        <div
                          key={item.id || idx}
                          className="cp-status-card cp-card-yellow"
                          style={{
                            cursor: "pointer",
                            border: paymentType === "partial_payment" ? "2px solid #ffc107" : "none"
                          }}
                          onClick={() => handlePaymentTypeChange("partial_payment")}
                        >
                          <div className="cp-status-card-header">
                            <h4>Partial Payment</h4>
                            <span className="cp-dot"></span>
                          </div>
                          <p>
                            Collect a partial amount and carry forward remaining balance.
                          </p>
                          <div className="cp-card-amount">{formattedItemAmount} Paid</div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={item.id || idx}
                          className="cp-status-card cp-card-red"
                          style={{
                            cursor: "pointer",
                            border: paymentType === "pay_later" ? "2px solid #dc3545" : "none"
                          }}
                          onClick={() => handlePaymentTypeChange("pay_later")}
                        >
                          <div className="cp-status-card-header">
                            <h4>Pay Later</h4>
                            <span className="cp-dot"></span>
                          </div>
                          <p>Entire payment will be collected in the next session.</p>
                          <div className="cp-card-amount">
                            {formattedTotalAmount} Pending
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <CancelSessionPopup />
      <AgendaCalendarPopup
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
      />
    </>
  );
};

const BackToAgenda = () => {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
      <BackToAgendaContent />
    </Suspense>
  );
};

export default BackToAgenda;
