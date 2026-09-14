import React, { Suspense } from 'react'
import OtpVerification from './OtpVerification'

const page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
       <OtpVerification/>
    </Suspense>
  )
}

export default page
