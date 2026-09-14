"use client";
import React, { useState } from 'react';
import CompleteSession from './CompleteSession';
import { useSearchParams } from 'next/navigation';
import { requestApi } from '@/src/utils/api';

export interface EndSessionProps {
  sessionId?: string | number;
  onConfirmEnd?: (sessionId?: string | number) => void;
  onCancel?: () => void;
  onContinue?: () => void;
  onSkipAiSummary?: () => void;
  onAddNotesNow?: () => void;
  onDoLater?: () => void;
}

const EndSession: React.FC<EndSessionProps> = ({
  sessionId,
  onConfirmEnd,
  onCancel,
  onContinue,
  onSkipAiSummary,
  onAddNotesNow,
  onDoLater,
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
        const formData = new FormData();
        formData.append("therapy_session_id", String(effectiveSessionId));

        const res = await requestApi({
          endpoint: "session-end",
          method: "POST",
          data: formData,
          isFormData: true,
        });
        console.log("session-end API response:", res);
      } catch (err) {
        console.error("Error calling session-end API:", err);
      } finally {
        setIsSubmitting(false);
      }
    }

    if (onConfirmEnd) {
      onConfirmEnd(effectiveSessionId || undefined);
    }
  };

  return (
    <>
      <div className="modal fade" id="endSessionModal" tabIndex={-1} aria-hidden="true">
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

              <div className="onyba-end-info-panel">

                <div className="onyba-end-log-row">
                  <span className="onyba-end-check-icon"><img src="images/check-icon-popup.svg" alt="" /></span>
                  <p>Audio/Video recording will be saved</p>
                </div>

                <div className="onyba-end-log-row">
                  <span className="onyba-end-check-icon"><img src="images/check-icon-popup.svg" alt="" /></span>
                  <p>AI summary will be generated shortly</p>
                </div>

                <div className="onyba-end-log-row">
                  <span className="onyba-end-check-icon"><img src="images/check-icon-popup.svg" alt="" /></span>
                  <p>You can add private & public notes after ending</p>
                </div>

              </div>

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
                  data-bs-toggle="modal"
                  data-bs-target="#sessionCompletedModal"
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

      <CompleteSession
        sessionId={effectiveSessionId || undefined}
        onContinue={onContinue}
        onSkipAiSummary={onSkipAiSummary}
        onAddNotesNow={onAddNotesNow}
        onDoLater={onDoLater}
      />
    </>
  );
};

export default EndSession;
