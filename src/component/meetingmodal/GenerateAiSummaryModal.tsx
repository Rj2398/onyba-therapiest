"use client";
import React from 'react';
import GenerateAiSuccessSummaryModal from './GenerateAiSuccessSummaryModal';

export interface GenerateAiSummaryModalProps {
  sessionId?: string | number;
  onSkip?: () => void;
  onAddNotesNow?: () => void;
  onDoLater?: () => void;
}

const GenerateAiSummaryModal: React.FC<GenerateAiSummaryModalProps> = ({
  sessionId,
  onSkip,
  onAddNotesNow,
  onDoLater,
}) => {
  return (
    <>
      <div className="modal fade" id="aiSummaryModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered onyba-ai-dialog">
          <div className="modal-content onyba-ai-content">

            <button type="button" className="onyba-ai-close-cross" data-bs-dismiss="modal" aria-label="Close">
              <img src="images/close-btn-popup.svg" alt="&times;" />
            </button>

            <div className="modal-body onyba-ai-body">

              <div className="onyba-ai-loader-container">
                <div className="onyba-ai-spinner-dot"></div>
                <div className="onyba-ai-spinner-dot"></div>
                <div className="onyba-ai-spinner-dot"></div>
                <div className="onyba-ai-spinner-dot"></div>
                <div className="onyba-ai-spinner-dot"></div>
                <div className="onyba-ai-spinner-dot"></div>
                <div className="onyba-ai-spinner-dot"></div>
                <div className="onyba-ai-spinner-dot"></div>
              </div>

              <h5 className="onyba-ai-title">Generating AI Summary...</h5>

              <p className="onyba-ai-desc">Preparing session details...</p>

              <div className="onyba-ai-status-panel">

                <div className="onyba-ai-status-row onyba-ai-state-done">
                  <p>Saving recording</p>
                  <span className="onyba-ai-icon-check"><img src="images/check-icon-popup.svg" alt="" /></span>
                </div>

                <div className="onyba-ai-status-row onyba-ai-state-loading">
                  <p>Generating AI summary</p>
                  <span className="onyba-ai-icon-spin"></span>
                </div>

                <div className="onyba-ai-status-row onyba-ai-state-loading">
                  <p>Preparing notes</p>
                  <span className="onyba-ai-icon-spin"></span>
                </div>

              </div>

              <button
                type="button"
                className="onyba-ai-btn-skip"
                data-bs-toggle="modal"
                data-bs-target="#endSessionModal1"
                onClick={onSkip}
              >
                Skip
              </button>

            </div>

          </div>
        </div>
      </div>

      <GenerateAiSuccessSummaryModal
        sessionId={sessionId}
        onAddNotesNow={onAddNotesNow}
        onDoLater={onDoLater}
      />
    </>
  );
};

export default GenerateAiSummaryModal;
