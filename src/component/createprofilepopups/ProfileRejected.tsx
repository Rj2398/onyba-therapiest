import React from 'react'

interface ProfileRejectedProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileRejected: React.FC<ProfileRejectedProps> = ({ isOpen, onClose }) => {
  return (
    <>
      <div className={`modal fade ${isOpen ? 'show' : ''}`} style={{ display: isOpen ? 'block' : 'none', zIndex: 1050 }} tabIndex={-1} aria-hidden={!isOpen}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-modal-content">

            <button type="button" className="profile-sub-close-btn" onClick={onClose} aria-label="Close">
              <img src="/images/close-btn-popup.svg" alt="" />
            </button>

            <div className="modal-body text-center p-0">

              <div className="success-icon-box red">
                <img src="/images/popup-check-icon.svg" alt="" />
              </div>

              <h5 className="modal-custom-title">Profile Rejected</h5>

              <p className="modal-custom-text">
                Unfortunately, your profile has been rejected. Please contact support for more information or register again with updated credentials.
              </p>
              <div className="verification-issue">
                Rejection reasons may include incomplete certifications or verification issues.
              </div>
              
              <button type="button" onClick={onClose} className="btn-custom-ok border-0 w-100 mb-2" style={{ cursor: 'pointer' }}>Contact Support</button>
              <button type="button" onClick={onClose} className="secondary-cta border-0 w-100" style={{ background: 'transparent', cursor: 'pointer' }}>Register Again</button>

            </div>
          </div>
        </div>
      </div>
      {isOpen && <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />}
    </>
  )
}

export default ProfileRejected
