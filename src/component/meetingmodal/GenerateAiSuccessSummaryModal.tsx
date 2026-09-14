
"use client";
import { useRouter } from 'next/navigation';
import React from 'react';

export interface GenerateAiSuccessSummaryModalProps {
  sessionId?: string | number;
  onAddNotesNow?: () => void;
  onDoLater?: () => void;
}

const GenerateAiSuccessSummaryModal: React.FC<GenerateAiSuccessSummaryModalProps> = ({
  sessionId,
  onAddNotesNow,
  onDoLater,
}) => {
  const router = useRouter();
  console.log(sessionId, "sesson id ***")
  const handleAddNotesNow = () => {
    if (onAddNotesNow) onAddNotesNow();
    const redirectUrl = sessionId
      ? `/final-back-to-agenda?id=${sessionId}`
      : "/final-back-to-agenda";
    router.push(redirectUrl);
  };

  const handleDoLater = () => {
    if (onDoLater) onDoLater();
    router.push("/dashboard");
  };

  return (
    <div className="modal fade" id="endSessionModal1" tabIndex={-1} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered onyba-end-dialog">
        <div className="modal-content onyba-end-content">

          <button type="button" className="onyba-end-close-cross" data-bs-dismiss="modal" aria-label="Close">
            <img src="images/close-btn-popup.svg" alt="&times;" />
          </button>

          <div className="modal-body onyba-end-body">

            <div className="onyba-success-icon-circle">
              <img src="images/success.svg" alt="End Call" />
            </div>

            <h5 className="onyba-end-title">Generated AI Summary Successfully</h5>

            <p className="onyba-end-desc">
              You can review the session, add notes, and assign <br />
              tasks to your patient.
            </p>

            <div className="onyba-success-status-panel">

              <div className="onyba-success-status-row">
                <span className="onyba-end-success-icon"><img src="images/clock.svg" alt="" /></span>
                <p>You have 48 hours to add notes.<br />After that, it will move to alerts.</p>
              </div>

            </div>

            <div className="onyba-end-actions-row">
              <button
                type="button"
                onClick={handleDoLater}
                className="onyba-end-btn-cancel"
                data-bs-dismiss="modal"
              >
                Do it Later(48 hrs limit)
              </button>
              <button
                type="button"
                onClick={handleAddNotesNow}
                className="onyba-end-btn-confirm"
                data-bs-dismiss="modal"
              >
                Add Notes Now
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default GenerateAiSuccessSummaryModal;
