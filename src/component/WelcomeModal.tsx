'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

const WelcomeModal = () => {

  const router = useRouter()

  const handleOk = () => {
    router.push('/profile');

  }

  return (
    <>

      <div className="modal fade" id="welcomeModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-modal-content">
            <div className="modal-body text-center p-0">

              <div className="success-icon-box">
                <img src="/images/popup-check-icon.svg" alt="" />
              </div>

              <h5 className="modal-custom-title">Welcome to Onyba</h5>

              <p className="modal-custom-text">Your account is ready, start exploring now !</p>

              <button type="button" className="btn-custom-ok" data-bs-dismiss="modal" onClick={handleOk}>Ok</button>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default WelcomeModal
