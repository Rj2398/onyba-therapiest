"use client";

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { requestApi } from '@/src/utils/api';
import toast from 'react-hot-toast';

export interface ClinicPatientEndSessionProps {
  sessionId?: string | number;
  onConfirmEnd?: (sessionId?: string | number) => void;
  onCancel?: () => void;
}

const ClinicPatientEndSession: React.FC<ClinicPatientEndSessionProps> = ({
  sessionId,
  onConfirmEnd,
  onCancel,
}) => {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveSessionId =
    sessionId ||
    searchParams.get("therapy_session_id") ||
    searchParams.get("session_id") ||
    searchParams.get("id");

  const handleConfirmEndSession = async () => {
    if (effectiveSessionId) {
      setIsSubmitting(true);
      try {
        const res = await requestApi({
          endpoint: "session-end",
          method: "POST",
          data: {
            therapy_session_id: String(effectiveSessionId),
          },
          isFormData: false,
        });
        console.log("session-end API response in ClinicPatientEndSession:", res);
        if (res && (res.success || res.code === 200 || res.status)) {
          toast.success(res.message || "Session ended successfully.");
        }
      } catch (err: any) {
        console.error("Error calling session-end API in ClinicPatientEndSession:", err);
        toast.error(err?.response?.data?.message || err?.message || "Failed to end session.");
      } finally {
        setIsSubmitting(false);
      }
    }

    if (onConfirmEnd) {
      onConfirmEnd(effectiveSessionId || undefined);
    }
  };

  return (
    <div className="modal fade" id="clinicPatientEndSessionModal" tabIndex={-1} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered onyba-end-dialog">
        <div className="modal-content onyba-end-content">

          <button type="button" className="onyba-end-close-cross" data-bs-dismiss="modal" aria-label="Close">
            <img src="images/close-btn-popup.svg" alt="&times;" />
          </button>

          <div className="modal-body onyba-end-body">

            <div className="onyba-end-icon-circle">
              <img src="images/call-cut.svg" alt="End Call" />
            </div>

            <h5 className="onyba-end-title">End Session?</h5>

            <p className="onyba-end-desc">
              Are you sure want to end this session?<br />
              The session recording will stop and you can proceed to add notes.
            </p>

            <div className="onyba-end-actions-row">
              <button
                type="button"
                className="onyba-end-btn-cancel"
                data-bs-dismiss="modal"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                data-bs-dismiss="modal"
                className="onyba-end-btn-confirm"
                onClick={handleConfirmEndSession}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Ending..." : "End Session"}
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default ClinicPatientEndSession;
