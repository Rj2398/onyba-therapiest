"use client";
import AgendaCalendarPopup from '@/src/component/AgendaCalendarPopup'
import React, { useState, useEffect, Suspense } from 'react'
import agendaData from '@/src/data/agendaData.json'
import { useRouter, useSearchParams } from 'next/navigation';
import { IoMdCopy } from "react-icons/io";
import toast from 'react-hot-toast';
import { requestApi } from '@/src/utils/api';
import DateRangePicker from '@/src/component/DateRangePicker';

const formatYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const AgendaContent = () => {

    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
    const [paymentFilter, setPaymentFilter] = useState("All");
    const [patientTypeFilter, setPatientTypeFilter] = useState("All");
    const [sessionTypeFilter, setSessionTypeFilter] = useState("All");
    const [sessionStatusFilter, setSessionStatusFilter] = useState("All");
    const [activeDate, setActiveDate] = useState(() => new Date());

    useEffect(() => {
        const statusParam = searchParams.get("status") || searchParams.get("session_status") || searchParams.get("sessionStatusFilter");
        if (statusParam) {
            const formatted = statusParam.charAt(0).toUpperCase() + statusParam.slice(1).toLowerCase();
            if (["Upcoming", "Completed", "Cancelled", "Reserved", "All"].includes(formatted)) {
                setSessionStatusFilter(formatted);
            }
        }
    }, [searchParams]);

    const [showAgendaModal, setShowAgendaModal] = useState(false);

    const [commentBoxAlign, setCommentBoxAlign] = useState<'left' | 'right'>('left');

    const [events, setEvents] = useState<any[]>([]);

    // console.log(events, "events")

    const [copiedEvent, setCopiedEvent] = useState<any>(null);

    // Comment Modal States
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedCommentSession, setSelectedCommentSession] = useState<any>(null);
    const [commentInputText, setCommentInputText] = useState('');
    const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

    const handleCommentSubmit = async () => {
        if (!selectedCommentSession?.id) return;
        try {
            setIsCommentSubmitting(true);
            const formData = new FormData();
            formData.append('session_id', String(selectedCommentSession.id));
            formData.append('comment', commentInputText);

            const response = await requestApi({
                endpoint: 'session-comment',
                method: 'POST',
                data: formData,
                isFormData: true,
            });

            if (response && (response.success || response.code === 200 || response.status)) {
                setEvents(prev => prev.map(ev => {
                    if (ev.id === selectedCommentSession.id) {
                        return { ...ev, comment: commentInputText, hasComment: true };
                    }
                    return ev;
                }));
                setShowCommentModal(false);
                setSelectedCommentSession(null);
                setCommentInputText('');
            } else {
                toast.error(response?.message || 'Failed to add comment.');
            }
        } catch (err: any) {
            console.error('Error submitting session comment:', err);
            toast.error(err?.response?.data?.message || err?.message || 'Error submitting comment');
        } finally {
            setIsCommentSubmitting(false);
        }
    };

    const handleCopyEvent = (event: any) => {
        setCopiedEvent(event);
    }


    const handlePrevWeek = () => {
        setActiveDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 7);
            return d;
        });
    };

    const handleNextWeek = () => {
        setActiveDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 7);
            return d;
        });
    };

    const weekDays = React.useMemo(() => {
        const days = [];
        const names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

        for (let i = 0; i < 7; i++) {
            const d = new Date(activeDate);
            d.setDate(d.getDate() + i);
            const isToday = d.toDateString() === new Date().toDateString();
            const dayOfWeek = d.getDay();
            days.push({
                dateStr: formatYMD(d),
                name: names[dayOfWeek],
                number: d.getDate(),
                headerClass: `agd-day-header ${[0, 6].includes(dayOfWeek) ? 'agd-highlight-bg' : ''} ${isToday ? 'agd-active-day' : ''}`,
                columnClass: `agd-day-column ${[0, 6].includes(dayOfWeek) ? 'agd-highlight-bg' : ''}`
            });
        }
        return days;
    }, [activeDate]);

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const startDateStr = formatYMD(activeDate);
                const endDate = new Date(activeDate);
                endDate.setDate(endDate.getDate() + 6);
                const endDateStr = formatYMD(endDate);

                const formData = new FormData();
                formData.append('date_range', `${startDateStr}_${endDateStr}`);
                formData.append('payment_status', paymentFilter === 'All' ? '' : paymentFilter);
                formData.append('patient_type', patientTypeFilter === 'All' ? '' : patientTypeFilter);
                formData.append('session_status', sessionStatusFilter === 'All' ? '' : sessionStatusFilter);
                formData.append('session_type', sessionTypeFilter === 'All' ? '' : sessionTypeFilter);

                const response = await requestApi({
                    endpoint: 'get-appointments',
                    method: 'POST',
                    data: formData,
                    isFormData: true,
                });

                if (response && (response.status || response.success || Array.isArray(response.data) || Array.isArray(response.appointments))) {

                    const items = Array.isArray(response.data)
                        ? response.data
                        : (Array.isArray(response.appointments) ? response.appointments : (Array.isArray(response) ? response : null));

                    if (items) {
                        const mappedEvents = items.map((item: any, idx: number) => {
                            let dayIndex = -1;
                            const rawDate = item.session_date || item.date || item.appointment_date;
                            if (rawDate) {
                                const itemDateStr = String(rawDate).split('T')[0];
                                const foundIdx = weekDays.findIndex(w => w.dateStr === itemDateStr);
                                if (foundIdx !== -1) dayIndex = foundIdx;
                            } else if (typeof item.dayIndex === 'number') {
                                dayIndex = item.dayIndex;
                            }

                            const sessionTypeName = item.session_type_name || item.session_type || item.type || 'Adult';
                            const typeLabel = sessionTypeName.includes('Session') ? sessionTypeName : `${sessionTypeName} Session`;

                            const rawMode = item.session_mode || item.mode || 'online';
                            const modeLabel = (rawMode.toLowerCase() === 'in_person' || rawMode.toLowerCase() === 'in person') ? 'In_person' : 'Online';

                            const rawStatus = item.session_status || item.status || 'upcoming';
                            const statusLabel = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

                            return {
                                id: item.id || idx + 1,
                                dayIndex: dayIndex,
                                name: item.patient_name || item.name || item.patientName || 'Appointment',
                                age: item.age || item.patient_age || 0,
                                appId: item.id || item.appId || item.app_id || item.appointment_id || `${item.id || idx + 1}`,
                                type: typeLabel,
                                mode: modeLabel,
                                startTime: item.session_start_time || item.startTime || item.start_time || '09:00:00',
                                endTime: item.session_end_time || item.endTime || item.end_time || '09:45:00',
                                paymentStatus: item.paymentStatus || item.payment_status || 'Paid',
                                patientType: item.patient_type === 'clinic_patient' ? 'Clinic Patients' : (modeLabel === 'Online' ? 'Patients (Online)' : 'Clinic Patients'),
                                rawPatientType: item.patient_type || item.patientType || '',
                                patient_type: item.patient_type || item.patientType || '',
                                sessionType: typeLabel,
                                sessionStatus: statusLabel,
                                hasComment: Boolean(item.comment || item.hasComment || item.has_comment),
                                colorClass: modeLabel === 'In_person' ? 'agd-card-purple' : 'agd-card-green'
                            };
                        }).filter((item: any) => item.dayIndex >= 0);

                        setEvents(mappedEvents);
                    }
                }
            } catch (error) {
                console.error("Error fetching appointments:", error);
            }
        };

        fetchAppointments();
    }, [activeDate, paymentFilter, patientTypeFilter, sessionTypeFilter, sessionStatusFilter]);

    const formattedActiveDate = activeDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as Element).closest('.comment-container')) {
                setActiveCommentId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    const getMinutes = (time: string) => {
        if (!time) return 0;
        const clean = time.trim();
        const parts = clean.split(/\s+/);
        if (parts.length >= 2) {
            const [clock, period] = parts;
            let [hour, minute] = clock.split(":").map(Number);
            if (period.toUpperCase() === "PM" && hour !== 12) hour += 12;
            if (period.toUpperCase() === "AM" && hour === 12) hour = 0;
            return hour * 60 + (minute || 0);
        } else {
            let [hour, minute] = clean.split(":").map(Number);
            return (hour || 0) * 60 + (minute || 0);
        }
    };

    const formatDisplayTime = (timeStr: string) => {
        if (!timeStr) return "";
        const clean = timeStr.trim();
        const parts = clean.split(/\s+/);
        if (parts.length >= 2) {
            const clock = parts[0];
            const period = parts[1].toUpperCase();
            const [h, m] = clock.split(":");
            if (h && m) {
                return `${h.padStart(2, "0")}:${m.padStart(2, "0")}${period}`;
            }
        }
        let [hour, minute] = clean.split(":").map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
            const period = hour >= 12 ? "PM" : "AM";
            hour = hour % 12;
            if (hour === 0) hour = 12;
            return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}${period}`;
        }
        return timeStr;
    };

    const truncateName = (name?: string, length: number = 15) => {
        if (!name) return "";
        const trimmed = name.trim();
        if (trimmed.length > length) {
            return trimmed.slice(0, length) + "...";
        }
        return trimmed;
    };

    const getOverlapStyle = (event: any, dayEvents: any[]) => {
        const start = getMinutes(event.startTime);
        const end = getMinutes(event.endTime);

        const overlapping = dayEvents.filter(other => {
            const oStart = getMinutes(other.startTime);
            const oEnd = getMinutes(other.endTime);
            return Math.max(start, oStart) < Math.min(end, oEnd);
        });

        if (overlapping.length <= 1) {
            return { left: '0%', width: '100%', isOverlapping: false, count: 1 };
        }

        overlapping.sort((a, b) => (a.id || 0) - (b.id || 0));
        const index = overlapping.findIndex(o => o.id === event.id);
        const width = 100 / overlapping.length;
        const left = (index >= 0 ? index : 0) * width;

        return {
            left: `${left}%`,
            width: `${width}%`,
            isOverlapping: true,
            count: overlapping.length
        };
    };

    const CALENDAR_START = "08:00 AM";
    const SLOT_HEIGHT = 34; // Upgraded slot height for spacious card content visibility

    const calendarStartMinutes = getMinutes(CALENDAR_START);

    const timeSlots = React.useMemo(() => {
        const slots: string[] = [];
        const totalSlots = 24 * 4; // 96 slots of 15 minutes = 24 hours
        for (let i = 0; i < totalSlots; i++) {
            const totalMinutes = (calendarStartMinutes + i * 15) % (24 * 60);
            let hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            const period = hour >= 12 ? "PM" : "AM";
            hour = hour % 12;
            if (hour === 0) hour = 12;
            slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`);
        }
        return slots;
    }, [calendarStartMinutes]);

    const getCardStyle = (
        startTime: string,
        endTime: string
    ) => {

        const start = getMinutes(startTime);
        const end = getMinutes(endTime);

        const top =
            ((start - calendarStartMinutes) / 15) * SLOT_HEIGHT;

        const height =
            Math.max(((end - start) / 15) * SLOT_HEIGHT, SLOT_HEIGHT);

        return {
            top,
            height,
        };
    };


    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const SLOT_MINUTES = 15;

    const lineTop =
        ((nowMinutes - calendarStartMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;

    const currentTimeText = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

    const minutesToTimeStr = (totalMinutes: number) => {
        let hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const period = hour >= 12 ? "PM" : "AM";
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
    };

    const format24HrWithSeconds = (timeInput: number | string): string => {
        let totalMinutes = 0;
        if (typeof timeInput === 'number') {
            totalMinutes = timeInput;
        } else {
            totalMinutes = getMinutes(timeInput);
        }
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
    };


    return (
        <>
            <main className="gl-content-body">
                <div className="agd-page-wrapper">
                    <div className="agd-top-bar">
                        <div className="agd-nav-controls">
                            <button className="agd-arrow-btn" onClick={handlePrevWeek}><img src="/images/left-icon-agenda.svg" alt="" /></button>
                            <button className="agd-date-indicator">{formattedActiveDate}</button>
                            <button className="agd-arrow-btn" onClick={handleNextWeek}><img src="/images/right-icon-agenda.svg" alt="" /></button>
                        </div>

                        <div className="agd-filter-group">
                            <div className="agd-dropdown dropdown">
                                <button className="btn agd-drop-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    Payment Status {paymentFilter !== 'All' ? `(${paymentFilter})` : ''} <span className="agd-drop-arrow"><img src="/images/dropdown-right-icon.svg" alt="" /></span>
                                </button>
                                <ul className="dropdown-menu">
                                    <li><a className={`dropdown-item ${paymentFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentFilter('All'); }}>All</a></li>
                                    <li><a className={`dropdown-item ${paymentFilter === 'Partial' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentFilter('Partial'); }}>Partial</a></li>
                                    <li><a className={`dropdown-item ${paymentFilter === 'Pending' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentFilter('Pending'); }}>Pending</a></li>
                                    <li><a className={`dropdown-item ${paymentFilter === 'Paid' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPaymentFilter('Paid'); }}>Paid</a></li>
                                </ul>
                            </div>

                            <div className="agd-dropdown dropdown">
                                <button className="btn agd-drop-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    Patients Type {patientTypeFilter !== 'All' ? `(${patientTypeFilter})` : ''} <span className="agd-drop-arrow"><img src="/images/dropdown-right-icon.svg" alt="" /></span>
                                </button>
                                <ul className="dropdown-menu">
                                    <li><a className={`dropdown-item ${patientTypeFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPatientTypeFilter('All'); }}>All</a></li>
                                    <li><a className={`dropdown-item ${patientTypeFilter === 'Patients (Online)' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPatientTypeFilter('Patients (Online)'); }}>Patients (Online)</a></li>
                                    <li><a className={`dropdown-item ${patientTypeFilter === 'Clinic Patients' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setPatientTypeFilter('Clinic Patients'); }}>Clinic Patients</a></li>
                                </ul>
                            </div>

                            <div className="agd-dropdown dropdown">
                                <button className="btn agd-drop-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    Sessions Type {sessionTypeFilter !== 'All' ? `(${sessionTypeFilter})` : ''} <span className="agd-drop-arrow"><img src="/images/dropdown-right-icon.svg" alt="" /></span>
                                </button>
                                <ul className="dropdown-menu">
                                    <li><a className={`dropdown-item ${sessionTypeFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('All'); }}>All</a></li>
                                    <li><a className={`dropdown-item ${sessionTypeFilter === 'Adult Session' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Adult Session'); }}>Adult Session</a></li>
                                    <li><a className={`dropdown-item ${sessionTypeFilter === 'Couple Session' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Couple Session'); }}>Couple Session</a></li>
                                    <li><a className={`dropdown-item ${sessionTypeFilter === 'Child Session' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Child Session'); }}>Child Session</a></li>
                                    <li><a className={`dropdown-item ${sessionTypeFilter === 'Family Session' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Family Session'); }}>Family Session</a></li>
                                    <li><a className={`dropdown-item ${sessionTypeFilter === 'Coaching Session' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionTypeFilter('Coaching Session'); }}>Coaching Session</a></li>
                                </ul>
                            </div>

                            <div className="agd-dropdown dropdown">
                                <button className="btn agd-drop-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    Session Status {sessionStatusFilter !== 'All' ? `(${sessionStatusFilter})` : ''} <span className="agd-drop-arrow"><img src="/images/dropdown-right-icon.svg" alt="" /></span>
                                </button>
                                <ul className="dropdown-menu">
                                    <li><a className={`dropdown-item ${sessionStatusFilter === 'All' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionStatusFilter('All'); }}>All</a></li>
                                    <li><a className={`dropdown-item ${sessionStatusFilter === 'Upcoming' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionStatusFilter('Upcoming'); }}>Upcoming</a></li>
                                    <li><a className={`dropdown-item ${sessionStatusFilter === 'Completed' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionStatusFilter('Completed'); }}>Completed</a></li>
                                    <li><a className={`dropdown-item ${sessionStatusFilter === 'Cancelled' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionStatusFilter('Cancelled'); }}>Cancelled</a></li>
                                    <li><a className={`dropdown-item ${sessionStatusFilter === 'Reserved' ? 'active-filter' : ''}`} href="#" onClick={(e) => { e.preventDefault(); setSessionStatusFilter('Reserved'); }}>Reserved</a></li>
                                </ul>
                            </div>

                            <DateRangePicker
                                alignRight={true}
                                value={{ startDate: activeDate, endDate: new Date(activeDate.getTime() + 6 * 24 * 60 * 60 * 1000) }}
                                onChange={(range) => {
                                    if (range.startDate) {
                                        setActiveDate(range.startDate);
                                    }
                                }}
                            >
                                <button
                                    className="agd-calendar-btn"
                                    title="Filter by Date"
                                    type="button"
                                >
                                    <img src="/images/date-icon-small.svg" alt="" />
                                </button>
                            </DateRangePicker>
                        </div>
                    </div>

                    <div className="agd-scheduler-container">

                        <div className="agd-grid-header">
                            <div className="agd-time-header-cell"></div>
                            {weekDays.map((day, index) => (
                                <div key={index} className={day.headerClass}>
                                    <span className="agd-day-name">{day.name}</span>
                                    <span className="agd-day-number">{day.number}</span>
                                </div>
                            ))}
                        </div>

                        <div className="agd-grid-body">

                            <div className="agd-time-column">
                                {timeSlots.map((time, index) => (
                                    <span
                                        key={index}
                                        className="agd-time-label"
                                    >
                                        {time}
                                    </span>
                                ))}
                            </div>

                            <div className="agd-days-grid">

                                <div
                                    className="agd-current-time-line"
                                    style={{
                                        top: `${lineTop}px`,
                                    }}
                                >
                                    <span className="agd-current-time-label">
                                        {currentTimeText}
                                    </span>
                                </div>

                                {weekDays.map((day, dIndex) => {
                                    const dayEvents = events.filter(ev => {
                                        if (ev.dayIndex !== dIndex) return false;
                                        if (paymentFilter !== 'All' && ev.paymentStatus !== paymentFilter) return false;
                                        if (patientTypeFilter !== 'All' && ev.patientType !== patientTypeFilter) return false;
                                        if (sessionTypeFilter !== 'All' && ev.sessionType !== sessionTypeFilter) return false;
                                        if (sessionStatusFilter !== 'All' && ev.sessionStatus !== sessionStatusFilter) return false;
                                        return true;
                                    });

                                    return (
                                        <div key={dIndex} className={day.columnClass}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const rawData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
                                                if (!rawData) {
                                                    console.warn("No drag data found in dataTransfer");
                                                    return;
                                                }
                                                try {
                                                    const event = JSON.parse(rawData);
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const dropY = e.clientY - rect.top;
                                                    const slotIndex = Math.floor(dropY / SLOT_HEIGHT);
                                                    const newStartMinutes = calendarStartMinutes + slotIndex * 15;

                                                    const oldDuration = getMinutes(event.endTime) - getMinutes(event.startTime);
                                                    const durationMinutes = oldDuration > 0 ? oldDuration : 45;

                                                    const newStartStr = minutesToTimeStr(newStartMinutes);
                                                    const newEndStr = minutesToTimeStr(newStartMinutes + durationMinutes);
                                                    const targetDateStr = weekDays[dIndex].dateStr;

                                                    const appointmentId = String(event.id || event.appId || event.app_id);
                                                    const newSessionStartTime = format24HrWithSeconds(newStartMinutes);
                                                    const newSessionEndTime = format24HrWithSeconds(newStartMinutes + durationMinutes);

                                                    console.log(`Rescheduling appointment ${appointmentId}:`, {
                                                        new_session_date: targetDateStr,
                                                        new_session_start_time: newSessionStartTime,
                                                        new_session_end_time: newSessionEndTime,
                                                    });

                                                    // Update event position in calendar UI state
                                                    setEvents(prev => {
                                                        const exists = prev.some(ev => String(ev.id) === String(event.id) || String(ev.appId) === String(event.appId));
                                                        if (exists) {
                                                            return prev.map(ev => {
                                                                if (String(ev.id) === String(event.id) || String(ev.appId) === String(event.appId)) {
                                                                    return {
                                                                        ...ev,
                                                                        dayIndex: dIndex,
                                                                        startTime: newStartStr,
                                                                        endTime: newEndStr,
                                                                        session_date: targetDateStr
                                                                    };
                                                                }
                                                                return ev;
                                                            });
                                                        }
                                                        return [...prev, { ...event, dayIndex: dIndex, startTime: newStartStr, endTime: newEndStr, session_date: targetDateStr }];
                                                    });

                                                    const formData = new FormData();
                                                    formData.append('new_session_date', targetDateStr);
                                                    formData.append('new_session_start_time', newSessionStartTime);
                                                    formData.append('new_session_end_time', newSessionEndTime);

                                                    const res = await requestApi({
                                                        endpoint: `reschedule-appointment/${appointmentId}`,
                                                        method: 'POST',
                                                        data: formData,
                                                        isFormData: true,
                                                    });
                                                    console.log("Reschedule API response:", res);
                                                } catch (err) {
                                                    console.error("Error rescheduling appointment via drag & drop:", err);
                                                }
                                            }}
                                            onClick={(e) => {
                                                if (copiedEvent) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const clicky = e.clientY - rect.top;
                                                    const slotIndex = Math.floor(clicky / SLOT_HEIGHT);
                                                    const newStartMinutes = calendarStartMinutes + slotIndex * 15;
                                                    const durationMinutes = getMinutes(copiedEvent.endTime) - getMinutes(copiedEvent.startTime);

                                                    const newEvent = {
                                                        ...copiedEvent,
                                                        id: Date.now(),
                                                        dayIndex: dIndex,
                                                        startTime: minutesToTimeStr(newStartMinutes),
                                                        endTime: minutesToTimeStr(newStartMinutes + durationMinutes),
                                                    };

                                                    setEvents(prev => [...prev, newEvent]);
                                                    setCopiedEvent(null);
                                                } else {
                                                    setShowAgendaModal(true);
                                                }
                                            }}
                                        >
                                            {dayEvents.map((event) => {
                                                const cardStyle = getCardStyle(
                                                    event.startTime,
                                                    event.endTime
                                                );
                                                const overlapStyle = getOverlapStyle(event, dayEvents);

                                                return (
                                                    <div key={event.id}
                                                        draggable={true}
                                                        onDragStart={(e) => {
                                                            e.stopPropagation();
                                                            const jsonStr = JSON.stringify(event);
                                                            e.dataTransfer.setData('text/plain', jsonStr);
                                                            e.dataTransfer.setData('application/json', jsonStr);
                                                            e.dataTransfer.effectAllowed = 'move';
                                                        }}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.dataTransfer.dropEffect = 'move';
                                                        }}
                                                        className={`agd-event-card ${event.colorClass || 'agd-ev-light'}`}
                                                        style={{
                                                            top: `${cardStyle.top}px`,
                                                            height: `${cardStyle.height}px`,
                                                            backgroundColor: '#FAE2C8',
                                                            left: overlapStyle.left,
                                                            width: overlapStyle.width,
                                                            minWidth: '0px',
                                                            maxWidth: overlapStyle.width,
                                                            overflow: 'hidden',
                                                            boxSizing: 'border-box',
                                                            zIndex: activeCommentId === event.id ? 999 : 2,
                                                            cursor: 'grab',
                                                            padding: overlapStyle.count >= 3 ? '4px' : '8px 10px',
                                                            borderRadius: '1px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            justifyContent: 'space-between',
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const sessionId = event.appId || event.id;
                                                            const rawType = event?.patient_type || event?.rawPatientType || '';
                                                            if (rawType === "clinic_patient") {
                                                                router.push(`/back-to-agenda${sessionId ? `?therapy_session_id=${sessionId}` : ""}`);
                                                            } else {
                                                                router.push(`/final-back-to-agenda${sessionId ? `?therapy_session_id=${sessionId}` : ""}`);
                                                            }
                                                        }}
                                                    >
                                                        {/* Header: Time & Navigation Arrow */}
                                                        <div className="agd-ev-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                            <span className="agd-ev-time" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#2b2b2b' }}>
                                                                <img src="/images/agenda-clock-icon.svg" alt="" style={{ width: '13px', height: '13px' }} />
                                                                {formatDisplayTime(event.startTime)}-{formatDisplayTime(event.endTime)}
                                                            </span>
                                                            <button
                                                                className="right-agenda-icon"
                                                                style={{
                                                                    width: '24px',
                                                                    height: '24px',
                                                                    minWidth: '24px',
                                                                    minHeight: '24px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: '#ffffff',
                                                                    border: 'none',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                                    flexShrink: 0,
                                                                    padding: 0
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const sessionId = event.appId || event.id;
                                                                    const rawType = event?.patient_type || event?.rawPatientType || '';
                                                                    if (rawType === "clinic_patient") {
                                                                        router.push(`/back-to-agenda${sessionId ? `?therapy_session_id=${sessionId}` : ""}`);
                                                                    } else {
                                                                        router.push(`/final-back-to-agenda${sessionId ? `?therapy_session_id=${sessionId}` : ""}`);
                                                                    }
                                                                }}
                                                            >
                                                                <img src="/images/right-agenda-icon.svg" alt="" style={{ width: '12px', height: '12px' }} />
                                                            </button>
                                                        </div>

                                                        {/* Title & Age Row: Name • Age yrs */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                            <span className="agd-ev-title" title={event.name} style={{ fontSize: '12.5px', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {truncateName(event.name)}
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: '#666666', fontWeight: 600 }}>•</span>
                                                            <span className="agd-ev-age" style={{ fontSize: '11px', fontWeight: 500, color: '#555555', whiteSpace: 'nowrap' }}>
                                                                {event.age} yrs
                                                            </span>
                                                            <IoMdCopy
                                                                style={{ marginLeft: "auto", fontSize: "12px", cursor: "pointer", color: "#666666", flexShrink: 0 }}
                                                                className='agd-copy-btn'
                                                                title="Copy appointment"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCopiedEvent(event);
                                                                }}
                                                            />
                                                        </div>

                                                        {/* App. ID */}
                                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                                            <span className="agd-ev-id" style={{ fontSize: '10.5px', fontWeight: 500, color: '#333333' }}>
                                                                App. ID: {event.appId}
                                                            </span>
                                                            <span className="agd-tag" style={{ background: '#ffffff', color: '#1a1a1a', padding: '2px 8px', borderRadius: '12px', fontSize: '9.5px', fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                                                                {truncateName(event.type, 10)}
                                                            </span>
                                                        </div>

                                                        {/* Footer: Tags on Left, Comment Button on Right */}
                                                        <div className="agd-ev-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 'auto', paddingTop: '4px', gap: '4px' }}>
                                                            <div className="agd-ev-tags" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden' }}>

                                                                <span className={`agd-tag ${event.mode === 'Online' ? 'online' : 'person'}`} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '9.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <span className="dot-wht"></span>{event.mode == 'In_person' ? "In-Person" : event.mode}
                                                                </span>
                                                            </div>
                                                            <button
                                                                className="msg-agd-btn toggle-comment-btn"
                                                                title={event.comment ? `Comment: ${event.comment}` : "Add comment"}
                                                                style={{
                                                                    backgroundColor: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '50%',
                                                                    width: '24px',
                                                                    height: '24px',
                                                                    minWidth: '24px',
                                                                    minHeight: '24px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                                                    flexShrink: 0,
                                                                    padding: 0
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedCommentSession(event);
                                                                    setCommentInputText(event.comment || '');
                                                                    setShowCommentModal(true);
                                                                }}
                                                            >
                                                                <img src="/images/message-agenda-icon.svg" alt="Comment" style={{ width: '13px', height: '13px' }} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}

                            </div>
                        </div>
                    </div>


                </div>
            </main>

            {/* <AgendaCalendarPopup /> */}
            <AgendaCalendarPopup
                isOpen={showAgendaModal}
                onClose={() => setShowAgendaModal(false)}
                onSubmit={() => {
                    // Trigger refetch by updating activeDate state copy
                    setActiveDate(prev => new Date(prev));
                }}
            />

            {/* Add Comment Modal Popup (Design matching uploaded screenshot) */}
            {showCommentModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(2px)',
                    }}
                    onClick={() => setShowCommentModal(false)}
                >
                    <div
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '28px',
                            padding: '24px 28px',
                            width: '90%',
                            maxWidth: '440px',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3
                            style={{
                                margin: 0,
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#1a1a1a',
                                fontFamily: 'inherit',
                            }}
                        >
                            Add a comment
                        </h3>

                        <textarea
                            value={commentInputText}
                            onChange={(e) => setCommentInputText(e.target.value)}
                            placeholder="Add a comment the payment status..."
                            style={{
                                backgroundColor: '#f8f9fa',
                                border: 'none',
                                borderRadius: '18px',
                                padding: '16px',
                                width: '100%',
                                minHeight: '120px',
                                fontSize: '14px',
                                color: '#2d3748',
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box',
                            }}
                        />

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                marginTop: '4px',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setShowCommentModal(false)}
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1.5px solid #74505c',
                                    color: '#74505c',
                                    borderRadius: '30px',
                                    padding: '10px 32px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleCommentSubmit}
                                disabled={isCommentSubmitting}
                                style={{
                                    backgroundColor: '#74505c',
                                    border: 'none',
                                    color: '#ffffff',
                                    borderRadius: '30px',
                                    padding: '10px 32px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    opacity: isCommentSubmitting ? 0.7 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {isCommentSubmitting ? 'Submitting...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

const Agenda = () => {
    return (
        <Suspense fallback={<div className="p-4 text-center text-muted">Loading Agenda...</div>}>
            <AgendaContent />
        </Suspense>
    );
};

export default Agenda;
