"use client"
import React, { useState } from 'react'
import earningData from '@/src/data/earningData.json'
import Pagination from '@/src/component/common/Pagintion'

import DateRangePicker from '@/src/component/DateRangePicker'
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const EarningReport = () => {
    const [searchQuery, setSearchQuery] = useState("");
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

    const handleReset = (e: React.MouseEvent) => {
        e.preventDefault();
        setSearchQuery("");
        setPaymentTypeFilter("All");
        setStatusFilter("All");
        setSessionModeFilter("All");
        setSessionTypeFilter("All");
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

    const ledgerTotalPages = Math.max(1, Math.ceil(filteredLedger.length / ITEMS_PER_PAGE));
    const validLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
    const paginatedLedger = filteredLedger.slice((validLedgerPage - 1) * ITEMS_PER_PAGE, validLedgerPage * ITEMS_PER_PAGE);

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

        const dataToExport =
            selectedPatients.length > 0
                ? filteredLedger.filter(patient =>
                    selectedPatients.includes(patient.id)
                )
                : filteredLedger;

        // Create Excel
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Patients");

        const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array",
        });

        const file = new Blob([excelBuffer], {
            type:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        });

        saveAs(file, "Patients.xlsx");
    };

    const handleCheckboxChange = (id: number) => {
        setSelectedPatients((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    return (
        <>
            <main className="gl-content-body">
                <div className="earnings-wrp">
                    <div className="db-card-wrapper-layout earnings-reports">

                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Total Earnings</span>
                                    <span className="db-card-main-value db-color-olive-dark">{earningData.metrics.totalEarnings.value}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-olive-light"><img src="images/earning-icon.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{earningData.metrics.totalEarnings.trend}</a>
                        </div>


                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Net Earning</span>
                                    <span className="db-card-main-value db-color-olive-dark">{earningData.metrics.netEarning.value}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-olive-net"><img src="images/dashg-net-earning.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{earningData.metrics.netEarning.trend}</a>
                        </div>

                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Sessions This Month</span>
                                    <span className="db-card-main-value db-color-olive-dark">{earningData.metrics.sessionsThisMonth.value}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-olive-net"><img src="images/fluent-class--regular.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{earningData.metrics.sessionsThisMonth.subtext}</a>
                        </div>

                        <div className="db-card-item-box">
                            <div className="db-card-top-row">
                                <div className="db-card-info-block">
                                    <span className="db-card-label-text">Pending Payments</span>
                                    <span className="db-card-main-value db-color-alert-red">{earningData.metrics.pendingPayments.value}</span>
                                </div>
                                <div className="db-card-icon-badge db-bg-alert-red-light db-text-alert-red-bold"><img src="images/dash-pending-notes.svg" alt="" /></div>
                            </div>
                            <a href="#" className="db-card-action-link">{earningData.metrics.pendingPayments.subtext}</a>
                        </div>

                    </div>

                    <div className="db-reserved-revenue-card-body">

                        <div className="db-reserved-revenue-main-data">
                            <div className="db-reserved-revenue-title">Reserved revenue</div>
                            <div className="db-reserved-revenue-amount">{earningData.metrics.reservedRevenue.value}</div>
                            <div className="db-reserved-revenue-subtext">{earningData.metrics.reservedRevenue.subtext}</div>
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
                                        <th className="dbt3-th-cell dbt4-pad-left dbt4-th-sno">Select</th>
                                        <th className="dbt3-th-cell dbt4-th-name">History No.</th>
                                        <th className="dbt3-th-cell dbt4-th-dni">Patient Name</th>
                                        {/* <th className="dbt3-th-cell dbt4-th-email">Session Type</th> */}
                                        {/* <th className="dbt3-th-cell dbt4-th-phone">Date & Time</th> */}
                                        <th className="dbt3-th-cell dbt4-th-phone">Appointment</th>
                                        <th className="dbt3-th-cell dbt4-th-last-session">Session Mode</th>
                                        {/* <th className="dbt3-th-cell dbt4-th-next-session">Amount</th> */}
                                        {/* <th className="dbt3-th-cell dbt4-th-total">Patient Paid</th> */}
                                        <th className="dbt3-th-cell dbt4-th-status">Payment Type</th>
                                        <th className="dbt3-th-cell dbt4-pad-right dbt4-th-action">Payment Status</th>
                                        <th className="dbt3-th-cell">Action</th>
                                        <th className="dbt3-th-cell">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedLedger.map((session) => (
                                        <tr className="dbt-table-row" key={session.id}>
                                            <td className="dbt4-pad-left dbt4-sno-text"><div className="custom-payment-checkbox-wrapper">
                                                <label className="custom-payment-checkbox-label">
                                                    <input type="checkbox" className="custom-payment-checkbox-input" checked={selectedPatients.includes(session.id)} onChange={() => handleCheckboxChange(session.id)} />
                                                    <span className="custom-payment-checkbox-box"></span>
                                                </label>
                                            </div></td>
                                            <td>{session.historyNo}</td>
                                            <td>
                                                <img src="images/dash-user-icon.svg" alt="User" className="dbt-avatar" />
                                                <div className="dbt-profile-info">
                                                    <span className="dbt-name">{session.patientName}</span>
                                                    {session.age && <span className="dbt-subtext">{session.age}</span>}
                                                </div>
                                            </td>
                                            {/* <td className="dbt4-regular-cell"><span className={`status ${session.sessionType.toLowerCase()}-text`}>{session.sessionType}</span></td> */}
                                            <td>
                                                <span className="dbt-day">{session.sessionType}</span>
                                                <span className="dbt-subtext">{session.time}</span>
                                                <span className="dbt-subtext">{session.date}</span>
                                            </td>
                                            <td><span className={`status ${session.mode.toLowerCase()}`}><span></span>{session.mode}</span></td>
                                            {/* <td>{session.amount}</td> */}
                                            {/* <td>{session.patientPaid}</td> */}
                                            <td className="dbt4-regular-cell">{session.paymentType}</td>
                                            <td>{session.patientPaid}</td>
                                            {/* <td><span className={`status ${session.status.toLowerCase().replace(' ', '-')}`}>{session.status}</span></td> */}
                                            <td><Link href="/patient-profile" className="earnig-view-btn">View Details</Link></td>
                                            <td>
                                                <a href="/invoices/dummy-invoice.pdf"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="earnig-view-btn">View</a>
                                            </td>
                                        </tr>
                                    ))}

                                </tbody>
                            </table>
                        </div>


                        <Pagination
                            currentPage={validLedgerPage}
                            totalPages={ledgerTotalPages}
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
                                <div style={{padding: "6px 12px 6px 15px", backgroundColor: "#DEDFD2", borderRadius: "25px"}}>
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

                            <div style={{display: "flex", gap: "15px"}}>
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
