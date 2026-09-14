"use client"

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react'
import EndSession from '../meetingmodal/EndSession';
import { useAuth } from '@/src/app/UserProvider';
import { Base_image_url } from '@/src/config';



const notifications = [
    {
        id: 1,
        title: "Sanitas paid invoice INV-2838",
        category: "Billing",
        time: "2h ago",
        isRead: false,
    },
    {
        id: 2,
        title: "New appointment scheduled for Dr. Ana Ruiz",
        category: "Appointments",
        time: "3h ago",
        isRead: false,
    },
    {
        id: 3,
        title: "Invoice INV-2839 is overdue (Lucia Hernández)",
        category: "Overdue",
        time: "5h ago",
        isRead: false,
    },
    {
        id: 4,
        title: "New appointment scheduled for Dr. Ana Ruiz",
        category: "Appointments",
        time: "1d ago",
        isRead: true,
    },
];

const languages = [
    {
        id: 1,
        name: "English",
        flag: "/images/flags/uk.svg.webp",
    },
    {
        id: 2,
        name: "Español",
        flag: "/images/flags/spain.svg.webp",
    },

];


const Header = ({ isMiniSidebar }: { isMiniSidebar: boolean }) => {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const sessionId = searchParams.get("therapy_session_id") || searchParams.get("session_id") || searchParams.get("id");
    const { userDetails, therapistProfile } = useAuth()
    const [isNotiOpen, setIsNotiOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"All" | "Unread">("All");
    const [selectedLanguage, setSelectedLanguage] = useState(languages[0]);
    const [isLanguageOpen, setIsLanguageOpen] = useState(false);
    const notiRef = useRef<HTMLDivElement>(null);

    const [joinedCallData, setJoinedCallData] = useState<any>(null);
    const [sessionDurationText, setSessionDurationText] = useState<string>("00:00:00");

    // Listen for callJoinedUpdated event or read from localStorage
    useEffect(() => {
        if (!sessionId) return;

        const loadCallData = () => {
            try {
                const stored = localStorage.getItem(`call_joined_${sessionId}`);
                if (stored) {
                    setJoinedCallData(JSON.parse(stored));
                }
            } catch (e) { }
        };

        loadCallData();

        const handleCallJoinedUpdate = (e: any) => {
            if (e?.detail) {
                setJoinedCallData(e.detail);
            } else {
                loadCallData();
            }
        };

        window.addEventListener("callJoinedUpdated", handleCallJoinedUpdate);
        return () => window.removeEventListener("callJoinedUpdated", handleCallJoinedUpdate);
    }, [sessionId]);

    // Timer calculation from started_at to current time
    useEffect(() => {
        let startTimeMs: number | null = null;
        if (joinedCallData?.started_at) {
            const parsed = new Date(joinedCallData.started_at).getTime();
            if (!isNaN(parsed) && parsed > 0) {
                startTimeMs = parsed;
            }
        }

        if (!startTimeMs) {
            startTimeMs = Date.now();
        }

        const updateDuration = () => {
            const now = Date.now();
            const diffMs = Math.max(0, now - (startTimeMs as number));
            const totalSec = Math.floor(diffMs / 1000);
            const hrs = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            const secs = totalSec % 60;
            const pad = (n: number) => String(n).padStart(2, "0");
            setSessionDurationText(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
        };

        updateDuration();
        const timerId = setInterval(updateDuration, 1000);
        return () => clearInterval(timerId);
    }, [joinedCallData?.started_at]);

    const patientNameFromQuery = searchParams.get("patient_name");
    const headerPatientName =
        (joinedCallData?.patient?.name
            ? `${joinedCallData.patient.name} ${joinedCallData.patient.surname_one || ""}`.trim()
            : null) ||
        patientNameFromQuery ||
        "John Carter";

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
                setIsNotiOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const hideHeader = pathname.includes("/back-to-calendar") ||
        pathname.includes("/video-confrenece");


    const filteredNotifications =
        activeTab === "All"
            ? notifications
            : notifications.filter((item) => !item.isRead);

    const getGreeting = () => {
        const hour = new Date().getHours();

        if (hour >= 5 && hour < 12) {
            return "Good morning";
        }

        if (hour >= 12 && hour < 17) {
            return "Good afternoon";
        }

        if (hour >= 17 && hour < 21) {
            return "Good evening";
        }

        return "Good night";
    };

    const pageHeaderConfig = [
        {
            path: "/dashboard",
            title: `${getGreeting()}, Dr. Rafael Costa`,
            subtitle: "Welcome back! Here's your overview for today.",
            icon: "/images/header-hand-icon.svg",
        },
        {
            path: "/patient-profile",
            title: "Patient Details",
            subtitle: "View all information related to this session",
        },
        {
            path: "/final-back-to-agenda",
            title: "Session Details",
            subtitle: "View all information related to this session",
        },
        {
            path: "/back-to-agenda",
            title: "Session Details",
            subtitle: "View all information related to this session",
        },
        {
            path: "/patient",
            title: "Patients",
            subtitle: "Manage all your sessions in one place",
        },
        {
            path: "/clinic-patients",
            title: "Clinic Patients",
            subtitle: "Manage all your clinic patients in one place",
        },
        {
            path: "/agenda",
            title: "Agenda",
            subtitle: "Manage all your sessions in one place",
        },
        {
            path: "/earning",
            title: "Earnings & Reports",
            subtitle: "Manage all your earnings & reports in one place",
        },
        {
            path: "/personal-profile",
            title: "Profile",
            subtitle: "Manage your information.",
        },
    ];

    const currentHeader =
        pageHeaderConfig.find((item) =>
            pathname.startsWith(item.path)
        ) || pageHeaderConfig[0];

    const getAvatarSrc = () => {
        const rawImg = therapistProfile?.profile_image || userDetails?.userImage || userDetails?.profile_image || userDetails?.user?.profile_image || userDetails?.data?.user?.profile_image || userDetails?.user_details?.[0]?.profile_image;
        if (!rawImg) return "/images/header-user-right-profile.svg";
        if (typeof rawImg === 'string') {
            if (rawImg.startsWith('http') || rawImg.startsWith('data:') || rawImg.startsWith('/')) {
                return rawImg;
            }
            return `${Base_image_url}${rawImg}`;
        }
        try {
            return URL.createObjectURL(rawImg);
        } catch (e) {
            return "/images/header-user-right-profile.svg";
        }
    };

    let headerTitle = currentHeader.title;
    if (pathname.startsWith("/dashboard")) {
        let displayName = "Dr. Rafael Costa";
        if (therapistProfile?.name) {
            displayName = `Dr. ${therapistProfile.name}`.trim();
        } else {
            const rawName = userDetails?.full_name || userDetails?.name || userDetails?.user?.name || userDetails?.data?.user?.name || userDetails?.user_details?.[0]?.name;
            const rawSurname = userDetails?.sur_name || userDetails?.user?.sur_name || userDetails?.data?.user?.sur_name || userDetails?.user_details?.[0]?.sur_name || '';
            if (rawName) {
                displayName = `Dr. ${rawName} ${rawSurname}`.trim();
            }
        }
        headerTitle = `${getGreeting()}, ${displayName}`;
    }

    const toggleIconSrc = isMiniSidebar
        ? '/images/header-right-toggle.png'
        : '/images/header-toggle.svg';

    return (
        <>
            {!hideHeader ? (

                <header className="gl-header">
                    <div className="gl-header-left">

                        <button type="button" className="gl-sidebar-toggle" id="sidebarToggleBtn">
                            <img src={toggleIconSrc} alt="Toggle" />
                        </button>
                        <div className="header-left-part">
                            <h1 className="gl-header-panel-title">{headerTitle} {currentHeader.icon && (<img src="/images/header-hand-icon.svg" alt="" />)}</h1>
                            <p className="header-left-text">{currentHeader.subtitle}</p>
                        </div>
                    </div>

                    <div className="gl-header-right">

                        <div className="gl-notification-wrapper" ref={notiRef}>
                            <button type="button" className="gl-action-item gl-notification-trigger" id="notiTrigger" onClick={() => setIsNotiOpen(!isNotiOpen)}>
                                <img src="/images/notification-icon.svg" alt="Notifications" className="gl-header-icon" />
                            </button>

                            <div className={`gl-notification-panel ${isNotiOpen ? 'show' : ''}`} id="notiPanel">
                                <div className="gl-noti-header">
                                    <h3>Notifications</h3>
                                </div>

                                <div className="gl-noti-filters">
                                    <button className={activeTab == "All" ? "gl-filter-btn active" : "gl-filter-btn outline"} onClick={() => setActiveTab("All")}>All</button>
                                    <button className={activeTab == "Unread" ? "gl-filter-btn active" : "gl-filter-btn outline"} onClick={() => setActiveTab("Unread")}>Unread ({notifications.filter((item) => !item.isRead).length})</button>
                                </div>

                                <div className="gl-noti-list">
                                    {filteredNotifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`gl-noti-item ${!notification.isRead ? "unread" : ""
                                                }`}
                                        >
                                            <div className="gl-noti-content">
                                                <p className="gl-noti-title">
                                                    {notification.title}

                                                    {!notification.isRead && (
                                                        <span className="gl-dot"></span>
                                                    )}
                                                </p>

                                                <span className="gl-noti-meta">
                                                    {notification.category} • {notification.time}
                                                </span>
                                            </div>

                                            {!notification.isRead && (
                                                <button className="gl-mark-read">
                                                    Mark as read
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="gl-language-wrapper">
                            <button type="button" className="gl-action-item" onClick={() => setIsLanguageOpen(!isLanguageOpen)}>
                                <div className="inner-flag-drop-down">
                                    {/* <img src="/images/drop-down-header-flag.svg" alt="Language" className="gl-flag-icon" /> */}
                                    <img src={selectedLanguage.flag} alt="Language" className="gl-flag-icon" />
                                    <span>{selectedLanguage.name}</span> <img src="/images/drop-down-icon-flag.svg" alt="" />
                                </div>
                            </button>

                            {isLanguageOpen && (
                                <div className="gl-language-dropdown">
                                    {languages.map((language) => (
                                        <div
                                            key={language.id}
                                            className="gl-language-item"
                                            onClick={() => {
                                                setSelectedLanguage(language);
                                                setIsLanguageOpen(false);
                                            }}
                                        >
                                            <img
                                                src={language.flag}
                                                alt={language.name}
                                                className="gl-flag-icon"
                                            />
                                            <span>{language.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>


                        <button type="button" onClick={() => router.push("/personal-profile")} className="gl-user-avatar-block">
                            <img src={getAvatarSrc()} alt="User Profile" className="gl-user-avatar" />
                            <p className="profile-header-text">
                                {therapistProfile?.name ? `Dr. ${therapistProfile.name}`.trim() : (() => {
                                    const rawName = userDetails?.full_name || userDetails?.name || userDetails?.user?.name || userDetails?.data?.user?.name || userDetails?.user_details?.[0]?.name;
                                    const rawSurname = userDetails?.sur_name || userDetails?.user?.sur_name || userDetails?.data?.user?.sur_name || userDetails?.user_details?.[0]?.sur_name || '';
                                    return rawName ? `Dr. ${rawName} ${rawSurname}`.trim() : "Dr. Rafael Costa";
                                })()} <br />
                                <span>{(() => {
                                    if (therapistProfile?.description) {
                                        const desc = therapistProfile.description;
                                        return desc.length > 45 ? desc.substring(0, 42) + "..." : desc;
                                    }
                                    const specList = userDetails?.specilizations || userDetails?.user?.specilizations || userDetails?.data?.user?.specilizations || userDetails?.user_details?.[0]?.specilizations;
                                    return specList && specList.length > 0 ? specList[0] : "Stress Specialist";
                                })()}</span>
                            </p>
                            <img src="/images/header-right-arrow.svg" alt="User Profile" className="gl-user-down-icon" />
                        </button>
                    </div>

                </header>
            ) : (
                <header className="gl-header">
                    <div className="gl-header-left">
                        <button type="button" className="gl-sidebar-toggle" id="sidebarToggleBtn">
                            <img src="images/header-toggle.svg" alt="Toggle" />
                        </button>
                        <div className="header-left-part">
                            <h1 className="gl-header-panel-title" onClick={() => router.back()}>Back to calendar</h1>
                        </div>
                    </div>

                    <div className="ps-session-info-block">
                        <h2 className="ps-session-info-title">Session with {headerPatientName}</h2>

                        <div className="ps-session-info-meta">
                            <span className="ps-session-info-dot"></span>
                            <span className="ps-session-info-text">
                                Session Time: <span className="ps-session-info-duration">{sessionDurationText}</span>
                            </span>
                        </div>
                    </div>
                    <div className="gl-header-right">
                        <div className="action-btn-container">
                            <button
                                className="action-btn-base action-btn-filled"
                                onClick={() => {
                                    const query = searchParams && searchParams.toString() ? `?${searchParams.toString()}` : "";
                                    router.push(`/final-back-to-agenda${query}`);
                                    // router.push(`/back-to-agenda${query}`);
                                }}
                            >
                                View Filled Form
                            </button>

                            <button className="action-btn-base action-btn-outline" data-bs-toggle="modal" data-bs-target="#endSessionModal">
                                <span className="action-btn-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                        <polyline points="9 16 11 18 15 14"></polyline>
                                    </svg>
                                </span>
                                End Session
                            </button>

                        </div>
                    </div>
                </header>
            )
            }


            <EndSession sessionId={sessionId || undefined} />
        </>
    )
}

export default Header
