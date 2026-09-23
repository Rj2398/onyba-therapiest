"use client";
import ViewSummaryChatModal from "@/src/component/ViewSummaryChatModal";
import React, { useState, useEffect } from "react";
import profileData from "@/src/data/patientProfileData.json";
import Pagination from "@/src/component/common/Pagintion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DateRangePicker from "@/src/component/DateRangePicker";
import { FaChevronRight } from "react-icons/fa6";
import { requestApi } from "@/src/utils/api";

interface PatientDetails {
  id: number;
  profile_image: string | { url?: string; src?: string } | null;
  name: string | null;
  age: number | null;
  gender: string | null;
  patient_id: string | null;
  dni_no: string | null;
  dob: string | null;
  phone: string | null;
  email: string;
  occupation: string | null;
  marrital_status: string | null;
  company: string | null;
  next_session: {
    date: string | null;
    start_time: string | null;
    end_time: string | null;
  } | null;
  last_session: {
    date: string | null;
    start_time: string | null;
    end_time: string | null;
  } | null;
  history_number?: string | number | null;
  historyNo?: string | number | null;
  created_at?: string | null;
  registration_date?: string | null;
  patient_type?: string | null;
  therapy_type?: string | null;
  partner_name?: string | null;
  partner_dni?: string | null;
  partner_email?: string | null;
  partner_phone?: string | null;
  insurance_company?: string | null;
}

interface SessionItem {
  patient_type: string;
  id: number;
  session_date: string;
  session_start_time: string;
  session_end_time: string;
  session_type_id: number;
  name: string;
  session_mode: string;
  session_amount: string;
  paid_amount: string;
  invoice_number: string | null;
  payment_type: string | null;
  status?: string;
}

const PatientProfile = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("id");
  //   console.log(patientId, "patientId*****patientId");

  const [searchQuery, setSearchQuery] = useState("");
  const [sessionTypeFilter, setSessionTypeFilter] = useState("All");
  const [sessionModeFilter, setSessionModeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [patientInfo, setPatientInfo] = useState<PatientDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Format Date helper for Display (e.g. Jul 30, 2026)
  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr || dateStr.startsWith("-")) return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "—";
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${months[date.getMonth()]
        } ${date.getDate()}, ${date.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Format Time Range helper for Display (e.g. 10:00 AM - 10:50 AM)
  const formatDisplayTimeRange = (start: string | null, end: string | null) => {
    if (!start || !end) return "";
    const formatTime = (timeStr: string) => {
      const [hourStr, minuteStr] = timeStr?.split(":");
      const hour = parseInt(hourStr, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 || 12;
      return `${String(formattedHour).padStart(2, "0")}:${minuteStr} ${ampm}`;
    };
    try {
      return `${formatTime(start)} - ${formatTime(end)}`;
    } catch (e) {
      return `${start.substring(0, 5)} - ${end.substring(0, 5)}`;
    }
  };

  useEffect(() => {
    const fetchPatientDetails = async () => {
      setIsLoading(true);
      try {
        const response = await requestApi({
          endpoint: `get-patients-details/${patientId}`,
          method: "POST",
        });
        if (response && response.success && response.data) {
          setPatientInfo(response.data);
        } else {
          setPatientInfo(null);
        }
      } catch (err) {
        console.error("Error fetching patient details:", err);
        setPatientInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientDetails();
  }, [patientId]);

  const [sessionsList, setSessionsList] = useState<SessionItem[]>([]);
  const [totalHistoryPages, setTotalHistoryPages] = useState(1);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: null as Date | null,
    endDate: null as Date | null,
  });

  // Format Date helper for API (YYYY-MM-DD)
  const formatApiDate = (date: Date | null) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Helper to determine session status dynamically
  const getSessionStatus = (session: SessionItem) => {
    if (session.status) return session.status;

    try {
      const datePart = session.session_date?.split("T")[0];
      const sessionTime = new Date(`${datePart}T${session.session_start_time}`);
      const now = new Date();
      if (sessionTime > now) {
        return "In Progress";
      }
    } catch (e) {
      console.error("Error parsing session date:", e);
    }
    return "Completed";
  };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch session history from API
  useEffect(() => {
    const fetchSessionHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const apiStatus = statusFilter === "All" ? null : statusFilter;
        const apiMode = sessionModeFilter === "All" ? null : sessionModeFilter;
        const apiType = sessionTypeFilter === "All" ? null : sessionTypeFilter;

        const formattedDateRange =
          dateRange.startDate && dateRange.endDate
            ? [
              formatApiDate(dateRange.startDate),
              formatApiDate(dateRange.endDate),
            ]
            : null;

        const response = await requestApi({
          endpoint: "get-sessions-by-patient",
          method: "POST",
          data: {
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            patient_id: patientId,
            search: debouncedSearchQuery,
            session_status: apiStatus,
            date_range: formattedDateRange,
            session_mode: apiMode,
            session_type: apiType,
          },
        });

        if (response && response.success && response.data) {
          setSessionsList(response.data.sessions || []);
          if (response.data.pagination) {
            setTotalHistoryPages(response.data.pagination.last_page || 1);
          } else {
            setTotalHistoryPages(1);
          }
        } else {
          setSessionsList([]);
          setTotalHistoryPages(1);
        }
      } catch (error) {
        console.error("Error fetching session history:", error);
        setSessionsList([]);
        setTotalHistoryPages(1);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchSessionHistory();
  }, [
    currentPage,
    patientId,
    debouncedSearchQuery,
    sessionTypeFilter,
    sessionModeFilter,
    statusFilter,
    dateRange,
  ]);

  return (
    <>
      <main className="gl-content-body">
        <div className="patients-profile-wrp">
          <div className="dbt-pcard-top-nav">
            <a
              href="#"
              onClick={() => router.back()}
              className="dbt-pcard-back-btn"
            >
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
              Back to patients
            </a>
            <button
              type="button"
              className="dbt-pcard-action-top"
              data-bs-toggle="modal"
              data-bs-target="#aiSummaryModal1"
            >
              View AI Chat Summary
            </button>
          </div>

          {isLoading ? (
            <div
              className="dbt-pcard-container d-flex justify-content-center align-items-center py-5 bg-white rounded-3 shadow-sm mb-4 animate-pulse"
              style={{ minHeight: "180px", gap: "10px" }}
            >
              <div
                className="spinner-border text-primary"
                role="status"
                style={{ width: "2rem", height: "2rem" }}
              ></div>
              <span
                style={{ color: "#6c757d", fontSize: "15px", fontWeight: 500 }}
              >
                Loading patient details...
              </span>
            </div>
          ) : !patientInfo ? (
            <div
              className="dbt-pcard-container d-flex justify-content-center align-items-center py-5 bg-white rounded-3 shadow-sm mb-4"
              style={{ minHeight: "180px" }}
            >
              <span
                className="text-danger"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                Patient details not found.
              </span>
            </div>
          ) : (
            <div className="dbt-pcard-container">
              <div className="dbt-pcard-section dbt-pcard-profile">
                <div className="dbt-pcard-avatar-wrapper">
                  <img
                    src={
                      typeof patientInfo.profile_image === "string"
                        ? patientInfo.profile_image
                        : patientInfo.profile_image &&
                          typeof patientInfo.profile_image === "object" &&
                          "url" in patientInfo.profile_image
                          ? patientInfo.profile_image.url ||
                          "/images/dash-user-icon.svg"
                          : "/images/dash-user-icon.svg"
                    }
                    alt={patientInfo.name || "Patient"}
                    className="dbt-pcard-avatar-img"
                  />
                </div>
                <div className="dbt-pcard-meta-main">

                  <p>
                    History No: <span>{patientInfo.history_number || patientInfo.historyNo || "—"}</span>
                  </p>

                  <h2 className="dbt-pcard-name" style={{ fontSize: "15px", fontWeight: "400" }}>
                    Name: {patientInfo?.name || patientInfo?.email?.split("@")[0]}
                  </h2>
                  <p className="dbt-pcard-age-gender">
                    {patientInfo.age ? `Age ${patientInfo.age}` : "Age —"}
                    <span className="dbt-pcard-bullet">•</span>
                    {patientInfo.gender || "—"}
                  </p>
                  <div className="dbt-pcard-ids">
                    <p>
                      Patient ID: <span>{patientInfo.patient_id || "—"}</span>
                    </p>
                    <p>
                      DIN No.: <span>{patientInfo.dni_no || "—"}</span>
                    </p>
                    <p>
                      D.O.B: <span>{formatDisplayDate(patientInfo.dob)}</span>
                    </p>
                    {/* <p>
                      History No.: <span>{patientInfo.history_number || patientInfo.historyNo || "—"}</span>
                    </p> */}
                    {/* <p>
                      Reg. Date: <span>{formatDisplayDate(patientInfo.created_at || patientInfo.registration_date || null)}</span>
                    </p> */}
                  </div>
                </div>
              </div>

              <div className="dbt-pcard-section dbt-pcard-details">
                <div className="dbt-pcard-info-row">
                  Patient Type: <span>{patientInfo.patient_type ? (patientInfo.patient_type.charAt(0).toUpperCase() + patientInfo.patient_type.slice(1)) : "—"}</span>
                </div>
                <div className="dbt-pcard-info-row">
                  Phone No.-: {patientInfo.phone || "—"}
                </div>
                <div className="dbt-pcard-info-row">
                  Email -: {patientInfo.email}
                </div>
                <div className="dbt-pcard-info-row">
                  Occupation -: <span>{patientInfo.occupation || "—"}</span>
                </div>
                <div className="dbt-pcard-info-row">
                  Marital Status -:{" "}
                  <span>{patientInfo.marrital_status || "—"}</span>
                </div>
                <div className="dbt-pcard-info-row">
                  Company -: <span>{patientInfo.company || patientInfo.insurance_company || "—"}</span>
                </div>
                {patientInfo.therapy_type === "Couple" && (
                  <>
                    <div className="dbt-pcard-info-row" style={{ borderTop: "1px solid #eaeaea", paddingTop: "8px", marginTop: "4px" }}>
                      Partner -: <span>{patientInfo.partner_name || "—"}</span>
                    </div>
                    {patientInfo.partner_dni && (
                      <div className="dbt-pcard-info-row">
                        Partner DNI -: <span>{patientInfo.partner_dni}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="dbt-pcard-section dbt-pcard-session-next">
                <div className="dbt-pcard-info-row">
                  Reg. Date: <span>{formatDisplayDate(patientInfo.created_at || patientInfo.registration_date || null)}</span>
                </div>
                <div className="dbt-pcard-session-heading">
                  Next Session Details:
                </div>
                <div className="dbt-pcard-info-row">
                  Date -:{" "}
                  <span>
                    {patientInfo.next_session?.date
                      ? formatDisplayDate(patientInfo.next_session.date)
                      : "—"}
                  </span>
                </div>
                <div className="dbt-pcard-info-row">
                  Time -:{" "}
                  <span>
                    {patientInfo.next_session?.start_time &&
                      patientInfo.next_session?.end_time
                      ? formatDisplayTimeRange(
                        patientInfo.next_session.start_time,
                        patientInfo.next_session.end_time
                      )
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="dbt-pcard-section dbt-pcard-session-last">

                <div className="dbt-pcard-info-row">
                  Last Session -:{" "}
                  <span>
                    {patientInfo.last_session?.date
                      ? formatDisplayDate(patientInfo.last_session.date)
                      : "—"}
                  </span>
                </div>
                <div className="dbt-pcard-info-row">
                  Time -:{" "}
                  <span>
                    {patientInfo.last_session?.start_time &&
                      patientInfo.last_session?.end_time
                      ? formatDisplayTimeRange(
                        patientInfo.last_session.start_time,
                        patientInfo.last_session.end_time
                      )
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="dbt-main-wrapper-patients">
            <div className="dbt4-filter-bar">
              <div className="dbt4-search-box">
                <span className="dbt4-search-icon">
                  <img src="/images/search-icon.svg" alt="" />
                </span>
                <input
                  type="text"
                  placeholder="Search"
                  className="dbt4-search-input"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="dbt4-right-filters">
                <DateRangePicker
                  value={dateRange}
                  onChange={(range) => {
                    setDateRange(range);
                    setCurrentPage(1);
                  }}
                >
                  <button className="dbt4-filter-dropdown" type="button">
                    Date Range{" "}
                    <span className="dbt4-cal-icon">
                      <img src="/images/date-icon.svg" alt="" />
                    </span>
                  </button>
                </DateRangePicker>
                {/* <button className="dbt4-filter-dropdown">Date Range <span className="dbt4-cal-icon"><img src="/images/date-icon.svg" alt="" /></span></button> */}
                <div className="dropdown dbt4-bs-dropdown-wrapper">
                  <button
                    className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    Session Type{" "}
                    {sessionTypeFilter !== "All"
                      ? `(${sessionTypeFilter})`
                      : ""}{" "}
                    <span className="dbt4-arrow-icon">
                      <img src="/images/dropdown-icon.svg" alt="" />
                    </span>
                  </button>
                  <ul className="dropdown-menu dbt4-bs-menu-custom">
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === "All" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionTypeFilter("All");
                          setCurrentPage(1);
                        }}
                      >
                        All
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === "Adult" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionTypeFilter("Adult");
                          setCurrentPage(1);
                        }}
                      >
                        Adult
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === "Couple" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionTypeFilter("Couple");
                          setCurrentPage(1);
                        }}
                      >
                        Couple
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === "Child" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionTypeFilter("Child");
                          setCurrentPage(1);
                        }}
                      >
                        Child
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === "Family" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionTypeFilter("Family");
                          setCurrentPage(1);
                        }}
                      >
                        Family
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === "Coaching"
                          ? "active-filter"
                          : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionTypeFilter("Coaching");
                          setCurrentPage(1);
                        }}
                      >
                        Coaching
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="dropdown dbt4-bs-dropdown-wrapper">
                  <button
                    className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    Session Mode{" "}
                    {sessionModeFilter !== "All"
                      ? `(${sessionModeFilter})`
                      : ""}{" "}
                    <span className="dbt4-arrow-icon">
                      <img src="/images/dropdown-icon.svg" alt="" />
                    </span>
                  </button>
                  <ul className="dropdown-menu dbt4-bs-menu-custom">
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionModeFilter === "All" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionModeFilter("All");
                          setCurrentPage(1);
                        }}
                      >
                        All
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionModeFilter === "Online" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionModeFilter("Online");
                          setCurrentPage(1);
                        }}
                      >
                        Online
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${sessionModeFilter === "In-Person"
                          ? "active-filter"
                          : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSessionModeFilter("In-Person");
                          setCurrentPage(1);
                        }}
                      >
                        In-Person
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="dropdown dbt4-bs-dropdown-wrapper">
                  <button
                    className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    Status {statusFilter !== "All" ? `(${statusFilter})` : ""}{" "}
                    <span className="dbt4-arrow-icon">
                      <img src="/images/dropdown-icon.svg" alt="" />
                    </span>
                  </button>
                  <ul className="dropdown-menu dbt4-bs-menu-custom">
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${statusFilter === "All" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setStatusFilter("All");
                          setCurrentPage(1);
                        }}
                      >
                        All
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${statusFilter === "In Progress" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setStatusFilter("In Progress");
                          setCurrentPage(1);
                        }}
                      >
                        In Progress
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${statusFilter === "Completed" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setStatusFilter("Completed");
                          setCurrentPage(1);
                        }}
                      >
                        Completed
                      </a>
                    </li>
                    <li>
                      <a
                        className={`dropdown-item dbt4-bs-item ${statusFilter === "Cancelled" ? "active-filter" : ""
                          }`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setStatusFilter("Cancelled");
                          setCurrentPage(1);
                        }}
                      >
                        Cancelled
                      </a>
                    </li>
                  </ul>
                </div>
                {/* <a href="#" className="dbt4-cta-add-patient" onClick={(e) => { e.preventDefault(); setSearchQuery(""); setSessionTypeFilter("All"); setSessionModeFilter("All"); setStatusFilter("All"); setCurrentPage(1); }}> Reset</a> */}
              </div>
            </div>

            <div className="dbt-main-wrapper patients">
              <table className="dbt-data-table dbt4-full-patients-table">
                <thead>
                  <tr className="dbt3-th-row">
                    {/* <th className="dbt3-th-cell dbt4-pad-left">History No.</th> */}
                    <th className="dbt3-th-cell">Date & Time</th>
                    <th className="dbt3-th-cell">Mode</th>
                    <th className="dbt3-th-cell">Session Status</th>
                    {/* <th className="dbt3-th-cell">AI Summary</th> */}
                    <th className="dbt3-th-cell">Notes Status</th>
                    <th className="dbt3-th-cell dbt4-pad-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isHistoryLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ textAlign: "center", padding: "40px" }}
                      >
                        <div
                          className="d-flex justify-content-center align-items-center"
                          style={{ gap: "10px" }}
                        >
                          <div
                            className="spinner-border spinner-border-sm text-primary"
                            role="status"
                            style={{ width: "1.2rem", height: "1.2rem" }}
                          ></div>
                          <span style={{ color: "#6c757d", fontSize: "14px" }}>
                            Loading session history...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : sessionsList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="dbt4-center-text"
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        No Records Found
                      </td>
                    </tr>
                  ) : (
                    sessionsList.map((session) => {
                      const status = getSessionStatus(session);
                      return (
                        <tr className="dbt-table-row" key={session.id}>
                          <td>
                            <div className="dbt-datetime-block">
                              <span className="dbt-date-main">
                                <img
                                  src="/images/table-date-inner-icon.svg"
                                  alt=""
                                  className="dbt-table-inline-icon"
                                />{" "}
                                {formatDisplayDate(session.session_date)}
                              </span>
                              <span className="dbt-time-sub">
                                {formatDisplayTimeRange(
                                  session.session_start_time,
                                  session.session_end_time
                                )}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`dbt-badge-mode mode-${session.session_mode.toLowerCase() ===
                                "in-person"
                                ? "person"
                                : "online"
                                }`}
                            >
                              {session.session_mode.toLowerCase() ===
                                "in-person"
                                ? "In-Person"
                                : "Online"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`dbt-badge-status status-${status
                                .toLowerCase()
                                .replace(" ", "-")}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="dbt-empty-cell">—</td>
                          <td className="dbt4-pad-right">
                            <Link
                              href={
                                session?.patient_type == 'client'
                                  ? `/back-to-agenda?therapy_session_id=${session?.id}&hide=true`
                                  : `/final-back-to-agenda?id=${session?.id}&hide=true`
                              }
                              className="dbt-action-btn"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalHistoryPages}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        </div>
      </main>

      <ViewSummaryChatModal />
    </>
  );
};

export default PatientProfile;
