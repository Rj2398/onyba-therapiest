"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { requestApi } from "@/src/utils/api";
import toast from "react-hot-toast";

export interface TherapistNotification {
  id: number;
  patient_id: number | null;
  therapist_id: number;
  therapy_session_id: number | null;
  type: string;
  title: string;
  message: string;
  is_read: number | boolean;
  created_at: string;
  updated_at?: string;
  category?: string;
  time?: string;
  isRead?: boolean;
}

export const isNotificationUnread = (notification: TherapistNotification): boolean => {
  return (
    notification.is_read === 0 ||
    notification.is_read === false ||
    notification.isRead === false
  );
};

export interface NotificationPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export const formatTimeAgo = (dateStr?: string): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffInSeconds = Math.max(
      0,
      Math.floor((now.getTime() - date.getTime()) / 1000)
    );

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "1d ago";
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export const formatNotificationType = (type?: string): string => {
  if (!type) return "Appointments";
  const normalized = type.toLowerCase().trim();

  const mapping: Record<string, string> = {
    paid_session_booked: "Appointments",
    pre_session_incomplete: "Appointments",
    session_booked: "Appointments",
    appointment_scheduled: "Appointments",
    billing: "Billing",
    paid_invoice: "Billing",
    invoice_paid: "Billing",
    overdue: "Overdue",
    invoice_overdue: "Overdue",
    general: "General",
  };

  if (mapping[normalized]) {
    return mapping[normalized];
  }

  return type
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

const NotificationDropdown: React.FC = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"All" | "Unread">("All");
  const [notifications, setNotifications] = useState<TherapistNotification[]>([]);
  const [apiUnreadCount, setApiUnreadCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [markingReadIds, setMarkingReadIds] = useState<number[]>([]);
  const [pagination, setPagination] = useState<NotificationPagination>({
    current_page: 1,
    per_page: 10,
    total: 0,
    last_page: 1,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (page = 1, append = false) => {
      try {
        if (page === 1 && !append) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        const formData = new FormData();
        formData.append("page", String(page));
        formData.append("limit", "10");

        const response = await requestApi({
          endpoint: "get-therapist-notification",
          method: "POST",
          data: formData,
          isFormData: true,
        });

        if (response && response.success && response.data) {
          let list: TherapistNotification[] = [];
          if (Array.isArray(response.data.notifications)) {
            list = response.data.notifications;
          } else if (Array.isArray(response.data)) {
            list = response.data;
          }

          if (append) {
            setNotifications((prev) => {
              const existingIds = new Set(prev.map((n) => n.id));
              const uniqueNew = list.filter((n) => !existingIds.has(n.id));
              return [...prev, ...uniqueNew];
            });
          } else {
            setNotifications(list);
          }

          const pag = response.data.pagination;
          if (pag) {
            setPagination({
              current_page: Number(pag.current_page) || page,
              per_page: Number(pag.per_page) || 10,
              total: Number(pag.total) || list.length,
              last_page: Number(pag.last_page) || 1,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching therapist notifications:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await requestApi({
        endpoint: "unread-notification-count",
        method: "POST",
      });
      if (response && response.success && response.data) {
        const count = Number(response.data.unread_count);
        if (!isNaN(count)) {
          setApiUnreadCount(count);
        }
      }
    } catch (e) {
      console.error("Error fetching unread notification count in dropdown:", e);
    }
  }, []);

  // Listen to unread count updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent?.detail === "number") {
        setApiUnreadCount(customEvent.detail);
      }
    };
    window.addEventListener("unreadNotificationCountUpdated", handleUpdate);
    return () => {
      window.removeEventListener("unreadNotificationCountUpdated", handleUpdate);
    };
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications(1, false);
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Refresh when opening dropdown
  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications(1, false);
      fetchUnreadCount();
    }
  };

  // Mark single notification as read
  const handleMarkAsRead = async (
    notificationId: number,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }

    if (markingReadIds.includes(notificationId)) return;

    setMarkingReadIds((prev) => [...prev, notificationId]);

    // Optimistically update
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, is_read: 1 } : item
      )
    );
    setApiUnreadCount((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));

    try {
      const formData = new FormData();
      formData.append("notification_id", String(notificationId));

      const response = await requestApi({
        endpoint: "mark-notification-as-read",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && response.success) {
        toast.success(response.message || "Notification marked as read");
      } else {
        toast.error(response?.message || "Failed to mark as read");
        // Revert
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId ? { ...item, is_read: 0 } : item
          )
        );
      }
    } catch (error: unknown) {
      console.error("Error marking notification as read:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err?.response?.data?.message || "Failed to mark notification as read"
      );
      // Revert
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: 0 } : item
        )
      );
    } finally {
      setMarkingReadIds((prev) => prev.filter((id) => id !== notificationId));
    }
  };

  // Handle clicking on notification card
  const handleNotificationClick = (notification: TherapistNotification) => {
    const isUnread = isNotificationUnread(notification);

    if (isUnread) {
      handleMarkAsRead(notification.id);
    }

    if (notification.therapy_session_id) {
      setIsOpen(false);
      router.push(
        `/final-back-to-agenda?session_id=${notification.therapy_session_id}`
      );
    } else if (notification.patient_id) {
      setIsOpen(false);
      router.push(`/patient-profile?id=${notification.patient_id}`);
    }
  };

  const handleLoadMore = () => {
    if (pagination.current_page < pagination.last_page && !isLoadingMore) {
      fetchNotifications(pagination.current_page + 1, true);
    }
  };

  // Unread count
  const unreadCount =
    apiUnreadCount !== null
      ? apiUnreadCount
      : notifications.filter((item) => isNotificationUnread(item)).length;

  // Filtered notifications
  const filteredNotifications =
    activeTab === "All"
      ? notifications
      : notifications.filter((item) => isNotificationUnread(item));

  return (
    <div className="gl-notification-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="gl-action-item gl-notification-trigger"
        id="glNotificationTrigger"
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <img
          src="/images/notification-icon.svg"
          alt="Notifications"
          className="gl-header-icon"
        />
        {unreadCount > 0 && (
          <span className="gl-noti-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <div
        className={`gl-notification-panel ${isOpen ? "show" : ""}`}
        id="glNotificationPanel"
      >
        <div className="gl-noti-header">
          <h3>Notifications</h3>
        </div>

        <div
          className="gl-noti-filters"
          style={{ position: "relative", zIndex: 10 }}
        >
          <button
            type="button"
            className={
              activeTab === "All"
                ? "gl-filter-btn active"
                : "gl-filter-btn outline"
            }
            style={{
              cursor: "pointer",
              pointerEvents: "auto",
              position: "relative",
              zIndex: 11,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveTab("All");
            }}
            onClickCapture={(e) => {
              e.stopPropagation();
              setActiveTab("All");
            }}
            onPointerDownCapture={(e) => {
              e.stopPropagation();
              setActiveTab("All");
            }}
          >
            All
          </button>
          <button
            type="button"
            className={
              activeTab === "Unread"
                ? "gl-filter-btn active"
                : "gl-filter-btn outline"
            }
            style={{
              cursor: "pointer",
              pointerEvents: "auto",
              position: "relative",
              zIndex: 11,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveTab("Unread");
            }}
            onClickCapture={(e) => {
              e.stopPropagation();
              setActiveTab("Unread");
            }}
            onPointerDownCapture={(e) => {
              e.stopPropagation();
              setActiveTab("Unread");
            }}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="gl-noti-list">
          {isLoading && notifications.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 15px",
                color: "#64748b",
              }}
            >
              <div
                className="spinner-border spinner-border-sm text-secondary me-2"
                role="status"
                style={{ width: "1.2rem", height: "1.2rem", color: "#704f5a" }}
              />
              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                Loading notifications...
              </span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 15px",
                color: "#64748b",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#74505c",
                }}
              >
                {activeTab === "Unread"
                  ? "No unread notifications"
                  : "No notifications available"}
              </p>
            </div>
          ) : (
            <>
              {filteredNotifications.map((notification) => {
                const isUnread = isNotificationUnread(notification);
                const isMarking = markingReadIds.includes(notification.id);

                return (
                  <div
                    key={notification.id}
                    className={`gl-noti-item ${isUnread ? "unread" : ""}`}
                    style={{
                      cursor:
                        notification.therapy_session_id ||
                        notification.patient_id
                          ? "pointer"
                          : "default",
                      opacity: isUnread ? 1 : 0.85,
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div
                      className="gl-noti-content"
                      style={{ flex: 1, paddingRight: "10px" }}
                    >
                      <p className="gl-noti-title">
                        {notification.title}
                        {isUnread && <span className="gl-dot"></span>}
                      </p>

                      {notification.message && (
                        <p
                          className="gl-noti-desc"
                          style={{
                            fontSize: "13px",
                            color: "#64748b",
                            margin: "2px 0 6px 0",
                            lineHeight: "1.35",
                            wordBreak: "break-word",
                          }}
                        >
                          {notification.message}
                        </p>
                      )}

                      <span className="gl-noti-meta">
                        {notification.category ||
                          formatNotificationType(notification.type)}{" "}
                        •{" "}
                        {notification.time ||
                          formatTimeAgo(notification.created_at)}
                      </span>
                    </div>

                    {isUnread && (
                      <button
                        type="button"
                        className="gl-mark-read"
                        disabled={isMarking}
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        onClickCapture={(e) => e.stopPropagation()}
                        style={{
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          opacity: isMarking ? 0.6 : 1,
                          cursor: isMarking ? "not-allowed" : "pointer",
                          pointerEvents: "auto",
                          position: "relative",
                          zIndex: 5,
                        }}
                      >
                        {isMarking ? "Marking..." : "Mark as read"}
                      </button>
                    )}
                  </div>
                );
              })}

              {pagination.current_page < pagination.last_page &&
                activeTab === "All" && (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      style={{
                        background: "transparent",
                        border: "1px solid #74505c66",
                        borderRadius: "20px",
                        padding: "6px 20px",
                        fontSize: "13px",
                        color: "#4c2834",
                        cursor: isLoadingMore ? "not-allowed" : "pointer",
                        fontWeight: 500,
                        transition: "all 0.2s",
                      }}
                    >
                      {isLoadingMore ? "Loading more..." : "Load More"}
                    </button>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDropdown;
