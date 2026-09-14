"use client";
import React, { useState, useRef, useEffect } from 'react';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
  children?: React.ReactNode;
  alignRight?: boolean;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select Date Range',
  children,
  alignRight = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default to current date if no value provided
  const [currentDate, setCurrentDate] = useState(
    value?.startDate || new Date()
  );

  const [startDate, setStartDate] = useState<Date | null>(value?.startDate || null);
  const [endDate, setEndDate] = useState<Date | null>(value?.endDate || null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Sync internal state if prop value changes
  useEffect(() => {
    if (value) {
      setStartDate(value.startDate);
      setEndDate(value.endDate);
      if (value.startDate) {
        setCurrentDate(value.startDate);
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthYearString = `${monthNames[month]} ${year}`;

  const handleDayClick = (day: number) => {
    const selectedDate = new Date(year, month, day);

    if (!startDate || (startDate && endDate)) {
      // Start a new range
      setStartDate(selectedDate);
      setEndDate(null);
    } else if (startDate && !endDate) {
      // Finish the range
      if (selectedDate < startDate) {
        setEndDate(startDate);
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setHoverDate(null);

    onChange?.({
      startDate: null,
      endDate: null,
    });

    // setIsOpen(false);
  };

  const handleSubmit = () => {
    if (!startDate || !endDate) return;

    onChange?.({
      startDate,
      endDate,
    });

    setIsOpen(false);
  };

  const isDateInRange = (date: Date) => {
    if (startDate && endDate) {
      return date >= startDate && date <= endDate;
    }
    if (startDate && hoverDate && !endDate) {
      const start = startDate < hoverDate ? startDate : hoverDate;
      const end = startDate > hoverDate ? startDate : hoverDate;
      return date >= start && date <= end;
    }
    return false;
  };

  const isSameDate = (d1: Date | null, d2: Date) => {
    if (!d1) return false;
    return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return `${date.getDate()} ${monthNames[date.getMonth()].substring(0, 3)} ${date.getFullYear()}`;
  };

  const displayValue = startDate
    ? `${formatDate(startDate)} - ${endDate ? formatDate(endDate) : '...'}`
    : placeholder;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <div onClick={() => setIsOpen(!isOpen)}>
        {children ? (
          children
        ) : (
          <button
            type="button"
            className="agd-popup-select"
            style={{
              width: '100%',
              minWidth: '220px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fff',
              border: '1px solid #ced4da',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: startDate ? '#212529' : '#6c757d',
            }}
          >
            <span>{displayValue}</span>
            <img src="/images/date-icon-small.svg" alt="Calendar" style={{ width: '16px' }} />
          </button>
        )}
      </div>

      {/* Popover Calendar */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: alignRight ? 0 : undefined,
            left: alignRight ? 'auto' : '-85px',
            zIndex: 1050,
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: '16px',
            width: '320px',
            border: '1px solid #eee'
          }}
        >
          <div className="agd-popup-calendar-box" style={{ width: '100%' }}>
            <div className="agd-popup-calendar-nav">
              <span>{monthYearString}</span>
              <div className="agd-popup-calendar-icons" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <img
                  src="/images/left-icon-agenda.svg"
                  alt="Previous Month"
                  onClick={handlePrevMonth}
                  style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                />
                <img
                  src="/images/right-icon-agenda.svg"
                  alt="Next Month"
                  onClick={handleNextMonth}
                  style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                />
              </div>
            </div>

            <div className="agd-popup-calendar-days-wrapper">
              <div className="agd-popup-day-cell agd-popup-day-header">Mon</div>
              <div className="agd-popup-day-cell agd-popup-day-header">Tue</div>
              <div className="agd-popup-day-cell agd-popup-day-header">Wed</div>
              <div className="agd-popup-day-cell agd-popup-day-header">Thur</div>
              <div className="agd-popup-day-cell agd-popup-day-header">Fri</div>
              <div className="agd-popup-day-cell agd-popup-day-header">Sat</div>
              <div className="agd-popup-day-cell agd-popup-day-header">Sun</div>

              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="agd-popup-day-cell"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const currentCellDate = new Date(year, month, day);

                const isStart = isSameDate(startDate, currentCellDate);
                const isEnd = isSameDate(endDate, currentCellDate);
                const inRange = isDateInRange(currentCellDate);

                let className = 'agd-popup-day-cell agd-popup-day-clickable';

                if (isStart || isEnd) {
                  className += ' agd-popup-day-active';
                }

                // Add inline styling for dates within the range to match the active color but lighter
                const rangeStyle: React.CSSProperties = (inRange && !isStart && !isEnd)
                  ? { backgroundColor: '#eef2ff', color: '#4f46e5', borderRadius: '4px' }
                  : {};

                return (
                  <div
                    key={day}
                    className={className}
                    style={rangeStyle}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => {
                      if (startDate && !endDate) {
                        setHoverDate(currentCellDate);
                      }
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: "8px 18px",
                border: "1px solid #d1d5db",
                background: "#fff",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>

            <button
              type="button"
              disabled={!startDate || !endDate}
              onClick={handleSubmit}
              style={{
                padding: "8px 18px",
                border: "none",
                background: !startDate || !endDate ? "#bdbdbd" : "#4f46e5",
                color: "#fff",
                borderRadius: "6px",
                cursor: !startDate || !endDate ? "not-allowed" : "pointer",
              }}
            >
              Submit
            </button>
          </div>
        </div>


      )}



    </div>
  );
};

export default DateRangePicker;
