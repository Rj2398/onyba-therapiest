"use client";
import React, { useState, useEffect, useRef } from "react";
import GenerateAiSuccessSummaryModal from "./GenerateAiSuccessSummaryModal";

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
  // stage:
  // 0: Saving recording loading (1s)
  // 1: Saving recording done (tick) -> Generating AI summary loading (1s)
  // 2: AI summary done (tick) -> Preparing notes loading (1s)
  // 3: All 3 done (ticks)
  const [stage, setStage] = useState<number>(0);
  const skipBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const modalEl = document.getElementById("aiSummaryModal");
    if (!modalEl) return;

    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;
    let autoNextTimer: NodeJS.Timeout;

    const startProgression = () => {
      setStage(0);

      // Stage 1 (Saving recording) runs for 1 sec, then marks complete & starts Stage 2
      timer1 = setTimeout(() => {
        setStage(1);
      }, 1000);

      // Stage 2 (Generating AI summary) runs for 1 sec, then marks complete & starts Stage 3
      timer2 = setTimeout(() => {
        setStage(2);
      }, 2000);

      // Stage 3 (Preparing notes) runs for 1 sec, then marks complete
      timer3 = setTimeout(() => {
        setStage(3);
      }, 3000);

      // After all 3 complete, automatically advance to next modal after brief pause
      autoNextTimer = setTimeout(() => {
        if (skipBtnRef.current) {
          skipBtnRef.current.click();
        }
      }, 3800);
    };

    const stopProgression = () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(autoNextTimer);
    };

    const handleShown = () => {
      stopProgression();
      startProgression();
    };

    const handleHidden = () => {
      stopProgression();
      setStage(0);
    };

    modalEl.addEventListener("shown.bs.modal", handleShown);
    modalEl.addEventListener("hidden.bs.modal", handleHidden);

    // Also observe class mutations in case bootstrap event is bypassed
    let wasShown = modalEl.classList.contains("show");
    const observer = new MutationObserver(() => {
      const isNowShown = modalEl.classList.contains("show");
      if (isNowShown && !wasShown) {
        startProgression();
      } else if (!isNowShown && wasShown) {
        handleHidden();
      }
      wasShown = isNowShown;
    });

    observer.observe(modalEl, { attributes: true, attributeFilter: ["class"] });

    return () => {
      modalEl.removeEventListener("shown.bs.modal", handleShown);
      modalEl.removeEventListener("hidden.bs.modal", handleHidden);
      observer.disconnect();
      stopProgression();
    };
  }, []);

  const renderStageIcon = (stageIndex: number) => {
    // stageIndex: 0 = Saving recording, 1 = Generating AI summary, 2 = Preparing notes
    if (stage > stageIndex) {
      // Completed: show tick icon
      return (
        <span className="onyba-ai-icon-check">
          <img
            src="images/check-icon-popup.svg"
            alt="Completed"
            style={{ width: "18px", height: "18px", display: "block" }}
          />
        </span>
      );
    }

    if (stage === stageIndex) {
      // Currently loading: animated spinner
      return (
        <span
          className="onyba-ai-icon-spin"
          style={{
            display: "inline-block",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            border: "2px solid #ccd0c5",
            borderTop: "2px solid #654d52",
            animation: "onybaAiSpin 0.8s linear infinite",
            boxSizing: "border-box",
          }}
        />
      );
    }

    // Pending: empty circle
    return (
      <span
        style={{
          display: "inline-block",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          border: "1.5px solid #ccd0c5",
          boxSizing: "border-box",
        }}
      />
    );
  };

  return (
    <>
      <style>{`
        @keyframes onybaAiSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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

                <div className={`onyba-ai-status-row ${stage > 0 ? "onyba-ai-state-done" : "onyba-ai-state-loading"}`}>
                  <p>Saving recording</p>
                  {renderStageIcon(0)}
                </div>

                <div className={`onyba-ai-status-row ${stage > 1 ? "onyba-ai-state-done" : "onyba-ai-state-loading"}`}>
                  <p>Generating AI summary</p>
                  {renderStageIcon(1)}
                </div>

                <div className={`onyba-ai-status-row ${stage > 2 ? "onyba-ai-state-done" : "onyba-ai-state-loading"}`}>
                  <p>Preparing notes</p>
                  {renderStageIcon(2)}
                </div>

              </div>

              <button
                ref={skipBtnRef}
                id="aiSummarySkipBtn"
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
