import React, { Suspense } from 'react';
import Dashboard from './Dashboard';

const page = () => {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
};

export default page;
