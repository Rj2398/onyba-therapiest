"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { requestApi } from "@/src/utils/api";
import Pagination from "@/src/component/common/Pagintion";
import AgendaCalendarPopup from "@/src/component/AgendaCalendarPopup";
import DateRangePicker from "@/src/component/DateRangePicker";

interface PatientItem {
  id: number;
  history_number?: number | string | null;
  historyNo?: number | string | null;
  name?: string | null;
  profile_image?: string | { url?: string; src?: string } | null;
  age?: number | null;
  email?: string | null;
  phone?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  is_active?: number | null;
  created_at?: string | null;
  total_sessions?: number | null;
  next_session_date?: string | null;
  next_session_start_time?: string | null;
  next_session_end_time?: string | null;
}

const Patient = () => {
  const [searchPatients, setSearchPatients] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [patientsList, setPatientsList] = useState<PatientItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

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

  // Format Date helper for Display (e.g. Jul 30, 2026)
  const formatDisplayDate = (dateStr?: string | null) => {
    if (!dateStr || typeof dateStr !== "string" || dateStr.startsWith("-")) return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
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
      return `${
        months[date.getMonth()]
      } ${date.getDate()}, ${date.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Format Time Range helper for Display (e.g. 10:00 AM - 10:50 AM)
  const formatDisplayTimeRange = (start?: string | null, end?: string | null) => {
    if (!start || !end) return "";
    const formatTime = (timeStr: string) => {
      if (!timeStr || typeof timeStr !== "string") return "";
      const parts = timeStr.split(":");
      if (!parts || parts.length === 0) return "";
      const hourStr = parts[0];
      const minuteStr = parts[1] || "00";
      const hour = parseInt(hourStr, 10);
      if (isNaN(hour)) return timeStr;
      const ampm = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 || 12;
      return `${String(formattedHour).padStart(2, "0")}:${minuteStr} ${ampm}`;
    };
    try {
      return `${formatTime(start)} - ${formatTime(end)}`;
    } catch (e) {
      return `${start?.substring(0, 5) || ""} - ${end?.substring(0, 5) || ""}`;
    }
  };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchPatients);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchPatients]);

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, dateRange]);

  // Fetch patients from API
  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        let apiStatus: number | null = null;
        if (statusFilter === "Active") {
          apiStatus = 1;
        } else if (statusFilter === "Inactive") {
          apiStatus = 0;
        }

        const formattedDateRange =
          dateRange.startDate && dateRange.endDate
            ? [
                formatApiDate(dateRange.startDate),
                formatApiDate(dateRange.endDate),
              ]
            : null;

        const response = await requestApi({
          endpoint: "get-patients",
          method: "POST",
          data: {
            page: currentPage,
            limit: itemsPerPage,
            search: debouncedSearch,
            status: apiStatus,
            dateRange: formattedDateRange,
          },
        });

        if (response && response.success && response.data) {
          setPatientsList(response.data.patients || []);
          if (response.data.pagination) {
            setTotalPages(response.data.pagination.last_page || 1);
          } else {
            setTotalPages(1);
          }
        } else {
          setPatientsList([]);
          setTotalPages(1);
        }
      } catch (error) {
        console.error("Error fetching patients:", error);
        setPatientsList([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatients();
  }, [currentPage, itemsPerPage, debouncedSearch, statusFilter, dateRange]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <>
      <main className="gl-content-body">
        <div className="dbt-main-wrapper-patients">
          <div className="dbt4-filter-bar">
            <div className="dbt4-search-box">
              <span className="dbt4-search-icon">
                <img src="/images/search-icon.svg" alt="" />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={searchPatients}
                onChange={(e) => setSearchPatients(e.target.value)}
                className="dbt4-search-input"
              />
            </div>
            <div className="dbt4-right-filters">
              <DateRangePicker
                value={dateRange}
                onChange={(range) => {
                  setDateRange(range);
                }}
              >
                <button className="dbt4-filter-dropdown" type="button">
                  Date Range{" "}
                  <span className="dbt4-cal-icon">
                    <img src="/images/date-icon.svg" alt="" />
                  </span>
                </button>
              </DateRangePicker>
              <div className="dropdown dbt4-bs-dropdown-wrapper">
                <button
                  className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  {statusFilter || "Status"}{" "}
                  <span className="dbt4-arrow-icon">
                    <img src="/images/dropdown-icon.svg" alt="" />
                  </span>
                </button>
                <ul className="dropdown-menu dbt4-bs-menu-custom">
                  <li>
                    <a
                      className="dropdown-item dbt4-bs-item"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setStatusFilter("Active");
                      }}
                    >
                      Active
                    </a>
                  </li>
                  <li>
                    <a
                      className="dropdown-item dbt4-bs-item"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setStatusFilter("Inactive");
                      }}
                    >
                      Inactive
                    </a>
                  </li>
                  <li>
                    <a
                      className="dropdown-item dbt4-bs-item"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setStatusFilter("");
                      }}
                    >
                      All
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="dbt-main-wrapper patients">
            <table className="dbt-data-table dbt4-full-patients-table">
              <thead>
                <tr className="dbt3-th-row">
                  <th className="dbt3-th-cell dbt4-pad-left dbt4-th-sno">
                    History No.
                  </th>
                  <th className="dbt3-th-cell dbt4-th-name">Patient Name</th>
                  <th className="dbt3-th-cell dbt4-th-dni">DNI</th>
                  <th className="dbt3-th-cell dbt4-th-email">Email</th>
                  <th className="dbt3-th-cell dbt4-th-next-session">
                    Next Session
                  </th>
                  <th className="dbt3-th-cell dbt4-th-total">Total Sessions</th>
                  <th className="dbt3-th-cell dbt4-th-status">Status</th>
                  <th className="dbt3-th-cell dbt4-pad-right dbt4-th-action">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
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
                          Loading Patients...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : patientsList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="dbt4-center-text"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      No Records Found
                    </td>
                  </tr>
                ) : (
                  patientsList.map((patient, index) => {
                    const historyNum = patient.history_number ?? patient.historyNo ?? "—";
                    const avatarUrl = typeof patient.profile_image === "string"
                      ? patient.profile_image
                      : patient.profile_image && typeof patient.profile_image === "object" && "url" in patient.profile_image
                      ? (patient.profile_image as any).url || "/images/dash-user-icon.svg"
                      : "/images/dash-user-icon.svg";
                    const patientName = patient.name || (patient.email ? patient.email.split("@")[0] : `Patient #${patient.id || index + 1}`);

                    return (
                      <tr key={patient.id || index} className="dbt-table-row">
                        <td>{historyNum}</td>
                        <td>
                          <img
                            src={avatarUrl}
                            alt="User"
                            className="dbt-avatar"
                          />
                          <div className="dbt-profile-info">
                            <span className="dbt-name">
                              {patientName}
                            </span>
                            <span className="dbt-subtext">
                              {patient.age !== null && patient.age !== undefined
                                ? `${patient.age} yrs`
                                : "--"}
                            </span>
                          </div>
                        </td>
                        <td className="dbt4-regular-cell">
                          {patient.doc_number || "—"}
                        </td>
                        <td className="dbt4-email-cell">{patient.email || "—"}</td>
                        <td>
                          {patient.next_session_date ? (
                            <>
                              <span className="dbt-day">
                                <img
                                  src="/images/table-date-inner-icon.svg"
                                  alt=""
                                />{" "}
                                {formatDisplayDate(patient.next_session_date)}
                              </span>
                              <span className="dbt-subtext session">
                                {formatDisplayTimeRange(
                                  patient.next_session_start_time,
                                  patient.next_session_end_time
                                )}
                              </span>
                            </>
                          ) : (
                            <span
                              className="dbt-subtext text-muted"
                              style={{ fontSize: "12px" }}
                            >
                              No Scheduled Session
                            </span>
                          )}
                        </td>
                        <td className="dbt4-regular-cell dbt4-center-text">
                          {patient.total_sessions ?? 0}
                        </td>
                        <td>
                          <span
                            className={`dbt4-status-badge ${
                              patient.is_active === 1
                                ? "dbt4-badge-active"
                                : "dbt4-badge-inactive"
                            }`}
                          >
                            {patient.is_active === 1 ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="dbt4-pad-right dbt4-right-text">
                          <Link
                            href={`patient-profile?id=${patient.id}`}
                            className="dbt4-view-profile-btn"
                          >
                            View Profile
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
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </main>
    </>
  );
};

export default Patient;
