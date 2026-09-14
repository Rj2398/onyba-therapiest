"use client";
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { requestApi } from '@/src/utils/api';

export interface CancelSessionPopupProps {
  sessionId?: string | number;
  sessionData?: any;
  onSuccess?: () => void;
}

const CancelSessionPopup: React.FC<CancelSessionPopupProps> = ({
  sessionId,
  sessionData,
  onSuccess,
}) => {
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveSessionId = sessionId || sessionData?.id || sessionData?.patient_id || '50';

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please enter a cancellation reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('cancel_reason', cancelReason.trim());

      const res = await requestApi({
        endpoint: `cancel-session/${effectiveSessionId}`,
        method: 'POST',
        data: formData,
        isFormData: true,
      });

      if (res && (res.success || res.code === 200 || res.status)) {
        toast.success('Session cancelled successfully.');
        setCancelReason('');
        if (onSuccess) onSuccess();
      } else {
        toast.error(res?.message || 'Failed to cancel session');
      }
    } catch (err: any) {
      console.error('Error cancelling session:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Error cancelling session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal fade" id="cancelSessionModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered onyba-cancel-dialog">
          <div className="modal-content onyba-cancel-content">

            <button type="button" className="onyba-cancel-close-cross" data-bs-dismiss="modal" aria-label="Close">
              <img src="images/close-btn-popup.svg" alt="&times;" />
            </button>

            <div className="modal-body onyba-cancel-body">

              <div className="onyba-cancel-icon-circle">
                <img src="images/cross-session-icon.svg" alt="&times;" />
              </div>

              <h5 className="onyba-cancel-title">Cancel Session?</h5>

              <p className="onyba-cancel-desc">
                Are you sure you want to cancel this session?<br />
                The patient will be notified and any applicable policies will apply.
              </p>

              <div className="onyba-cancel-patient-chip">
                <div className="onyba-cancel-meta-profile">
                  <img src="images/user-sesion-profile.svg" alt={sessionData?.name || "Patient"} className="onyba-cancel-avatar" />
                  <div className="onyba-cancel-profile-text">
                    <h6>{sessionData?.name || "John Doe"}</h6>
                    <span>{sessionData?.age ? `${sessionData.age} yrs` : "18 yrs"}</span>
                  </div>
                </div>

                <div className="onyba-cancel-meta-item">
                  <span className="onyba-cancel-meta-icon"><img src="images/session-date-time.svg" alt="" /></span>
                  <div className="onyba-cancel-meta-text">
                    <strong>Date & Time</strong>
                    <span>{sessionData?.session_date ? new Date(sessionData.session_date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "Apr 26, 2026"}</span>
                    <span>{sessionData?.session_start_time || "2:00 PM"}</span>
                  </div>
                </div>

                <div className="onyba-cancel-meta-item">
                  <span className="onyba-cancel-meta-icon"><img src="images/session-type.svg" alt="" /></span>
                  <div className="onyba-cancel-meta-text">
                    <strong>Session Type</strong>
                    <span className="onyba-cancel-type-badge">{sessionData?.service_name || "In-Person"}</span>
                  </div>
                </div>
              </div>

              <div className="onyba-cancel-input-block">
                <label className="onyba-cancel-label">Reason for cancellation</label>
                <textarea
                  className="onyba-cancel-textarea"
                  placeholder="Share the reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>

              <div className="onyba-cancel-notice-banner">
                <span className="onyba-cancel-notice-icon"><img src="images/note-icon.svg" alt="" /></span>
                <p>
                  This session will be marked as cancelled.
                  The patient may be eligible for a refund based on our cancellation policy.
                </p>
              </div>

              <div className="onyba-cancel-actions-row">
                <button type="button" className="onyba-cancel-btn-keep" data-bs-dismiss="modal">Keep Session</button>
                <button
                  type="button"
                  className="onyba-cancel-btn-confirm"
                  data-bs-dismiss="modal"
                  onClick={handleConfirmCancel}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Cancelling..." : "Yes, Cancel Session"}
                </button>
              </div>

            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default CancelSessionPopup;
