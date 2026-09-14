import React from 'react'

const ViewSummaryChatModal = () => {
  return (
    <>
      <div className="modal fade" id="aiSummaryModal1" tabIndex={-1} aria-labelledby="aiSummaryModalLabel" aria-hidden="true">
    <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content dbt-popup-content-box">
            
            <div className="modal-header dbt-popup-header">
                <div className="dbt-popup-title-group">
                    <div className="dbt-popup-ai-icon">
                       <img src="/images/ai-summary-icon.svg" alt=""/>
                    </div>
                    <h5 className="modal-title dbt-popup-title" id="aiSummaryModalLabel">Patient’s Ony AI Summary</h5>
                </div>
                <button type="button" className="dbt-popup-close-btn" data-bs-dismiss="modal" aria-label="Close">
                    <img src="/images/close-btn-popup.svg" alt=""/>
                </button>
            </div>

            <div className="modal-body dbt-popup-body">
                <div className="dbt-popup-inner-card">
                    
                    <div className="dbt-summary-section">
                        <h6 className="dbt-summary-heading">Family & Emotional Pressure</h6>
                        <p className="dbt-summary-text">
                            The patient shared ongoing emotional pressure related to family expectations and personal responsibilities. They expressed feeling mentally exhausted from constantly trying to meet the expectations of others while neglecting personal emotional needs. The discussion highlighted feelings of guilt, fear of disappointing family members, and difficulty setting healthy boundaries in close relationships.
                        </p>
                    </div>

                    <div className="dbt-summary-section">
                        <h6 className="dbt-summary-heading">Work-Related Anxiety</h6>
                        <p className="dbt-summary-text">
                            The patient described recurring anxiety triggered by workplace stress, overthinking, and performance pressure. They mentioned experiencing racing thoughts, difficulty relaxing after work hours, and occasional emotional shutdown during overwhelming situations. Breathing exercises and journaling introduced in the previous session were reported to be somewhat helpful in reducing immediate stress res howed positive engagement with mindfulness techniques and a willingness to continue practicing healthier coping strategies.
                        </p>
                    </div>

                </div>
            </div>

        </div>
    </div>
     </div>
    </>
  )
}

export default ViewSummaryChatModal
