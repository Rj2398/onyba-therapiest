"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { requestApi } from "@/src/utils/api";
import { formatCount, formatCurrency } from "@/src/config";

interface DashboardCardsData {
  today_appointments?: number | string;
  monthly_toal_earning?: string;
  monthly_total_earning?: string;
  monthly_net_earning?: string;
  pending_notes?: number | string;
}

interface UpcomingSessionItem {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  session_date?: string | null;
  session_start_time?: string | null;
  session_mode?: string | null;
  patient_type?: string | null;
  subtext?: string | null;
  avatar?: string | null;
}

interface RecentPaymentItem {
  id?: number;
  patient_id?: number | null;
  patient_name?: string | null;
  session_date?: string | null;
  date?: string | null;
  created_at?: string | null;
  session_start_time?: string | null;
  time?: string | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  session_amount?: string | number | null;
  avatar?: string | null;
}

interface ReservedSlotItem {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  session_date?: string | null;
  session_start_time?: string | null;
  expires_in?: string | null;
  expiresIn?: string | null;
  subtext?: string | null;
  avatar?: string | null;
}

interface NeedingNoteItem {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  session_date?: string | null;
  session_start_time?: string | null;
  due_in?: string | null;
  dueIn?: string | null;
  subtext?: string | null;
  avatar?: string | null;
}

interface DashboardTablesData {
  upcoming_sessions?: UpcomingSessionItem[];
  recent_payments?: RecentPaymentItem[];
  reserved_slots?: ReservedSlotItem[];
  needing_notes?: NeedingNoteItem[];
}

const formatDateLabel = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  try {
    const today = new Date();
    const datePart = dateStr.split("T")[0];
    const parts = datePart.split("-");
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const targetDate = new Date(year, month, day);
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const diffDays = Math.round(
      (targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";

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
    return `${months[month]} ${day}, ${year}`;
  } catch (e) {
    return dateStr;
  }
};

const formatTimeLabel = (timeStr?: string | null) => {
  if (!timeStr) return "—";
  try {
    const [hourStr, minuteStr] = timeStr.split(":");
    let hour = parseInt(hourStr, 10);
    if (isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    const min = minuteStr ? minuteStr.padStart(2, "0") : "00";
    return `${String(hour).padStart(2, "0")}:${min} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const getPatientDisplayName = (name?: string | null, id?: number | null) => {
  if (name && name.trim()) return name.trim();
  if (id) return `Patient #${id}`;
  return "Unknown Patient";
};

const getDueIn = (note: NeedingNoteItem) => {
  if (note.due_in) return note.due_in;
  if (note.dueIn) return note.dueIn;
  if (note.session_date && note.session_start_time) {
    try {
      const datePart = note.session_date.split("T")[0];
      const timePart = note.session_start_time;
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, min, sec] = timePart.split(":").map(Number);
      const sessionTime = new Date(
        year,
        month - 1,
        day,
        hour || 0,
        min || 0,
        sec || 0
      );
      const deadline = new Date(sessionTime.getTime() + 72 * 60 * 60 * 1000);
      const now = new Date();
      const diffMs = deadline.getTime() - now.getTime();
      if (diffMs <= 0) return "Expired";
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours}h ${mins}m`;
    } catch (e) {
      // fallback
    }
  }
  return "24h 00m";
};

const getExpiresIn = (slot: ReservedSlotItem) => {
  if (slot.expires_in) return slot.expires_in;
  if (slot.expiresIn) return slot.expiresIn;
  return "15m 00s";
};

const Dashboard = () => {
  const router = useRouter();

  const [cardData, setCardData] = useState<DashboardCardsData | null>(null);
  const [tablesData, setTablesData] = useState<DashboardTablesData | null>(
    null
  );
  console.log(tablesData, "table data ***");

  const [isTablesLoading, setIsTablesLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardCards = async () => {
      try {
        const response = await requestApi({
          endpoint: "dashboard-cards",
          method: "POST",
        });

        if (response && response.success && response.data) {
          setCardData(response.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard cards:", error);
      }
    };

    const fetchDashboardTables = async () => {
      setIsTablesLoading(true);
      try {
        const response = await requestApi({
          endpoint: "dashboard-tables",
          method: "POST",
        });

        if (response && response.success && response.data) {
          console.log(response, "respose of this***");

          setTablesData(response.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard tables:", error);
      } finally {
        setIsTablesLoading(false);
      }
    };

    fetchDashboardCards();
    fetchDashboardTables();
  }, []);

  const totalEarningRaw =
    cardData?.monthly_toal_earning ?? cardData?.monthly_total_earning;

  const dashboardStats = [
    {
      label: "Today's Appointments",
      value: formatCount(cardData?.today_appointments, "..."),
      valueColorClass: "db-color-olive-dark",
      iconBgClass: "db-bg-olive-light",
      iconTextClass: "",
      iconSrc: "/images/dash-appointments.svg",
      actionText: "View all appointments",
      link: "/agenda",
    },
    {
      label: "Total Earning",
      value: formatCurrency(totalEarningRaw, "..."),
      valueColorClass: "db-color-olive-dark",
      iconBgClass: "db-bg-olive-net",
      iconTextClass: "",
      iconSrc: "/images/dash-total-earning.svg",
      actionText: "View all",
      link: "/earning",
    },
    {
      label: "Net Earning",
      value: formatCurrency(cardData?.monthly_net_earning, "..."),
      valueColorClass: "db-color-olive-dark",
      iconBgClass: "db-bg-olive-net",
      iconTextClass: "",
      iconSrc: "/images/dashg-net-earning.svg",
      actionText: "View all",
      link: "/earning",
    },
    {
      label: "Pending Notes",
      value: formatCount(cardData?.pending_notes, "..."),
      valueColorClass: "db-color-alert-red",
      iconBgClass: "db-bg-alert-red-light",
      iconTextClass: "db-text-alert-red-bold",
      iconSrc: "/images/dash-pending-notes.svg",
      // actionText: "Go to notes",
      // link: "/final-back-to-agenda",
    },
  ];

const isStartSessionAvailable = (sessionDate?: string | null, startTime?: string | null) => {
  if (!sessionDate || !startTime) return false;
  try {
    const cleanDateStr = sessionDate.split("T")[0];
    let cleanTimeStr = startTime.trim();

    const parts = cleanTimeStr.split(/\s+/);
    let hours = 0;
    let minutes = 0;

    if (parts.length >= 2) {
      const [timePart, period] = parts;
      const timeParts = timePart.split(":").map(Number);
      hours = timeParts[0] || 0;
      minutes = timeParts[1] || 0;
      if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
    } else {
      const timeParts = cleanTimeStr.split(":").map(Number);
      hours = timeParts[0] || 0;
      minutes = timeParts[1] || 0;
    }

    const [year, month, day] = cleanDateStr.split("-").map(Number);
    if (!year || !month || !day) return false;

    const sessionDateTime = new Date(year, month - 1, day, hours, minutes, 0).getTime();
    const now = Date.now();
    const diffMinutes = (sessionDateTime - now) / (1000 * 60);

    return diffMinutes <= 5 && diffMinutes >= -120;
  } catch {
    return false;
  }
};

  const handleClickSubmit = (session: UpcomingSessionItem) => {
    const isOnline = session?.session_mode?.toLowerCase() === "online";
    const canStartSession = isStartSessionAvailable(
      session?.session_date,
      session?.session_start_time
    );
    const patientId = session?.patient_id || session?.id;
    const sessionId = session?.id || (session as any)?.therapy_session_id;
    const patientType = session?.patient_type?.toLowerCase();
    const patientName =
      session?.patient_name ||
      getPatientDisplayName(session?.patient_name, session?.patient_id);

    if (canStartSession) {
      if (isOnline) {
        if (sessionId) {
          const queryParams = new URLSearchParams();
          queryParams.set("therapy_session_id", String(sessionId));
          if (patientName) {
            queryParams.set("patient_name", patientName);
          }
          router.push(`/video-confrenece?${queryParams.toString()}`);
        } else {
          router.push("/video-confrenece");
        }
        return;
      }

      if (patientType === "clinic_patient") {
        router.push(
          `/back-to-agenda${sessionId ? `?therapy_session_id=${sessionId}` : ""}`
        );
      } else {
        router.push(
          `/final-back-to-agenda${sessionId ? `?therapy_session_id=${sessionId}` : ""}`
        );
      }
      return;
    }

    if (patientId) {
      router.push(`/patient-profile?id=${patientId}`);
    } else {
      router.push("/patient-profile");
    }
  };

  const upcomingSessions = tablesData?.upcoming_sessions || [];

  const recentPayments = tablesData?.recent_payments || [];
  const reservedSlots = tablesData?.reserved_slots || [];
  const needingNotes = tablesData?.needing_notes || [];

  return (
    <>
      <main className="gl-content-body">
        <div className="dashboard-wrp-sec">
          <div className="db-card-wrapper-layout">
            {dashboardStats.map((stat, index) => (
              <div className="db-card-item-box" key={index}>
                <div className="db-card-top-row">
                  <div className="db-card-info-block">
                    <span className="db-card-label-text">{stat.label}</span>
                    <span
                      className={`db-card-main-value ${stat.valueColorClass}`}
                    >
                      {stat.value}
                    </span>
                  </div>
                  <div
                    className={`db-card-icon-badge ${stat.iconBgClass} ${stat.iconTextClass}`}
                  >
                    <img src={stat.iconSrc} alt="" />
                  </div>
                </div>
                {Boolean(stat.link && stat.actionText) && (
                  <a href={stat.link} className="db-card-action-link">
                    {stat.actionText}{" "}
                    <span className="db-card-link-arrow">&gt;</span>
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="dbt-main-wrapper">
            <div className="dbt-section-left">
              <div className="dbt-panel-header">
                <div className="dbt-header-title">
                  <span className="dbt-icon-circle dbt-bg-olive">
                    <img src="/images/dashboard-tbl-icon.svg" alt="" />
                  </span>
                  <h2 className="dbt-heading-text">Upcoming Sessions</h2>
                </div>
                <Link
                  href="/agenda?status=upcoming"
                  className="dbt-view-all-link"
                >
                  View all <span className="dbt-arrow">&gt;</span>
                </Link>
              </div>

              <div
                className="dbt-table-scroll-container"
                style={{
                  maxHeight: "420px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: "4px",
                }}
              >
                <table className="dbt-data-table">
                  <tbody>
                    {isTablesLoading ? (
                      <tr>
                        <td
                          colSpan={4}
                          style={{ textAlign: "center", padding: "30px" }}
                        >
                          <div
                            className="d-flex justify-content-center align-items-center"
                            style={{ gap: "10px" }}
                          >
                            <div
                              className="spinner-border spinner-border-sm text-success"
                              role="status"
                              style={{ width: "1.2rem", height: "1.2rem" }}
                            ></div>
                            <span
                              style={{ color: "#6c757d", fontSize: "14px" }}
                            >
                              Loading upcoming sessions...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : upcomingSessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "#6c757d",
                          }}
                        >
                          No upcoming sessions found
                        </td>
                      </tr>
                    ) : (
                      upcomingSessions?.map((session, index) => {
                        const isOnline =
                          session.session_mode?.toLowerCase() === "online";
                        const statusBadgeClass = isOnline
                          ? "dbt-badge-online"
                          : "dbt-badge-inperson";
                        const statusText = isOnline ? "Online" : "In-Person";
                        const canStartSession = isStartSessionAvailable(
                          session.session_date,
                          session.session_start_time
                        );
                        const actionButtonText = canStartSession
                          ? "Start Session"
                          : "View Details";
                        const actionButtonClass = canStartSession
                          ? "dbt-btn-filled"
                          : "dbt-btn-outlined";
                        const patientName = getPatientDisplayName(
                          session.patient_name,
                          session.patient_id
                        );
                        const subtext =
                          session.subtext ||
                          (session.patient_id
                            ? `ID: #${session.patient_id}`
                            : "");
                        return (
                          <tr
                            className="dbt-table-row"
                            key={session.id || index}
                          >
                            <td className="dbt-col-profile">
                              <img
                                src={
                                  session.avatar || "/images/dash-user-icon.svg"
                                }
                                alt="User"
                                className="dbt-avatar"
                              />
                              <div className="dbt-profile-info">
                                <span
                                  className="dbt-name"
                                  style={{
                                    cursor: session.patient_id
                                      ? "pointer"
                                      : "default",
                                  }}
                                  onClick={() => {
                                    if (session.patient_id)
                                      router.push(
                                        `/patient-profile?id=${session.patient_id}`
                                      );
                                  }}
                                >
                                  {patientName}
                                </span>
                                {subtext && (
                                  <span className="dbt-subtext">{subtext}</span>
                                )}
                              </div>
                            </td>
                            <td className="dbt-col-time">
                              <span className="dbt-day">
                                <img
                                  src="/images/table-date-inner-icon.svg"
                                  alt=""
                                />{" "}
                                {formatDateLabel(session.session_date)}
                              </span>
                              <span className="dbt-time">
                                {formatTimeLabel(session.session_start_time)}
                              </span>
                            </td>
                            <td className="dbt-col-status">
                              <span className={`dbt-badge ${statusBadgeClass}`}>
                                ● {statusText}
                              </span>
                            </td>
                            <td className="dbt-col-action">
                              <button
                                className={actionButtonClass}
                                onClick={() => handleClickSubmit(session)}
                              >
                                {actionButtonText}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dbt-section-right">
              <div className="dbt-panel-header">
                <div className="dbt-header-title">
                  <span className="dbt-icon-circle dbt-bg-olive">
                    <img
                      src="/images/payment-icon-inner-table-dash.svg"
                      alt=""
                    />
                  </span>
                  <h2 className="dbt-heading-text">
                    Recent Payments{" "}
                    <span className="dbt3-sub-heading-text">(Last 5)</span>
                  </h2>
                </div>
                <Link href="/earning" className="dbt-view-all-link">
                  View all <span className="dbt-arrow">&gt;</span>
                </Link>
              </div>

              <table className="dbt-data-table">
                <thead>
                  <tr className="dbt3-th-row">
                    <th
                      className="dbt3-th-cell"
                      style={{
                        width: "45%",
                        textAlign: "left",
                        paddingLeft: "16px",
                      }}
                    >
                      Patient Name
                    </th>
                    <th
                      className="dbt3-th-cell"
                      style={{ width: "35%", textAlign: "left" }}
                    >
                      Date
                    </th>
                    <th
                      className="dbt3-th-cell"
                      style={{
                        width: "20%",
                        textAlign: "right",
                        paddingRight: "16px",
                      }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isTablesLoading ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", padding: "30px" }}
                      >
                        <div
                          className="d-flex justify-content-center align-items-center"
                          style={{ gap: "10px" }}
                        >
                          <div
                            className="spinner-border spinner-border-sm text-success"
                            role="status"
                            style={{ width: "1.2rem", height: "1.2rem" }}
                          ></div>
                          <span style={{ color: "#6c757d", fontSize: "14px" }}>
                            Loading recent payments...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : recentPayments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          color: "#6c757d",
                        }}
                      >
                        No recent payments found
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map((payment, index) => {
                      const patientName = getPatientDisplayName(
                        payment.patient_name,
                        payment.patient_id
                      );
                      const displayDate = formatDateLabel(
                        payment.session_date ||
                          payment.date ||
                          payment.created_at
                      );
                      const displayTime = formatTimeLabel(
                        payment.session_start_time || payment.time
                      );
                      const amountText = formatCurrency(
                        payment.amount ??
                          payment.paid_amount ??
                          payment.session_amount,
                        "$0"
                      );

                      return (
                        <tr className="dbt-table-row" key={payment.id || index}>
                          <td style={{ paddingLeft: "16px" }}>
                            <img
                              src={
                                payment.avatar || "/images/dash-user-icon.svg"
                              }
                              alt="User"
                              className="dbt-avatar"
                            />
                            <div className="dbt-profile-info">
                              <span
                                className="dbt-name"
                                style={{
                                  cursor: payment.patient_id
                                    ? "pointer"
                                    : "default",
                                }}
                                onClick={() => {
                                  if (payment.patient_id)
                                    router.push(
                                      `/patient-profile?id=${payment.patient_id}`
                                    );
                                }}
                              >
                                {patientName}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="dbt-day">
                              <img
                                src="/images/table-date-inner-icon.svg"
                                alt=""
                              />{" "}
                              {displayDate}
                            </span>
                            <span className="dbt-time">{displayTime}</span>
                          </td>
                          <td className="dbt3-amount-cell">{amountText}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dbt-main-wrapper">
            <div className="dbt-section-left">
              <div className="dbt-panel-header">
                <div className="dbt-header-title">
                  <span className="dbt-icon-circle dbt-bg-olive">
                    <img src="/images/clock-icon-inner-table-dash.svg" alt="" />
                  </span>
                  <h2 className="dbt-heading-text">
                    Reserved Slots{" "}
                    <span className="dbt3-sub-heading-text">
                      (Awaiting Payment)
                    </span>
                  </h2>
                </div>
                <Link
                  href="/agenda?status=reserved"
                  className="dbt-view-all-link"
                >
                  View all <span className="dbt-arrow">&gt;</span>
                </Link>
              </div>

              <table className="dbt-data-table">
                <tbody>
                  {isTablesLoading ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ textAlign: "center", padding: "30px" }}
                      >
                        <div
                          className="d-flex justify-content-center align-items-center"
                          style={{ gap: "10px" }}
                        >
                          <div
                            className="spinner-border spinner-border-sm text-success"
                            role="status"
                            style={{ width: "1.2rem", height: "1.2rem" }}
                          ></div>
                          <span style={{ color: "#6c757d", fontSize: "14px" }}>
                            Loading reserved slots...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : reservedSlots.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          color: "#6c757d",
                        }}
                      >
                        No reserved slots found
                      </td>
                    </tr>
                  ) : (
                    reservedSlots.map((slot, index) => {
                      const patientName = getPatientDisplayName(
                        slot.patient_name,
                        slot.patient_id
                      );
                      const subtext =
                        slot.subtext ||
                        (slot.patient_id ? `ID: #${slot.patient_id}` : "");
                      const expiresInStr = getExpiresIn(slot);
                      const expiresClass =
                        expiresInStr.includes("m") &&
                        !expiresInStr.includes("h")
                          ? "dbt3-countdown-text dbt3-color-urgent"
                          : "dbt3-countdown-text";

                      return (
                        <tr className="dbt-table-row" key={slot.id || index}>
                          <td className="dbt-col-profile">
                            <img
                              src={slot.avatar || "/images/dash-user-icon.svg"}
                              alt="User"
                              className="dbt-avatar"
                            />
                            <div className="dbt-profile-info">
                              <span
                                className="dbt-name"
                                style={{
                                  cursor: slot.patient_id
                                    ? "pointer"
                                    : "default",
                                }}
                                onClick={() => {
                                  if (slot.patient_id)
                                    router.push(
                                      `/patient-profile?id=${slot.patient_id}`
                                    );
                                }}
                              >
                                {patientName}
                              </span>
                              {subtext && (
                                <span className="dbt-subtext">{subtext}</span>
                              )}
                            </div>
                          </td>
                          <td className="dbt-col-time">
                            <span className="dbt-day">
                              <img
                                src="/images/table-date-inner-icon.svg"
                                alt=""
                              />{" "}
                              {formatDateLabel(slot.session_date)}
                            </span>
                            <span className="dbt-time">
                              {formatTimeLabel(slot.session_start_time)}
                            </span>
                          </td>
                          <td className="dbt3-col-countdown">
                            <span className="dbt3-expire-label">
                              Expires in
                            </span>
                            <span className={expiresClass}>{expiresInStr}</span>
                          </td>
                          <td className="dbt-col-action">
                            <button
                              className="dbt-btn-outlined"
                              onClick={() => {
                                if (slot.patient_id) {
                                  router.push(
                                    `/patient-profile?id=${slot.patient_id}`
                                  );
                                } else {
                                  router.push("/agenda");
                                }
                              }}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="dbt-section-right">
              <div className="dbt-panel-header">
                <div className="dbt-header-title">
                  <span className="dbt-icon-circle dbt-bg-olive">
                    <img src="/images/sessions-needing-notes.svg" alt="" />
                  </span>
                  <h2 className="dbt-heading-text">Sessions Needing Notes</h2>
                </div>
              </div>

              <div className="dbt-notes-container">
                {isTablesLoading ? (
                  <div style={{ textAlign: "center", padding: "30px" }}>
                    <div
                      className="d-flex justify-content-center align-items-center"
                      style={{ gap: "10px" }}
                    >
                      <div
                        className="spinner-border spinner-border-sm text-success"
                        role="status"
                        style={{ width: "1.2rem", height: "1.2rem" }}
                      ></div>
                      <span style={{ color: "#6c757d", fontSize: "14px" }}>
                        Loading notes...
                      </span>
                    </div>
                  </div>
                ) : needingNotes.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: "#6c757d",
                    }}
                  >
                    No sessions needing notes
                  </div>
                ) : (
                  needingNotes.map((note, index) => {
                    const patientName = getPatientDisplayName(
                      note.patient_name,
                      note.patient_id
                    );
                    const noteSubtext =
                      note.subtext ||
                      `${formatDateLabel(
                        note.session_date
                      )}  •  ${formatTimeLabel(note.session_start_time)}`;
                    const dueInStr = getDueIn(note);

                    return (
                      <div className="dbt-note-card" key={note.id || index}>
                        <table className="dbt-inner-note-layout">
                          <tbody>
                            <tr>
                              <td style={{ width: "50%" }}>
                                <img
                                  src={
                                    note.avatar || "/images/dash-user-icon.svg"
                                  }
                                  alt="User"
                                  className="dbt-avatar"
                                  style={{ verticalAlign: "middle" }}
                                />
                                <div
                                  className="dbt-profile-info"
                                  style={{ verticalAlign: "middle" }}
                                >
                                  <span
                                    className="dbt-name"
                                    style={{
                                      cursor: note.patient_id
                                        ? "pointer"
                                        : "default",
                                    }}
                                    onClick={() => {
                                      if (note.patient_id)
                                        router.push(
                                          `/patient-profile?id=${note.patient_id}`
                                        );
                                    }}
                                  >
                                    {patientName}
                                  </span>
                                  <span className="dbt-subtext">
                                    {noteSubtext}
                                  </span>
                                </div>
                              </td>
                              <td style={{ width: "25%", textAlign: "left" }}>
                                <span className="dbt-due-label">Due in</span>
                                <span className="dbt-due-countdown">
                                  {dueInStr}
                                </span>
                              </td>
                              <td style={{ width: "25%", textAlign: "right" }}>
                                <button
                                  className="dbt-btn-maroon"
                                  onClick={() => {
                                    if (note.id) {
                                      router.push(
                                        `/final-back-to-agenda?id=${note.id}`
                                      );
                                    }
                                  }}
                                >
                                  Create Notes
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })
                )}

                <div className="dbt-alert-banner">
                  <span className="dbt-alert-icon">
                    <img src="/images/note-icon-inner-table.svg" alt="" />
                  </span>
                  <span className="dbt-alert-text">
                    Notes must be created within 72 hours after session ends.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Dashboard;
