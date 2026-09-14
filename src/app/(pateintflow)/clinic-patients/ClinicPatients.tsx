"use client";

import React, { useEffect, useState } from 'react'
import Pagination from '@/src/component/common/Pagintion';
import Link from 'next/link';
import AgendaCalendarPopup from '@/src/component/AgendaCalendarPopup';
import DateRangePicker from '@/src/component/DateRangePicker';
import { requestApi } from '@/src/utils/api';

interface PatientItem {
    id: number;
    historyNo?: string | number;
    history_number?: string | number;
    name?: string | null;
    avatar?: string;
    profile_image?: string | null;
    age?: number | string | null;
    dni?: string;
    doc_number?: string | null;
    email: string;
    insuranceCompany?: string;
    insurance_company?: string;
    company?: string;
    totalSessions?: string | number;
    total_sessions?: string | number;
    status?: string;
    is_active?: number | boolean;
}

const ClinicPatients = () => {

    const [search, searchPatients] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [currentPage, setCurrentPage] = useState<number>(1);
    const itemsPerPage = 10;
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [patientsList, setPatientsList] = useState<PatientItem[]>([]);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [dateRange, setDateRange] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
    });

    // Format Date helper for API (YYYY-MM-DD)
    const formatApiDate = (date: Date | null) => {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    // Fetch clinic patients from API
    useEffect(() => {
        const fetchClinicPatients = async () => {
            setIsLoading(true);
            try {
                // Map status filter: "All" -> "", "Active" -> 1, "Inactive" -> 0
                let apiStatus: number | string | null = "";
                if (statusFilter === "Active") {
                    apiStatus = 1;
                } else if (statusFilter === "Inactive") {
                    apiStatus = 0;
                }

                const formattedDateRange = dateRange.startDate && dateRange.endDate
                    ? [formatApiDate(dateRange.startDate), formatApiDate(dateRange.endDate)]
                    : null;

                const response = await requestApi({
                    endpoint: 'get-clinic-patients',
                    method: 'POST',
                    data: {
                        page: currentPage,
                        limit: itemsPerPage,
                        search: debouncedSearch,
                        status: apiStatus,
                        date_range: formattedDateRange
                    }
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
                console.error("Error fetching clinic patients:", error);
                setPatientsList([]);
                setTotalPages(1);
            } finally {
                setIsLoading(false);
            }
        };

        fetchClinicPatients();
    }, [currentPage, itemsPerPage, debouncedSearch, statusFilter, dateRange]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    }

    return (
        <>

            <main className="gl-content-body">
                <div className="dbt-main-wrapper-patients">

                    <div className="dbt4-filter-bar">
                        <div className="dbt4-search-box">
                            <span className="dbt4-search-icon"><img src="/images/search-icon.svg" alt="" /></span>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => {
                                    searchPatients(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search"
                                className="dbt4-search-input"
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
                                    Date Range <span className="dbt4-cal-icon"><img src="/images/date-icon.svg" alt="" /></span>
                                </button>
                            </DateRangePicker>
                            <div className="dropdown dbt4-bs-dropdown-wrapper">
                                <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    Status {statusFilter !== "All" ? `(${statusFilter})` : ""} <span className="dbt4-arrow-icon"><img src="/images/dropdown-icon.svg" alt="" /></span>
                                </button>
                                <ul className="dropdown-menu dbt4-bs-menu-custom">
                                    <li><a className="dropdown-item dbt4-bs-item" href="#" onClick={(e) => { e.preventDefault(); setStatusFilter("Active"); setCurrentPage(1); }}>Active</a></li>
                                    <li><a className="dropdown-item dbt4-bs-item" href="#" onClick={(e) => { e.preventDefault(); setStatusFilter("Inactive"); setCurrentPage(1); }}>Inactive</a></li>
                                    <li><a className="dropdown-item dbt4-bs-item" href="#" onClick={(e) => { e.preventDefault(); setStatusFilter("All"); setCurrentPage(1); }}>All</a></li>
                                </ul>
                            </div>
                            <Link href="add-clinic-patient" className="dbt4-cta-add-patient">
                            <img src="/images/add-icon.svg" alt="" /> Add Clinic Patients
                        </Link>
                        </div>

                    </div>

                    <div className="dbt-main-wrapper patients">
                        <table className="dbt-data-table dbt4-full-patients-table">
                            <thead>
                                <tr className="dbt3-th-row">
                                    <th className="dbt3-th-cell dbt4-pad-left dbt4-th-sno">History No.</th>
                                    <th className="dbt3-th-cell dbt4-th-name">Patient Name</th>
                                    <th className="dbt3-th-cell dbt4-th-dni">DNI</th>
                                    <th className="dbt3-th-cell dbt4-th-email">Email</th>
                                    <th className="dbt3-th-cell dbt4-th-email">Insurance Company</th>
                                    <th className="dbt3-th-cell dbt4-th-total">Total Sessions</th>
                                    <th className="dbt3-th-cell dbt4-th-status">Status</th>
                                    <th className="dbt3-th-cell dbt4-pad-right dbt4-th-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: "center", padding: "40px" }}>
                                            <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                                                <div className="spinner-border spinner-border-sm text-primary" role="status" style={{ width: "1.2rem", height: "1.2rem" }}></div>
                                                <span style={{ color: "#6c757d", fontSize: "14px" }}>Loading Clinic Patients...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : patientsList.length > 0 ? (
                                    patientsList.map((patient) => {
                                        const historyNo = patient.history_number ?? patient.historyNo ?? "—";
                                        const name = patient.name ?? patient.email?.split('@')[0] ?? "—";
                                        const ageStr = patient.age !== null && patient.age !== undefined ? `${patient.age} yrs` : "";
                                        const avatar = patient.profile_image ?? patient.avatar ?? "/images/dash-user-icon.svg";
                                        const dni = patient.doc_number ?? patient.dni ?? "—";
                                        const insuranceCompany = patient.insurance_company ?? patient.insuranceCompany ?? patient.company ?? "—";
                                        const totalSessions = patient.total_sessions ?? patient.totalSessions ?? 0;

                                        let statusText = "Inactive";
                                        if (patient.status) {
                                            statusText = patient.status;
                                        } else if (patient.is_active === 1 || patient.is_active === true) {
                                            statusText = "Active";
                                        }

                                        return (
                                            <tr key={patient.id} className="dbt-table-row">
                                                <td>{historyNo}</td>

                                                <td>
                                                    <img src={avatar} alt="User" className="dbt-avatar" />
                                                    <div className="dbt-profile-info">
                                                        <span className="dbt-name">{name}</span>
                                                        {ageStr && <span className="dbt-subtext">{ageStr}</span>}
                                                    </div>
                                                </td>

                                                <td className="dbt4-regular-cell">{dni}</td>
                                                <td className="dbt4-email-cell">{patient.email}</td>
                                                <td className="dbt4-email-cell">{insuranceCompany}</td>

                                                <td className="dbt4-regular-cell dbt4-center-text">
                                                    {totalSessions}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`dbt4-status-badge ${
                                                            statusText === "Active"
                                                                ? "dbt4-badge-active"
                                                                : "dbt4-badge-inactive"
                                                        }`}
                                                    >
                                                        {statusText}
                                                    </span>
                                                </td>

                                                <td className="dbt4-pad-right dbt4-right-text">
                                                    <Link href={`patient-profile?id=${patient.id}`} className="dbt4-view-profile-btn">
                                                        View Profile
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center py-4 text-muted">
                                            No Patients Found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />

                </div>
            </main>
            <AgendaCalendarPopup isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)} />
        </>
    )
}

export default ClinicPatients

