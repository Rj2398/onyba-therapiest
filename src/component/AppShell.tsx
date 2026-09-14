'use client'

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './common/Header'
import UserProvider from '../app/UserProvider';

// Pages that should display WITHOUT sidebar and header
const noShellRoutes = ['/profile', '/login', '/logout', '/otp']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [isMiniSidebar, setIsMiniSidebar] = useState(false);

  const isNoShell = noShellRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

    // Toggle sidebar class on the layout wrapper
    useEffect(() => {
      const layout = document.getElementById('dashboardLayout');
      if (layout) {
        layout.classList.toggle('mini-sidebar', isMiniSidebar);
      }
    }, [isMiniSidebar]);
  
    // Attach click handler to the toggle button (runs on every render)
    // useEffect(() => {
    //   const toggleBtn = document.getElementById('sidebarToggleBtn');
    //   if (!toggleBtn) return;
  
    //   const handler = () => setIsMiniSidebar((prev) => !prev);
    //   toggleBtn.addEventListener('click', handler);
  
    //   return () => toggleBtn.removeEventListener('click', handler);
    // }, []);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('#sidebarToggleBtn')) {
          setIsMiniSidebar((prev) => !prev);
        }
      };
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }, []);

  if (isNoShell) {
    return <UserProvider>{children}</UserProvider>
  }

  return (
    <UserProvider>
      <div className="gl-dashboard-layout" id="dashboardLayout">
        <Sidebar />
        <div className="gl-main-content-wrapper">
          <Header isMiniSidebar={isMiniSidebar} />
          {children}
        </div>
      </div>
    </UserProvider>
  )
}
