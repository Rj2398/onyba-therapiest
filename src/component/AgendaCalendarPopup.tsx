"use client";
import React, { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { requestApi } from "@/src/utils/api";
import { GiLegArmor } from "react-icons/gi";

export interface Patient {
  id: string;
  name: string;
  userType?: string;
}

export interface Service {
  id: string;
  name: string;
  sessionType?: string;
  price?: number | string;
}

export interface Slot {
  id: number | string;
  start_time: string;
  end_time: string;
}

export interface DayAvailability {
  date: string;
  slots: Slot[];
}

export interface AgendaCalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string | number;
  isReschedule?: boolean;
  onSubmit?: (data: any) => void;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const AgendaCalendarPopup: React.FC<AgendaCalendarPopupProps> = ({
  isOpen,
  onClose,
  sessionId,
  isReschedule = false,
  onSubmit,
}) => {
  // Remote Data State
  const [patientList, setPatientList] = useState<Patient[]>([]);
  const [serviceList, setServiceList] = useState<Service[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, Slot[]>
  >({});

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [familyCount, setFamilyCount] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Status State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingAvailability, setIsLoadingAvailability] =
    useState<boolean>(false);

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(() =>
    new Date().getDate()
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const availableYears = useMemo(() => {
    const baseYear = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => baseYear - 2 + i);
  }, []);

  const selectedDateString = useMemo(() => {
    if (!selectedDay) return "";
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(selectedDay).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }, [year, month, selectedDay]);

  const currentAvailableSlots = useMemo(() => {
    if (!selectedDateString || !availabilityMap[selectedDateString]) return [];
    return availabilityMap[selectedDateString];
  }, [selectedDateString, availabilityMap]);

  // Selected slot entity
  const selectedSlot = useMemo(() => {
    return (
      currentAvailableSlots.find((s) => String(s.id) === selectedSlotId) || null
    );
  }, [currentAvailableSlots, selectedSlotId]);

  const formatSlotTime = (timeStr: string) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    return `${parts[0]}:${parts[1]}`;
  };

  // 1. Fetch Patients Dropdown
  useEffect(() => {
    if (!isOpen) return;

    const fetchPatients = async () => {
      try {
        const formData = new FormData();
        const res = await requestApi({
          endpoint: "get-patients-dropdown",
          method: "POST",
          data: formData,
          isFormData: true,
        });

        if (
          res &&
          (res.success || res.code === 200) &&
          Array.isArray(res.data)
        ) {
          const list = res.data
            .filter(
              (item: any) => item?.name && String(item.name).trim() !== ""
            )
            .map((item: any) => ({
              id: String(item.id),
              name: String(item.name).trim(),
              userType: item.userType || "clinic_patient",
            }));

          setPatientList(list);
          if (list.length > 0) {
            setSelectedPatientId((prev) => (prev ? prev : list[0].id));
          }
        }
      } catch (err) {
        console.error("Error fetching patients dropdown:", err);
      }
    };

    fetchPatients();
  }, [isOpen]);

  // 2. Fetch Session Types
  useEffect(() => {
    if (!isOpen) return;

    const fetchServices = async () => {
      try {
        const res = await requestApi({
          endpoint: "get-session-type",
          method: "POST",
        });

        const list =
          res?.data?.session_types ||
          (Array.isArray(res?.data) ? res.data : []);

        if (Array.isArray(list) && list.length > 0) {
          const formatted = list.map((item: any) => ({
            id: String(item.id),
            name: item.name || `Service #${item.id}`,
            sessionType: item.session_type || item.name || "Session",
            price: item.price ?? 0,
          }));

          setServiceList(formatted);
          if (formatted.length > 0) {
            setSelectedServiceId((prev) => (prev ? prev : formatted[0].id));
          }
        }
      } catch (err) {
        console.error("Error fetching session types:", err);
      }
    };

    fetchServices();
  }, [isOpen]);

  // 3. Fetch Therapist Availability
  useEffect(() => {
    if (!isOpen) return;

    const fetchAvailability = async () => {
      setIsLoadingAvailability(true);
      try {
        const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
        const formData = new FormData();
        formData.append("year_month", yearMonth);

        const res = await requestApi({
          endpoint: "get-therapist-availability",
          method: "POST",
          data: formData,
          isFormData: true,
        });

        if (res && (res.success || res.code === 200) && res.data) {
          setHolidays(res.data.holidays || []);

          const map: Record<string, Slot[]> = {};
          if (Array.isArray(res.data.availability)) {
            res.data.availability.forEach((dayData: DayAvailability) => {
              map[dayData.date] = dayData.slots || [];
            });
          }
          setAvailabilityMap(map);
        }
      } catch (err) {
        console.error("Error fetching therapist availability:", err);
      } finally {
        setIsLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [isOpen, year, month]);

  // Auto select valid slot when current day slots update
  useEffect(() => {
    if (currentAvailableSlots.length > 0) {
      const isCurrentStillValid = currentAvailableSlots.some(
        (s) => String(s.id) === selectedSlotId
      );
      if (!isCurrentStillValid) {
        setSelectedSlotId(String(currentAvailableSlots[0].id));
      }
    } else {
      setSelectedSlotId("");
    }
  }, [currentAvailableSlots]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
    setSelectedSlotId("");
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
    setSelectedSlotId("");
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    setCurrentDate(new Date(year, newMonth, 1));
    setSelectedDay(null);
    setSelectedSlotId("");
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    setCurrentDate(new Date(newYear, month, 1));
    setSelectedDay(null);
    setSelectedSlotId("");
  };

  const selectedPatient = patientList.find(
    (p) => String(p.id) === String(selectedPatientId)
  );
  const selectedService = serviceList.find(
    (s) => String(s.id) === String(selectedServiceId)
  );

  const isFamilyService = useMemo(() => {
    return selectedService?.name?.toLowerCase().includes("family");
  }, [selectedService]);

  const formatSummaryDate = () => {
    if (!selectedDay) return "-";
    return `${MONTH_NAMES[month]} ${selectedDay}, ${year}`;
  };

  const formatDisplayTime = () => {
    if (!selectedSlot) return "-";

    const to12Hr = (timeStr: string) => {
      if (!timeStr) return "";
      const [hStr, mStr] = timeStr.split(":");
      const hour = parseInt(hStr, 10);
      const period = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
      return `${formattedHour}:${mStr} ${period}`;
    };

    return `${to12Hr(selectedSlot.start_time)} - ${to12Hr(
      selectedSlot.end_time
    )}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatientId) {
      toast.error("Please select a patient.");
      return;
    }
    if (!selectedDay) {
      toast.error("Please select a date from the calendar.");
      return;
    }
    if (!selectedSlot) {
      toast.error("Please select a time slot.");
      return;
    }
    if (!selectedServiceId) {
      toast.error("Please select a service.");
      return;
    }
    if (isFamilyService && (!familyCount || Number(familyCount) <= 0)) {
      toast.error("Please enter a valid family count.");
      return;
    }

    setIsSubmitting(true);

    try {
      const session_date = selectedDateString;
      // Pick exact start_time and end_time directly from the chosen slot
      const session_start_time = selectedSlot.start_time;
      const session_end_time = selectedSlot.end_time;
      const patient_type = "clinic_patient";

      if (isReschedule && sessionId) {
        const formData = new FormData();
        formData.append("new_session_date", session_date);
        formData.append("new_session_start_time", session_start_time);
        formData.append("new_session_end_time", session_end_time);

        const response = await requestApi({
          endpoint: `reschedule-appointment/${sessionId}`,
          method: "POST",
          data: formData,
          isFormData: true,
        });

        if (
          response &&
          (response.success || response.code === 200 || response.status)
        ) {
          toast.success("Appointment rescheduled successfully!");
          if (onSubmit) onSubmit(response.data);
          onClose();
        } else {
          toast.error(response?.message || "Failed to reschedule appointment");
        }
        return;
      }

      // Payload matching Laravel API validator rules
      const formData = new FormData();
      formData.append("patient_id", String(selectedPatientId));
      formData.append("service_id", String(selectedServiceId));
      formData.append("patient_type", patient_type);
      formData.append("session_date", session_date);
      formData.append("session_start_time", session_start_time);
      formData.append("session_end_time", session_end_time);

      if (selectedService?.price !== undefined) {
        formData.append("session_amount", String(selectedService.price));
      }

      if (isFamilyService && familyCount) {
        formData.append("family_count", String(familyCount));
      }

      if (remarks) {
        formData.append("remarks", remarks);
      }

      const response = await requestApi({
        endpoint: "create-appointment",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (
        response &&
        (response.success)
      ) {
        toast.success("Appointment created successfully!");
        if (onSubmit) {
          onSubmit({
            ...response.data,
            patient_id: selectedPatientId,
            service_id: selectedServiceId,
            patient_type,
            session_date,
            session_start_time,
            session_end_time,
            session_amount: selectedService?.price,
            family_count: isFamilyService ? familyCount : null,
            remarks,
          });
        }
        onClose();
      } else {
        toast.error(response?.message || "Failed to create appointment");
      }
    } catch (err: any) {
      console.error("Error creating appointment:", err);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Error processing request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal show agd-custom-modal d-block">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3
                  className="modal-title fw-bold"
                  id="exampleModalLabel"
                  style={{ color: "#212529", marginBottom: "5px" }}
                >
                  {isReschedule
                    ? "Reschedule Appointment"
                    : "Create Appointment"}
                </h3>
                <p
                  className="text-muted small"
                  style={{ margin: "0", fontSize: "15px" }}
                >
                  Book the agenda for the user.
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <form id="agdPopupForm" onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Patient Selection */}
                <div className="agd-popup-form-group">
                  <label className="agd-popup-label">Patient Name*</label>
                  <select
                    className="agd-popup-select"
                    id="agdPatientField"
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                  >
                    <option value="" disabled>
                      {patientList.length === 0
                        ? "Loading patients..."
                        : "Select patient"}
                    </option>
                    {patientList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="agd-popup-flex-row">
                  {/* Calendar Column */}
                  <div className="agd-popup-flex-col-left">
                    <label className="agd-popup-label">Pick a Date*</label>
                    <div className="agd-popup-calendar-box">
                      <div
                        className="agd-popup-calendar-nav"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            alignItems: "center",
                          }}
                        >
                          <select
                            className="form-select form-select-sm"
                            value={month}
                            onChange={handleMonthChange}
                            style={{
                              fontSize: "13px",
                              padding: "2px 20px 2px 8px",
                              width: "auto",
                            }}
                          >
                            {MONTH_NAMES.map((name, idx) => (
                              <option key={name} value={idx}>
                                {name}
                              </option>
                            ))}
                          </select>

                          <select
                            className="form-select form-select-sm"
                            value={year}
                            onChange={handleYearChange}
                            style={{
                              fontSize: "13px",
                              padding: "2px 20px 2px 8px",
                              width: "auto",
                            }}
                          >
                            {availableYears.map((yr) => (
                              <option key={yr} value={yr}>
                                {yr}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div
                          className="agd-popup-calendar-icons"
                          style={{
                            display: "flex",
                            gap: "12px",
                            alignItems: "center",
                          }}
                        >
                          <img
                            src="/images/left-icon-agenda.svg"
                            alt="Previous Month"
                            onClick={handlePrevMonth}
                            style={{
                              cursor: "pointer",
                              width: "14px",
                              height: "14px",
                            }}
                          />
                          <img
                            src="/images/right-icon-agenda.svg"
                            alt="Next Month"
                            onClick={handleNextMonth}
                            style={{
                              cursor: "pointer",
                              width: "14px",
                              height: "14px",
                            }}
                          />
                        </div>
                      </div>

                      {/* Day Grid */}
                      <div className="agd-popup-calendar-days-wrapper">
                        <div className="agd-popup-day-cell agd-popup-day-header">
                          Mon
                        </div>
                        <div className="agd-popup-day-cell agd-popup-day-header">
                          Tue
                        </div>
                        <div className="agd-popup-day-cell agd-popup-day-header">
                          Wed
                        </div>
                        <div className="agd-popup-day-cell agd-popup-day-header">
                          Thur
                        </div>
                        <div className="agd-popup-day-cell agd-popup-day-header">
                          Fri
                        </div>
                        <div className="agd-popup-day-cell agd-popup-day-header">
                          Sat
                        </div>
                        <div className="agd-popup-day-cell agd-popup-day-header">
                          Sun
                        </div>

                        {Array.from({ length: startOffset }).map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className="agd-popup-day-cell"
                          />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const mm = String(month + 1).padStart(2, "0");
                          const dd = String(day).padStart(2, "0");
                          const dateKey = `${year}-${mm}-${dd}`;

                          const isHoliday = holidays.includes(dateKey);
                          const isSelected = selectedDay === day;

                          const className = `agd-popup-day-cell agd-popup-day-clickable ${isSelected ? "agd-popup-day-active" : ""
                            }`;

                          return (
                            <div
                              key={day}
                              className={className}
                              style={{
                                cursor: "pointer",
                                textDecoration: isHoliday
                                  ? "line-through"
                                  : "none",
                              }}
                              onClick={() => setSelectedDay(day)}
                              title={isHoliday ? "Holiday" : ""}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Available Time Slots Column */}
                  <div className="agd-popup-flex-col-right">
                    <label className="agd-popup-label">Available Times*</label>
                    <div className="agd-popup-time-slots-container">
                      {isLoadingAvailability ? (
                        <p className="text-muted small p-2">Loading slots...</p>
                      ) : currentAvailableSlots.length === 0 ? (
                        <p className="text-muted small p-2">
                          {selectedDay
                            ? "No slots available for this date."
                            : "Select a date to view slots."}
                        </p>
                      ) : (
                        currentAvailableSlots.map((slot) => {
                          const startTime = formatSlotTime(slot.start_time);
                          const endTime = formatSlotTime(slot.end_time);
                          const slotLabel = `${startTime} - ${endTime}`;

                          return (
                            <div
                              className="agd-popup-time-checkbox-wrapper"
                              key={slot.id}
                            >
                              <input
                                type="checkbox"
                                name="time_slots"
                                value={String(slot.id)}
                                className="agd-popup-time-input"
                                checked={selectedSlotId === String(slot.id)}
                                onChange={() =>
                                  setSelectedSlotId(String(slot.id))
                                }
                              />
                              <span className="agd-popup-time-label">
                                {slotLabel}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Service Selection */}
                <div className="agd-popup-form-group">
                  <label className="agd-popup-label">Service Name*</label>
                  <select
                    className="agd-popup-select"
                    id="agdServiceField"
                    required
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                  >
                    <option value="" disabled>
                      {serviceList.length === 0
                        ? "Loading services..."
                        : "Select service"}
                    </option>
                    {serviceList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.price !== undefined ? `($${s.price})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conditional Family Count Field */}
                {isFamilyService && (
                  <div className="agd-popup-form-group">
                    <label className="agd-popup-label">Family Count*</label>
                    <input
                      type="number"
                      min="1"
                      className="agd-popup-select"
                      placeholder="Enter number of family members"
                      value={familyCount}
                      required
                      onChange={(e) => setFamilyCount(e.target.value)}
                    />
                  </div>
                )}

                {/* Remarks Field */}
                <div className="agd-popup-form-group">
                  <label className="agd-popup-label">Add Remarks</label>
                  <textarea
                    className="agd-popup-textarea"
                    rows={3}
                    placeholder="Enter remarks or notes here"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                {/* Session Summary Card */}
                <div className="agd-popup-form-group">
                  <h5 className="agd-popup-summary-title">Session Summary</h5>
                  <div className="agd-popup-summary-card">
                    <div className="agd-popup-summary-item">
                      <span className="agd-popup-summary-lbl">User Type</span>
                      <span className="agd-popup-summary-val">
                        clinic_patient
                      </span>
                    </div>
                    <div className="agd-popup-summary-item">
                      <span className="agd-popup-summary-lbl">
                        Patient Name
                      </span>
                      <span
                        className="agd-popup-summary-val"
                        id="agdSummaryPatient"
                      >
                        {selectedPatient?.name || "-"}
                      </span>
                    </div>
                    <div className="agd-popup-summary-item">
                      <span className="agd-popup-summary-lbl">
                        Session Date
                      </span>
                      <span
                        className="agd-popup-summary-val"
                        id="agdSummaryDate"
                      >
                        {formatSummaryDate()}
                      </span>
                    </div>
                    <div className="agd-popup-summary-item">
                      <span className="agd-popup-summary-lbl">
                        Session Time
                      </span>
                      <span
                        className="agd-popup-summary-val"
                        id="agdSummaryTime"
                      >
                        {formatDisplayTime()}
                      </span>
                    </div>
                    <div className="agd-popup-summary-item">
                      <span className="agd-popup-summary-lbl">
                        Session Type
                      </span>
                      <span className="agd-popup-summary-val">
                        {selectedService?.sessionType || "-"}
                      </span>
                    </div>
                    {isFamilyService && (
                      <div className="agd-popup-summary-item">
                        <span className="agd-popup-summary-lbl">
                          Family Members
                        </span>
                        <span className="agd-popup-summary-val">
                          {familyCount || "-"}
                        </span>
                      </div>
                    )}
                    {selectedService?.price !== undefined && (
                      <div className="agd-popup-summary-item">
                        <span className="agd-popup-summary-lbl">
                          Session Amount
                        </span>
                        <span className="agd-popup-summary-val">
                          ${selectedService.price}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="submit"
                  className="agd-popup-btn-submit"
                  disabled={isSubmitting || !selectedSlot}
                  style={{ opacity: isSubmitting || !selectedSlot ? 0.7 : 1 }}
                >
                  {isSubmitting
                    ? isReschedule
                      ? "Rescheduling..."
                      : "Creating..."
                    : isReschedule
                      ? "Reschedule appointment"
                      : "Create appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div
        className="modal-backdrop fade show"
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
};

export default AgendaCalendarPopup;
