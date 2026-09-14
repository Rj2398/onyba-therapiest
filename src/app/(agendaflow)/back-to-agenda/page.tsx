"use client";
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const BackToAgenda = dynamic(() => import('./BackToAgenda'), { ssr: false });

const page = () => {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
      <BackToAgenda />
    </Suspense>
  );
};

export default page;


