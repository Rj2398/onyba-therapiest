"use client"
import ViewSummaryChatModal from '@/src/component/ViewSummaryChatModal'
import React, { useState } from 'react'
import profileData from '@/src/data/teenPatientProfileData.json'
import Pagination from '@/src/component/common/Pagintion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DateRangePicker from '@/src/component/DateRangePicker'
import { FaChevronRight } from "react-icons/fa6";


const TeenPatientProfile = () => {

    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [sessionTypeFilter, setSessionTypeFilter] = useState("All");
    const [sessionModeFilter, setSessionModeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const filteredHistory = profileData.sessionHistory.filter(session => {
        if (searchQuery && !session.historyNo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (sessionTypeFilter !== 'All' && session.sessionType !== sessionTypeFilter) return false;
        if (sessionModeFilter !== 'All' && session.mode !== sessionModeFilter) return false;
        if (statusFilter !== 'All' && session.status !== statusFilter) return false;
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
    const validPage = Math.min(currentPage, totalPages);
    const paginatedHistory = filteredHistory.slice((validPage - 1) * ITEMS_PER_PAGE, validPage * ITEMS_PER_PAGE);

    return (
        <>

            <main className="gl-content-body">

                <div className="patients-profile-wrp">
                    <div className="dbt-pcard-top-nav">
                        <a href="#" onClick={() => router.back()} className="dbt-pcard-back-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-chevron-left" viewBox="0 0 16 16">
                                <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0" />
                            </svg>
                            Back to patients
                        </a>
                        <button type="button" className="dbt-pcard-action-top" data-bs-toggle="modal" data-bs-target="#aiSummaryModal1">View AI Chat Summary</button>
                    </div>

                    <div className="dbt-pcard-container">

                        <div className="dbt-pcard-section dbt-pcard-profile">
                            <div className="dbt-pcard-avatar-wrapper">
                                <img src={profileData.patientInfo.avatar} alt={profileData.patientInfo.name} className="dbt-pcard-avatar-img" />
                            </div>
                            <div className="dbt-pcard-meta-main">
                                <h2 className="dbt-pcard-name">{profileData.patientInfo.name}</h2>
                                <p className="dbt-pcard-age-gender">Age {profileData.patientInfo.age} <span className="dbt-pcard-bullet">•</span> {profileData.patientInfo.gender}</p>
                                <div className="dbt-pcard-ids">
                                    <p>Patient ID: <span>{profileData.patientInfo.patientId}</span></p>
                                    <p>DIN No.: <span>{profileData.patientInfo.dinNo}</span></p>
                                    <p>D.O.B: <span>{profileData.patientInfo.dob}</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="dbt-pcard-section dbt-pcard-details">
                            <div className="dbt-pcard-info-row">Phone No.-: {profileData.patientInfo.phone}</div>
                            <div className="dbt-pcard-info-row">Email -: {profileData.patientInfo.email}</div>
                            <div className="dbt-pcard-info-row">Occupation -: <span>{profileData.patientInfo.occupation}</span></div>
                            <div className="dbt-pcard-info-row">Marital Status -: <span>{profileData.patientInfo.maritalStatus}</span></div>
                            {/* <div className="dbt-pcard-info-row">Insurance -: <span>{profileData.patientInfo.insurance}</span></div> */}
                            <div className="dbt-pcard-info-row">Company -: <span>{profileData.patientInfo.company}</span></div>
                        </div>

                        <div className="dbt-pcard-section dbt-pcard-session-next">
                            <div className="dbt-pcard-session-heading">Next Session Details:</div>
                            <div className="dbt-pcard-info-row">Date -: <span>{profileData.patientInfo.nextSession.date}</span></div>
                            <div className="dbt-pcard-info-row">Time -: <span>{profileData.patientInfo.nextSession.time}</span></div>
                            <div className="dbt-pcard-info-row">Last Session -: <span>{profileData.patientInfo.lastSession}</span></div>
                            <div className="dbt-pcard-info-row">Insurance No.-: <span>{profileData.patientInfo.insuranceNo}</span></div>
                        </div>

                        <div className="dbt-pcard-section dbt-pcard-session-last">
                        <div className="dbt-pcard-info-row">Father Name -: <span>Rajesh Kumar</span></div>
                        <div className="dbt-pcard-info-row">DNI NO. -: <span>478512</span></div>
                        <div className="dbt-pcard-info-row">Email Address -: <span>raj@yopmail.com</span></div>
                        <div className="dbt-pcard-info-row">Mother Name -: <span>shilpa Shetty</span></div>
                        <div className="dbt-pcard-info-row">DNI No -: <span>478512</span></div>
                        <div className="dbt-pcard-info-row">Email Address -: <span>Shilpa@yopmail.com</span></div>
                        </div>

                    </div>

                    <div className="patient-consent-banner">
                        <div className="patient-consent-left">
                            <p style={{color: "#CF0000", marginBottom: "10px"}}>Parental Consent Form</p>
                            <p style={{color: "#262626"}}>
                                A formal parental/guardian consent form must be completed before your
                                next session can be scheduled. This form requires parent information
                                and signature.
                            </p>
                        </div>

                        <div className="patient-consent-right">
                            <div className="patient-consent-status">
                                <img src="/images/charm_circle-tick.png" alt="" />
                                <span>Completed</span>
                            </div>

                            <button className="patient-consent-btn">
                                View Form
                                {/* <img src="/images/arrow-right.svg" alt="" /> */}
                                <FaChevronRight />

                            </button>
                        </div>
                    </div>

                    <div className="dbt-main-wrapper-patients">

                        <div className="dbt4-filter-bar">
                            <div className="dbt4-search-box">
                                <span className="dbt4-search-icon"><img src="/images/search-icon.svg" alt="" /></span>
                                <input type="text" placeholder="Search" className="dbt4-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <div className="dbt4-right-filters">
                                <DateRangePicker
                                    onChange={(range) => {
                                        console.log("Selected Start Date:", range.startDate);
                                        console.log("Selected End Date:", range.endDate);
                                    }}
                                >
                                    <button className="dbt4-filter-dropdown" type="button">
                                        Date Range <span className="dbt4-cal-icon"><img src="/images/date-icon.svg" alt="" /></span>
                                    </button>
                                </DateRangePicker>
                                {/* <button className="dbt4-filter-dropdown">Date Range <span className="dbt4-cal-icon"><img src="/images/date-icon.svg" alt="" /></span></button> */}
                                <div className="dropdown dbt4-bs-dropdown-wrapper">
                                    <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Session Type {sessionTypeFilter !== 'All' ? `(${sessionTypeFilter})` : ''} <span className="dbt4-arrow-icon"><img src="/images/dropdown-icon.svg" alt="" /></span>
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
                                <div className="dropdown dbt4-bs-dropdown-wrapper">
                                    <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Session Mode {sessionModeFilter !== 'All' ? `(${sessionModeFilter})` : ''} <span className="dbt4-arrow-icon"><img src="/images/dropdown-icon.svg" alt="" /></span>
                                    </button>
                                    <ul className="dropdown-menu dbt4-bs-menu-custom">
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionModeFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionModeFilter('All'); }}>All</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionModeFilter === 'Online' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionModeFilter('Online'); }}>Online</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${sessionModeFilter === 'In-Person' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionModeFilter('In-Person'); }}>In-Person</a></li>
                                    </ul>
                                </div>
                                <div className="dropdown dbt4-bs-dropdown-wrapper">
                                    <button className="dbt4-filter-dropdown dropdown-toggle dbt4-remove-arrow" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        Status {statusFilter !== 'All' ? `(${statusFilter})` : ''} <span className="dbt4-arrow-icon"><img src="/images/dropdown-icon.svg" alt="" /></span>
                                    </button>
                                    <ul className="dropdown-menu dbt4-bs-menu-custom">
                                        <li><a className={`dropdown-item dbt4-bs-item ${statusFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setStatusFilter('All'); }}>All</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${statusFilter === 'In Progress' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setStatusFilter('In Progress'); }}>In Progress</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${statusFilter === 'Completed' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setStatusFilter('Completed'); }}>Completed</a></li>
                                        <li><a className={`dropdown-item dbt4-bs-item ${statusFilter === 'Cancelled' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setStatusFilter('Cancelled'); }}>Cancelled</a></li>
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
                                        <th className="dbt3-th-cell">Payment</th>
                                        <th className="dbt3-th-cell">Invoice No.</th>
                                        <th className="dbt3-th-cell">Payment Type</th>
                                        {/* <th className="dbt3-th-cell">Session Status</th> */}
                                        {/* <th className="dbt3-th-cell">AI Summary</th> */}
                                        {/* <th className="dbt3-th-cell">Notes Status</th> */}
                                        <th className="dbt3-th-cell dbt4-pad-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedHistory.map(session => (
                                        <tr className="dbt-table-row" key={session.id}>
                                            {/* <td className="dbt4-pad-left dbt-history-text">{session.historyNo}</td> */}
                                            <td>
                                                <div className="dbt-datetime-block">
                                                    <span className="dbt-date-main"><img src="/images/table-date-inner-icon.svg" alt="" className="dbt-table-inline-icon" /> {session.date}</span>
                                                    <span className="dbt-time-sub">{session.time}</span>
                                                </div>
                                            </td>
                                            <td><span className={`dbt-badge-mode mode-${session.mode.toLowerCase() === 'in-person' ? 'person' : 'online'}`}>{session.mode}</span></td>
                                            {/* <td><span className={`dbt-badge-status status-${session.status.toLowerCase().replace(' ', '-')}`}>{session.status}</span></td> */}
                                            
                                            {/* {session.aiSummary.status === '--' ? (
                                                <td className="dbt-empty-cell">--</td>
                                            ) : (
                                                <td><span className={`dbt-state-text text-${session.aiSummary.status.toLowerCase()}`}><img src={`/images/${session.aiSummary.status.toLowerCase()}-icon.svg`} alt="" className="dbt-table-inline-icon" /> {session.aiSummary.status}</span></td>
                                            )} */}

                                            {/* {session.notesStatus.status === '--' ? (
                                                <td className="dbt-empty-cell">--</td>
                                            ) : (
                                                <td>
                                                    <div className="dbt-state-notes">
                                                        <span className={`dbt-state-text text-${session.notesStatus.status.toLowerCase()}`}>
                                                            {session.notesStatus.status === 'Ready' && <img src="/images/ready-icon.svg" alt="" className="dbt-table-inline-icon" />}
                                                            {session.notesStatus.status}
                                                        </span>
                                                        <span className={`dbt-notes-time-left ${session.notesStatus.status === 'Ready' ? 'grey-sub' : ''}`}>{session.notesStatus.subtext}</span>
                                                    </div>
                                                </td>
                                            )} */}
                                            <td>$100</td>
                                            <td>IN-14523698</td>
                                            <td>Credit Card</td>
                                            <td className="dbt4-pad-right"><Link href="/final-back-to-agenda" className="dbt-action-btn">View Details</Link></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={validPage}
                            totalPages={totalPages}
                            onPageChange={(p) => setCurrentPage(p)}
                        />

                    </div>
                </div>
            </main>

            <ViewSummaryChatModal />

        </>
    )
}

export default TeenPatientProfile
