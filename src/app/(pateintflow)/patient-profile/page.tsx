import React, { Suspense } from 'react'
import PatientProfile from './PatientProfile'

const page = () => {
  return (
    <div>
      <Suspense fallback={
        <div className="d-flex justify-content-center align-items-center py-5" style={{ minHeight: "200px", gap: "10px" }}>
          <div className="spinner-border spinner-border-sm text-primary" role="status" style={{ width: "1.5rem", height: "1.5rem" }}></div>
          <span style={{ color: "#6c757d", fontSize: "14px" }}>Loading patient profile...</span>
        </div>
      }>
        <PatientProfile/>
      </Suspense>
    </div>
  )
}

export default page
