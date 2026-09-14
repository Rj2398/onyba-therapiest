"use client";
import React from 'react'
import dynamic from 'next/dynamic'

const Agenda = dynamic(() => import('./Agenda'), { ssr: false });

const page = () => {
  return (
    <div>
      <Agenda/>
    </div>
  )
}

export default page
