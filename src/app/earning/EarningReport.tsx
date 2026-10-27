"use client"
import React, { useState, useEffect } from 'react'
import earningData from '@/src/data/earningData.json'
import Pagination from '@/src/component/common/Pagintion'
import { requestApi } from '@/src/utils/api'
import { formatCurrency } from '@/src/config'
import toast from 'react-hot-toast'

import DateRangePicker from '@/src/component/DateRangePicker'
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const EarningReport = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [paymentTypeFilter, setPaymentTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [sessionModeFilter, setSessionModeFilter] = useState("All");
    const [sessionTypeFilter, setSessionTypeFilter] = useState("All");
    const [selectedPatients, setSelectedPatients] = useState<number[]>([]);

    const [dateRange, setDateRange] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
    })

    const [ledgerPage, setLedgerPage] = useState(1);
    const [remunPage, setRemunPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // get-earning API states
    const [ledgerList, setLedgerList] = useState<any[]>([]);
    const [ledgerTotalPages, setLedgerTotalPages] = useState<number>(1);
    const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(true);
    const [isLedgerLoaded, setIsLedgerLoaded] = useState<boolean>(false);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Format Date helper for API (YYYY-MM-DD)
    const formatApiDate = (date: Date | null) => {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    // Reset ledger page on filter change
    useEffect(() => {
        setLedgerPage(1);
    }, [debouncedSearch, paymentTypeFilter, statusFilter, sessionModeFilter, sessionTypeFilter, dateRange]);

    // Fetch ledger from get-earning API
    const fetchEarnings = async () => {
        try {
            setIsLedgerLoading(true);
            const payload = new FormData();
            payload.append("page", String(ledgerPage));
            payload.append("limit", String(ITEMS_PER_PAGE));
            payload.append("search", debouncedSearch || "");
            payload.append("payment_type", paymentTypeFilter !== "All" ? paymentTypeFilter : "");
            payload.append("status", statusFilter !== "All" ? statusFilter : "");
            payload.append("session_mode", sessionModeFilter !== "All" ? sessionModeFilter : "");
            payload.append("session_type", sessionTypeFilter !== "All" ? sessionTypeFilter : "");
            payload.append("start_date", formatApiDate(dateRange.startDate));
            payload.append("end_date", formatApiDate(dateRange.endDate));

            const response = await requestApi({
                endpoint: "get-earning",
                method: "POST",
                data: payload,
                isFormData: true,
            });

            console.log("get-earning response:", response);

            if (response && (response.success || response.code === 200 || response.status)) {
                const resData = response.data;
                const items = Array.isArray(resData?.data)
                    ? resData.data
                    : Array.isArray(resData)
                        ? resData
                        : [];
                setLedgerList(items);
                setIsLedgerLoaded(true);

                const pages =
                    resData?.last_page ||
                    resData?.pagination?.last_page ||
                    Math.max(1, Math.ceil((resData?.total || items.length) / ITEMS_PER_PAGE));
                setLedgerTotalPages(pages || 1);
            }
        } catch (error) {
            console.error("Error fetching earnings ledger:", error);
        } finally {
            setIsLedgerLoading(false);
        }
    };

    useEffect(() => {
        fetchEarnings();
    }, [ledgerPage, debouncedSearch, paymentTypeFilter, statusFilter, sessionModeFilter, sessionTypeFilter, dateRange]);

    const handleReset = (e: React.MouseEvent) => {
        e.preventDefault();
        setSearchQuery("");
        setDebouncedSearch("");
        setPaymentTypeFilter("All");
        setStatusFilter("All");
        setSessionModeFilter("All");
        setSessionTypeFilter("All");
        setDateRange({ startDate: null, endDate: null });
        setLedgerPage(1);
    };

    const filteredLedger = earningData.sessionLedger.filter(session => {
        if (searchQuery && !session.patientName.toLowerCase().includes(searchQuery.toLowerCase()) && !session.historyNo.includes(searchQuery)) return false;
        if (paymentTypeFilter !== 'All' && session.paymentType !== paymentTypeFilter) return false;
        if (statusFilter !== 'All' && session.status !== statusFilter) return false;
        if (sessionModeFilter !== 'All' && session.mode !== sessionModeFilter) return false;
        if (sessionTypeFilter !== 'All' && session.sessionType !== sessionTypeFilter) return false;

        // Date Range Filter
        if (dateRange.startDate && dateRange.endDate) {

            const sessionDate = new Date(session.date);

            if (
                sessionDate < dateRange.startDate ||
                sessionDate > dateRange.endDate
            ) {
                return false;
            }
        }

        return true;
    });

    const ledgerMockTotalPages = Math.max(1, Math.ceil(filteredLedger.length / ITEMS_PER_PAGE));
    const validLedgerPage = Math.min(ledgerPage, ledgerMockTotalPages);
    const paginatedLedger = filteredLedger.slice((validLedgerPage - 1) * ITEMS_PER_PAGE, validLedgerPage * ITEMS_PER_PAGE);

    const displayLedger = isLedgerLoaded ? ledgerList : paginatedLedger;
    const displayLedgerTotalPages = isLedgerLoaded ? ledgerTotalPages : ledgerMockTotalPages;

    const remunTotalPages = Math.max(1, Math.ceil(earningData.previousRemuneration.length / ITEMS_PER_PAGE));
    const validRemunPage = Math.min(remunPage, remunTotalPages);
    const paginatedRemun = earningData.previousRemuneration.slice((validRemunPage - 1) * ITEMS_PER_PAGE, validRemunPage * ITEMS_PER_PAGE);

    // const handleExportPDF = () => {
    //     const doc = new jsPDF();

    //     doc.setFontSize(16);
    //     doc.text("Session Payment Ledger Report", 14, 15);

    //     const tableColumn = [
    //         "History No.",
    //         "Patient Name",
    //         "Session Type",
    //         "Date & Time",
    //         "Session Mode",
    //         "Amount",
    //         "Patient Paid",
    //         "Payment Type",
    //         "Status"
    //     ];

    //     const tableRows = filteredLedger.map((session) => [
    //         session.historyNo,
    //         session.patientName,
    //         session.sessionType,
    //         `${session.date} ${session.time}`,
    //         session.mode,
    //         session.amount,
    //         session.patientPaid,
    //         session.paymentType,
    //         session.status,
    //     ]);

    //     autoTable(doc, {
    //         head: [tableColumn],
    //         body: tableRows,
    //         startY: 25,
    //         styles: {
    //             fontSize: 8,
    //         },
    //         headStyles: {
    //             fillColor: [128, 0, 0], // maroon
    //         },
    //     });

    //     doc.save("session-payment-ledger.pdf");
    // };

    const handleExport = () => {
        const rowsToExport =
            selectedPatients.length > 0
                ? displayLedger.filter((session: any) =>
                    selectedPatients.includes(session.id)
                )
                : displayLedger;

        if (!rowsToExport || rowsToExport.length === 0) {
            toast.error("No ledger data to export.");
            return;
        }

        const dataToExport = rowsToExport.map((session: any) => {
            const historyNo = session.history_no || session.historyNo || session.patient_id || session.id || "";
            const patientName = session.patient_name || session.patientName || session.patient?.name || session.name || "N/A";
            const sessionType = session.session_type || session.sessionType || session.type || "Adult";
            const sessionTime = session.time || session.session_time || (session.start_time && session.end_time ? `${session.start_time} - ${session.end_time}` : session.start_time) || "";
            const sessionDate = session.date || session.session_date || (session.created_at ? new Date(session.created_at).toLocaleDateString('en-US') : "");
            const mode = session.session_mode || session.sessionMode || session.mode || "Online";
            const paymentType = session.payment_type || session.paymentType || "—";
            const rawStatus = session.patient_paid ?? session.patientPaid ?? session.amount ?? session.paid_amount ?? session.status ?? "—";
            const paymentStatus = typeof rawStatus === 'number' || (!isNaN(Number(rawStatus)) && !String(rawStatus).includes('$'))
                ? formatCurrency(rawStatus, "$0")
                : rawStatus;

            return {
                "History No.": historyNo,
                "Patient Name": patientName,
                "Appointment Type": sessionType,
                "Appointment Time": sessionTime,
                "Appointment Date": sessionDate,
                "Session Mode": mode,
                "Payment Type": paymentType,
                "Payment Status / Amount": paymentStatus,
            };
        });

        // Create Excel
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Session Payment Ledger");

        const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array",
        });

        const file = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        });

        saveAs(file, `session-payment-ledger-${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success(`Exported ${dataToExport.length} record(s) successfully!`);
    };

    const handleCheckboxChange = (id: number) => {
        setSelectedPatients((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    const [earningCards, setEarningCards] = useState<any>(null);
    const [isLoadingCards, setIsLoadingCards] = useState<boolean>(true);

    useEffect(() => {
        const fetchEarningCards = async () => {
            try {
                setIsLoadingCards(true);
                const response = await requestApi({
                    endpoint: "get-earning-cards",
                    method: "POST",
                });
                console.log("get-earning-cards response:", response);
                if (response && (response.success || response.code === 200 || response.status)) {
                    const data = response.data || response;
                    setEarningCards(data);
                } else if (response?.data) {
                    setEarningCards(response.data);
                }
            } catch (error) {
                console.error("Error fetching earning cards:", error);
            } finally {
                setIsLoadingCards(false);
            }
        };

        fetchEarningCards();
    }, []);

    const renderTrend = (percentage: any, fallback: string) => {
        if (percentage === undefined || percentage === null) return fallback;
        const num = Number(percentage);
        if (isNaN(num)) return `${percentage}`;
        if (num > 0) return `↑ ${num}% vs last month`;
        if (num < 0) return `↓ ${Math.abs(num)}% vs last month`;
        return `${num}% vs last month`;
    };

    const isCardsLoading = isLoadingCards;

    const totalEarningsVal = isCardsLoading
        ? "..."
        : formatCurrency(earningCards?.total_earnings, "$0");

    const totalEarningsTrend = isCardsLoading
        ? "..."
        : renderTrend(earningCards?.total_earnings_percentage, "0% vs last month");

    const netEarningVal = isCardsLoading
        ? "..."
        : formatCurrency(earningCards?.net_earnings, "$0");

    const netEarningTrend = isCardsLoading
        ? "..."
        : renderTrend(earningCards?.net_earnings_percentage, "0% vs last month");

    const sessionThisMonthData =
        earningCards?.session_this_month ??
        earningCards?.sessions_this_month;

    const sessionsThisMonthVal = isCardsLoading
        ? "..."
        : (sessionThisMonthData?.count ?? 0);

    const sessionsThisMonthSubtext = isCardsLoading
        ? "..."
        : `Avg ${formatCurrency(sessionThisMonthData?.average ?? 0, "$0")}/session`;

    const pendingPaymentsData =
        earningCards?.pending_payments ??
        earningCards?.pednding_payments ??
        earningCards?.pending_payment ??
        earningCards?.pednding_payment;

    const pendingPaymentsVal = isCardsLoading
        ? "..."
        : formatCurrency(pendingPaymentsData?.amount, "$0");

    const pendingDayCycle = pendingPaymentsData?.day_cycle ?? 15;
    const pendingCount = pendingPaymentsData?.count ?? 0;
    const pendingPaymentsSubtext = isCardsLoading
        ? "..."
        : `${pendingCount} ${pendingCount === 1 ? 'session' : 'sessions'} · ${pendingDayCycle}-day cycle`;

    const reservedSessionsData =
        earningCards?.reserved_sessions ??
        earningCards?.reserved_session ??
        earningCards?.reserved_revenue;

    const reservedRevenueVal = isCardsLoading
        ? "..."
        : formatCurrency(reservedSessionsData?.amount, "$0");

    const reservedRevenueCount = reservedSessionsData?.count ?? 0;
    const reservedRevenueSubtext = isCardsLoading
        ? "..."
        : `${reservedRevenueCount} upcoming ${reservedRevenueCount === 1 ? 'session' : 'sessions'}`;

    return (
        <>
            <main className="gl-content-body">
                <div className="earnings-wrp">
                    <div className="db-card-wrapper-layout earnings-reports">

                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Total Earnings</span>
                                    <span className="db-card-main-value db-color-olive-dark">{totalEarningsVal}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-olive-light"><img src="images/earning-icon.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{totalEarningsTrend}</a>
                        </div>


                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Net Earning</span>
                                    <span className="db-card-main-value db-color-olive-dark">{netEarningVal}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-olive-net"><img src="images/dashg-net-earning.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{netEarningTrend}</a>
                        </div>

                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Sessions This Month</span>
                                    <span className="db-card-main-value db-color-olive-dark">{sessionsThisMonthVal}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-olive-net"><img src="images/fluent-class--regular.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{sessionsThisMonthSubtext}</a>
                        </div>

                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Pending Payments</span>
                                    <span className="db-card-main-value db-color-alert-red">{pendingPaymentsVal}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-alert-red-light db-text-alert-red-bold"><img src="images/dash-pending-notes.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{pendingPaymentsSubtext}</a>
                        </div>

                    </div>

                    <div className="db-reserved-revenue-card-body">

                        <div className="db-reserved-revenue-main-data">
                            <div className="db-reserved-revenue-title">Reserved revenue</div>
                            <div className="db-reserved-revenue-amount">{reservedRevenueVal}</div>
                            <div className="db-reserved-revenue-subtext">{reservedRevenueSubtext}</div>
                        </div>

                        <div className="db-reserved-revenue-icon-button">
                            <img src="images/tabler-reserved-line.svg" alt="" />
                        </div>

                    </div>


                    <div className="dbt-main-wrapper-patients">

                        <div className="mbs-header-row">
                            <div className="mbs-title-side">
                                <div className="mbs-icon-circle">
                                    <img src="images/remuneration.svg" alt="" />
                                </div>
                                <h2 className="mbs-main-heading">Session payment ledger</h2>
                            </div>
                            <button
                                type="button"
                                className="mbs-action-btn"
                                // onClick={handleExportPDF}
                                onClick={handleExport}
                            >
                                Export
                            </button>
                        </div>

                        <div className="dbt4-filter-bar mt-4">
                            <div className="dbt4-search-box">
                                <span className="dbt4-search-icon"><img src="images/search-icon.svg" alt="" /></span>
                                <input type="text" placeholder="Search" className="dbt4-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <div className="dbt4-right-filters1">
                                <div className="dropdown dbt4-bs-dropdown-wrapper">
                                    <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Payment Type {paymentTypeFilter !== 'All' ? `(${paymentTypeFilter})` : ''} <span className="dbt4-arrow-icon1"><img src="images/dropdown-icon.svg" alt="" /></span>
                                    </button>
                                    <ul className="dropdown-menu dbt4-bs-menu-custom">
                                        <li><a className={`dropdown-item dbt4-bs-item ${paymentTypeFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentTypeFilter('All'); }}>All</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${paymentTypeFilter === 'Credit Card' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentTypeFilter('Credit Card'); }}>Credit Card</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${paymentTypeFilter === 'Cash' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentTypeFilter('Cash'); }}>Cash</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${paymentTypeFilter === 'Bank Transfer' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentTypeFilter('Bank Transfer'); }}>Bank Transfer</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${paymentTypeFilter === 'TPV Virtual (QR)' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentTypeFilter('TPV Virtual (QR)'); }}>TPV Virtual (QR)</a></li>
                                    </ul>
                                </div>
                                <div className="dropdown dbt4-bs-dropdown-wrapper">
                                    <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Status {statusFilter !== 'All' ? `(${statusFilter})` : ''}  <span className="dbt4-arrow-icon1"><img src="images/dropdown-icon.svg" alt="" /></span>
                                    </button>
                                    <ul className="dropdown-menu dbt4-bs-menu-custom">
                                        <li><a className={`dropdown-item dbt4-bs-item ${statusFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setStatusFilter('All'); }}>All</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${statusFilter === 'Paid' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setStatusFilter('Paid'); }}>Paid</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${statusFilter === 'Partially Paid' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setStatusFilter('Partially Paid'); }}>Partially Paid</a></li>
                                    </ul>
                                </div>
                                <div className="dropdown dbt4-bs-dropdown-wrapper">
                                    <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Session Mode {sessionModeFilter !== 'All' ? `(${sessionModeFilter})` : ''}  <span className="dbt4-arrow-icon1"><img src="images/dropdown-icon.svg" alt="" /></span>
                                    </button>
                                    <ul className="dropdown-menu dbt4-bs-menu-custom">
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionModeFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionModeFilter('All'); }}>All</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionModeFilter === 'Online' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionModeFilter('Online'); }}>Online</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionModeFilter === 'In-person' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionModeFilter('In-person'); }}>In-person</a></li>
                                    </ul>
                                </div>
                                <div className="dropdown dbt4-bs-dropdown-wrapper">
                                    <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Session Type {sessionTypeFilter !== 'All' ? `(${sessionTypeFilter})` : ''} <span className="dbt4-arrow-icon1"><img src="images/dropdown-icon.svg" alt="" /></span>
                                    </button>
                                    <ul className="dropdown-menu dbt4-bs-menu-custom">
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('All'); }}>All</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === 'Adult' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Adult'); }}>Adult</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === 'Couple' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Couple'); }}>Couple</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === 'Child' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Child'); }}>Child</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === 'Family' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Family'); }}>Family</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionTypeFilter === 'Coaching' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Coaching'); }}>Coaching</a></li>
                                    </ul>
                                </div>
                                {/* <DateRangePicker
                                    onChange={(range) => {
                                        console.log("Selected Start Date:", range.startDate);
                                        console.log("Selected End Date:", range.endDate);
                                    }}
                                > */}
                                <DateRangePicker
                                    value={dateRange}
                                    onChange={(range) => {
                                        setDateRange(range);
                                        // setLedgerPage(1); // optional: go back to first page
                                    }}
                                >
                                    <button className="dbt4-filter-dropdown" type="button">
                                        Date Range <span className="dbt4-cal-icon"><img src="/images/date-icon.svg" alt="" /></span>
                                    </button>
                                </DateRangePicker>
                                {/* <button className="dbt4-filter-dropdown">Date Range <span className="dbt4-cal-icon"><img src="images/date-icon.svg" alt="" /></span></button> */}
                                <a href="#" className="dbt4-cta-add-patient" onClick={handleReset}> Reset
                                </a>
                            </div>

                        </div>

                        <div className="dbt-main-wrapper patients">
                            <table className="dbt-data-table dbt4-full-patients-table">
                                <thead>
                                    <tr className="dbt3-th-row">
                                        <th className="dbt3-th-cell dbt4-pad-left dbt4-th-sno">
                                            <div className="custom-payment-checkbox-wrapper">
                                                <label className="custom-payment-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        className="custom-payment-checkbox-input"
                                                        checked={displayLedger.length > 0 && displayLedger.every((s: any) => selectedPatients.includes(s.id))}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedPatients(displayLedger.map((s: any) => s.id));
                                                            } else {
                                                                setSelectedPatients([]);
                                                            }
                                                        }}
                                                    />
                                                    <span className="custom-payment-checkbox-box"></span>
                                                </label>
                                            </div>
                                        </th>
                                        <th className="dbt3-th-cell dbt4-th-name">History No.</th>
                                        <th className="dbt3-th-cell dbt4-th-dni">Patient Name</th>
                                        <th className="dbt3-th-cell dbt4-th-phone">Appointment</th>
                                        <th className="dbt3-th-cell dbt4-th-last-session">Session Mode</th>
                                        <th className="dbt3-th-cell dbt4-th-status">Payment Type</th>
                                        <th className="dbt3-th-cell dbt4-pad-right dbt4-th-action">Payment Status</th>
                                        <th className="dbt3-th-cell">Action</th>
                                        <th className="dbt3-th-cell">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLedgerLoading ? (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: "center", padding: "30px", color: "#6c757d" }}>
                                                Loading ledger...
                                            </td>
                                        </tr>
                                    ) : displayLedger.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: "center", padding: "30px", color: "#6c757d" }}>
                                                No sessions found in ledger.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayLedger.map((session: any, idx: number) => {
                                            const sessionId = session.id ?? idx;
                                            const historyNo = session.history_no || session.historyNo || session.patient_id || session.id || "—";
                                            const patientName = session.patient_name || session.patientName || session.patient?.name || session.patient?.full_name || session.name || "N/A";
                                            const patientAvatar = session.patient_avatar || session.avatar || session.patient?.profile_image || session.patient?.avatar || "images/dash-user-icon.svg";
                                            const patientAge = session.age || session.patient_age || session.patient?.age;
                                            const sessionType = session.session_type || session.sessionType || session.type || "Adult";
                                            const sessionTime = session.time || session.session_time || (session.start_time && session.end_time ? `${session.start_time} - ${session.end_time}` : session.start_time) || "";
                                            const sessionDate = session.date || session.session_date || (session.created_at ? new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "");
                                            const mode = session.session_mode || session.sessionMode || session.mode || "Online";
                                            const paymentType = session.payment_type || session.paymentType || "—";
                                            const rawStatus = session.patient_paid ?? session.patientPaid ?? session.amount ?? session.paid_amount ?? session.status ?? "—";
                                            const paymentStatus = typeof rawStatus === 'number' || (!isNaN(Number(rawStatus)) && !String(rawStatus).includes('$'))
                                                ? formatCurrency(rawStatus, "$0")
                                                : rawStatus;
                                            const patientId = session.patient_id || session.id;
                                            const invoiceUrl = session.invoice_url || session.invoice_pdf || session.invoice || "/invoices/dummy-invoice.pdf";

                                            return (
                                                <tr className="dbt-table-row" key={sessionId}>
                                                    <td className="dbt4-pad-left dbt4-sno-text">
                                                        <div className="custom-payment-checkbox-wrapper">
                                                            <label className="custom-payment-checkbox-label">
                                                                <input
                                                                    type="checkbox"
                                                                    className="custom-payment-checkbox-input"
                                                                    checked={selectedPatients.includes(sessionId)}
                                                                    onChange={() => handleCheckboxChange(sessionId)}
                                                                />
                                                                <span className="custom-payment-checkbox-box"></span>
                                                            </label>
                                                        </div>
                                                    </td>
                                                    <td>{historyNo}</td>
                                                    <td>
                                                        <img src={patientAvatar} alt="User" className="dbt-avatar" />
                                                        <div className="dbt-profile-info">
                                                            <span className="dbt-name">{patientName}</span>
                                                            {patientAge && <span className="dbt-subtext">{patientAge}</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="dbt-day">{sessionType}</span>
                                                        {sessionTime && <span className="dbt-subtext">{sessionTime}</span>}
                                                        {sessionDate && <span className="dbt-subtext">{sessionDate}</span>}
                                                    </td>
                                                    <td>
                                                        <span className={`status ${String(mode).toLowerCase().replace(/\s+/g, '-')}`}>
                                                            <span></span>{mode}
                                                        </span>
                                                    </td>
                                                    <td className="dbt4-regular-cell">{paymentType}</td>
                                                    <td>{paymentStatus}</td>
                                                    <td>
                                                        <Link href={`/patient-profile${patientId ? `?id=${patientId}` : ''}`} className="earnig-view-btn">
                                                            View Details
                                                        </Link>
                                                    </td>
                                                    <td>
                                                        <a
                                                            href={invoiceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="earnig-view-btn"
                                                        >
                                                            View
                                                        </a>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={ledgerPage}
                            totalPages={displayLedgerTotalPages}
                            onPageChange={(p) => setLedgerPage(p)}
                        />




                    </div>
                    <div className="mbs-card-wrapper">

                        <div className="mbs-header-row">
                            <div className="mbs-title-side">
                                <div className="mbs-icon-circle">
                                    <img src="images/remuneration.svg" alt="" />
                                </div>
                                <h2 className="mbs-main-heading">Monthly Bill Summary</h2>
                                <div style={{ padding: "6px 12px 6px 15px", backgroundColor: "#DEDFD2", borderRadius: "25px" }}>
                                    <img src="/images/upload-excel.png" alt="" />
                                </div>
                            </div>
                            <button type="button" className="mbs-action-btn">Submit Current Month Invoice to Admin</button>
                        </div>

                        <div className="mbs-details-body">

                            <div className="mbs-statement-line">
                                <span className="mbs-label-col">Total Sessions</span>
                                <span className="mbs-value-col">{earningData.metrics.monthlyBillSummary.totalSessions}</span>
                            </div>

                            <div className="mbs-statement-line">
                                <span className="mbs-label-col">Subtotal (Session Fees)</span>
                                <span className="mbs-value-col">{earningData.metrics.monthlyBillSummary.subtotal}</span>
                            </div>

                            <div className="mbs-statement-line">
                                <span className="mbs-label-col">Total Patient Paid</span>
                                <span className="mbs-value-col">{earningData.metrics.monthlyBillSummary.totalPatientPaid}</span>
                            </div>

                            <div className="mbs-statement-line">
                                <span className="mbs-label-col">Bonus</span>
                                <span className="mbs-value-col">{earningData.metrics.monthlyBillSummary.totalPatientPaid}</span>
                            </div>

                            <div className="mbs-statement-line">
                                <span className="mbs-label-col">Tax Deduction</span>
                                <span className="mbs-value-col">{earningData.metrics.monthlyBillSummary.totalPatientPaid}</span>
                            </div>

                        </div>

                        <div className="mbs-total-highlight-strip">
                            <span className="mbs-total-label">Total Amount</span>
                            <span className="mbs-total-value">{earningData.metrics.monthlyBillSummary.totalAmount}</span>
                        </div>

                    </div>


                    <div className="dbt-main-wrapper-patients header-part">
                        <div className="pmr-header-wrapper">
                            <div className="pmr-title-side">
                                <div className="pmr-icon-circle">
                                    <img src="images/remuneration.svg" alt="" />
                                </div>
                                <h2 className="pmr-main-heading">Previous Month’s Remuneration</h2>
                            </div>

                            <div style={{ display: "flex", gap: "15px" }}>
                                <DateRangePicker
                                // value={dateRange}
                                // onChange={(range) => {
                                //     setDateRange(range);
                                // }}
                                >
                                    <button className="dbt4-filter-dropdown" type="button">
                                        Date Range <span className="dbt4-cal-icon"><img src="/images/date-icon.svg" alt="" /></span>
                                    </button>
                                </DateRangePicker>
                                <button type="button" className='mbs-action-btn'>Export</button>
                            </div>
                        </div>


                        <div className="dbt-main-wrapper patients header-part">
                            <table className="dbt-data-table dbt4-full-patients-table">
                                <thead>
                                    <tr className="dbt3-th-row">
                                        <th className="dbt3-th-cell dbt4-pad-left dbt4-th-sno">Invoice No.</th>
                                        <th className="dbt3-th-cell dbt4-th-name">Date & Time</th>
                                        <th className="dbt3-th-cell dbt4-th-dni">Sessions</th>
                                        <th className="dbt3-th-cell dbt4-th-email">Total Amount</th>
                                        <th className="dbt3-th-cell dbt4-th-phone">Gross Earnings</th>
                                        <th className="dbt3-th-cell dbt4-th-phone">Tax Deductions</th>
                                        <th className="dbt3-th-cell dbt4-th-phone">Net Earnings</th>
                                        <th className="dbt3-th-cell dbt4-th-last-session">Bonus</th>
                                        <th className="dbt3-th-cell dbt4-th-next-session">Date & Time</th>
                                        <th className="dbt3-th-cell dbt4-th-total">Status</th>
                                        <th className="dbt3-th-cell dbt4-th-status">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRemun.map(remun => (
                                        <tr className="dbt-table-row" key={remun.id}>
                                            <td className="dbt4-pad-left dbt4-sno-text">{remun.invoiceNo}</td>
                                            <td>{remun.dateRange}</td>
                                            <td>{remun.sessions}</td>
                                            <td>{remun.totalAmount}</td>
                                            <td>{remun.grossEarning}</td>
                                            <td>{remun.taxDeduction}</td>
                                            <td>{remun.netEarnings}</td>
                                            <td>{remun.bonus}</td>
                                            <td>{remun.date}</td>
                                            <td><span className={`status ${remun.status.toLowerCase().replace(' ', '-')}`}>{remun.status}</span></td>
                                            <td>
                                                <a href="/invoices/dummy-invoice.pdf"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="earnig-view-btn">View</a>
                                            </td>
                                            {/* <td><a href="#" className="earnig-view-btn">View</a></td> */}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={validRemunPage}
                            totalPages={remunTotalPages}
                            onPageChange={(p) => setRemunPage(p)}
                        />
                    </div>
                </div>

            </main>

        </>
    )
}

export default EarningReport
