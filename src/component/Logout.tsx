import React from 'react'
import { useAuth } from '@/src/app/UserProvider'


const Logout = () => {
    const { logout } = useAuth()
    const handleLogout = () => {
        logout()
    }
    return (
        <>
            <div className="modal fade" id="onybaLogoutModal" tabIndex={-1} aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered onyba-logout-dialog">
                    <div className="modal-content onyba-logout-content">

                        <button type="button" className="onyba-logout-close-cross" data-bs-dismiss="modal" aria-label="Close">
                            <img src="/images/close-btn-popup.svg" alt="&times;" />
                        </button>

                        <div className="modal-body onyba-logout-body">

                            <div className="onyba-logout-icon-circle">
                                <img src="/images/logout-icon.svg" alt="Logout" />
                            </div>

                            <h5 className="onyba-logout-title">Confirm Logout</h5>

                            <p className="onyba-logout-text">
                                Are you sure you want to log out of your account?
                            </p>

                            <div className="onyba-logout-actions-row">
                                <button type="button" className="onyba-logout-btn-cancel" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" className="onyba-logout-btn-confirm" onClick={() => handleLogout()} data-bs-dismiss="modal" >Yes, Logout</button>
                            </div>

                        </div>

                    </div>
                </div>
            </div>
        </>
    )
}

export default Logout
