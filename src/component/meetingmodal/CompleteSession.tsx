"use client";
import React from 'react';
import GenerateAiSummaryModal from './GenerateAiSummaryModal';

export interface CompleteSessionProps {
  sessionId?: string | number;
  onContinue?: () => void;
  onSkipAiSummary?: () => void;
  onAddNotesNow?: () => void;
  onDoLater?: () => void;
}

const CompleteSession: React.FC<CompleteSessionProps> = ({
  sessionId,
  onContinue,
  onSkipAiSummary,
  onAddNotesNow,
  onDoLater,
}) => {
  return (
    <>
      <div>
        <div className="modal fade" id="sessionCompletedModal" tabIndex={-1} aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered onyba-complete-dialog">
            <div className="modal-content onyba-complete-content">

              <button type="button" className="onyba-complete-close-cross" data-bs-dismiss="modal" aria-label="Close">
                <img src="images/close-btn-popup.svg" alt="&times;" />
              </button>

              <div className="modal-body onyba-complete-body">

                <div className="onyba-complete-icon-circle">
                  <img src="images/fa_flag.svg" alt="Flag" />
                </div>

                <h5 className="onyba-complete-title">Session Completed</h5>

                <p className="onyba-complete-desc">
                  Your 50-minute session has ended automatically.<br />
                  Recording has been saved successfully.
                </p>

                <div className="onyba-complete-info-panel">

                  <div className="onyba-complete-log-row">
                    <span className="onyba-complete-check-icon"><img src="images/check-icon-popup.svg" alt="" /></span>
                    <p>Audio/Video recording will be saved</p>
                  </div>

                  <div className="onyba-complete-log-row">
                    <span className="onyba-complete-check-icon"><img src="images/check-icon-popup.svg" alt="" /></span>
                    <p>AI summary will be generated shortly</p>
                  </div>

                  <div className="onyba-complete-log-row">
                    <span className="onyba-complete-check-icon"><img src="images/check-icon-popup.svg" alt="" /></span>
                    <p>You can add private & public notes after ending</p>
                  </div>

                </div>

                <a
                  href="#"
                  data-bs-toggle="modal"
                  data-bs-target="#aiSummaryModal"
                  className="onyba-complete-btn-continue"
                  onClick={onContinue}
                >
                  Continue
                </a>

              </div>

            </div>
          </div>
        </div>
      </div>

      <GenerateAiSummaryModal
        sessionId={sessionId}
        onSkip={onSkipAiSummary}
        onAddNotesNow={onAddNotesNow}
        onDoLater={onDoLater}
      />
    </>
  );
};

export default CompleteSession;
