import React from 'react'

interface ProfileUnderReviewPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileUnderReviewPopup: React.FC<ProfileUnderReviewPopupProps> = ({ isOpen, onClose }) => {
  return (
    <>
      <div className={`modal fade ${isOpen ? 'show' : ''}`} style={{ display: isOpen ? 'block' : 'none', zIndex: 1050 }} tabIndex={-1} aria-hidden={!isOpen}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-modal-content">

            <button type="button" className="profile-sub-close-btn" onClick={onClose} aria-label="Close">
              <img src="/images/close-btn-popup.svg" alt="" />
            </button>

            <div className="modal-body text-center p-0">

              <div className="success-icon-box yellow">
                <img src="/images/clock-popup-icon.svg" alt="" />
              </div>

              <h5 className="modal-custom-title">Profile Under Review</h5>

              <p className="modal-custom-text">
                Your profile is currently being reviewed by our team. We'll notify you once it's approved.
              </p>

              <button type="button" onClick={onClose} className="btn-custom-ok border-0 w-100" style={{ cursor: 'pointer' }}>Ok</button>

            </div>
          </div>
        </div>
      </div>
      {isOpen && <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />}
    </>
  )
}

export default ProfileUnderReviewPopup
