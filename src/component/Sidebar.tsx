'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import Logout from './Logout'

const navItems = [
  { href: '/dashboard', icon: '/images/sidebar/1.svg', label: 'Dashboard' },
  { href: '/agenda', icon: '/images/sidebar/4.svg', label: 'Agenda' },
  { href: '/patient', icon: '/images/sidebar/2.svg', label: 'Patients' },
  { href: '/clinic-patients', icon: '/images/sidebar/3.svg', label: 'Clinic Patients' },
  { href: '/earning', icon: '/images/sidebar/5.svg', label: 'Earnings & Reports' },
  { href: '/personal-profile', icon: '/images/sidebar/6.svg', label: 'Profile' },
  {
    href: '#',
    icon: '/images/sidebar/7.svg',
    label: 'Logout',
    'data-bs-toggle': 'modal',
    'data-bs-target': '#onybaLogoutModal'
  }
  // {href: '#',icon: '/images/sidebar/7.svg', label: 'Logout','data-bs-toggle': 'modal','data-bs-target': '#logout'}
]


const Sidebar = () => {

  const router = useRouter()
  const pathname = usePathname()
  const hideSidebar = pathname.includes("/video-confrenece")

  return (

    <>

      <aside className="gl-sidebar">

        {/* Brand Block */}
        <div className="gl-brand-block" onClick={() => router.push("/dashboard")}>
          {/* Adjusted to absolute paths assuming they live in /public/images/ */}
          <img src="/images/onybalogo.png" alt="Onyba" className="gl-logo-full" />
          <img src="/images/onybalogo.png" alt="Onyba" className="gl-logo-collapsed" />
        </div>
        {/* Navigation Wrapper */}
        <div className="gl-navigation-wrapper">
          <ul className="gl-sidebar-menu">

            {/* {navItems.map(({ href, icon, label,"data-bs-target" }) => (
                <li key={href} className={`gl-menu-item${pathname === href || pathname.startsWith(href + '/') ? ' active' : ''}`}>
                  <Link href={href} className="gl-menu-link"  data-bs-toggle={item['data-bs-toggle']}
                      data-bs-target={item['data-bs-target']}>
                    <img src={icon} className="gl-menu-icon" alt="" />
                    <span className="gl-menu-text">{label}</span>
                  </Link>
                </li>
              ))} */}


            {navItems.map(
              ({ href, icon, label, 'data-bs-toggle': dataBsToggle, 'data-bs-target': dataBsTarget }) => {
                const isItemActive = (linkHref: string, currentPath: string) => {
                  if (linkHref === '#') return false;

                  switch (linkHref) {
                    case '/dashboard':
                      return [
                        '/dashboard',
                        '/video-confrenece',
                      ].some((route) => currentPath === route || currentPath.startsWith(route + "/"));

                    case '/agenda':
                      return [
                        '/agenda',
                        '/final-back-to-agenda',
                        '/back-to-calendar',
                      ].some((route) => currentPath === route || currentPath.startsWith(route + "/"));

                    case '/patient':
                      return [
                        '/patient',
                        '/patient-profile',
                        '/teen-patient-profile',
                        '/back-to-agenda'
                      ].some((route) => currentPath === route || currentPath.startsWith(route + "/"));

                    case '/clinic-patients':
                      return [
                        '/clinic-patients',
                        '/add-clinic-patient',
                      ].some((route) => currentPath === route || currentPath.startsWith(route + "/"));

                    case '/earning':
                      return currentPath === '/earning' || currentPath.startsWith('/earning/');

                    case '/personal-profile':
                      return [
                        '/personal-profile',
                        '/profile',
                      ].some((route) => currentPath === route || currentPath.startsWith(route + "/"));

                    default:
                      return currentPath === linkHref || currentPath.startsWith(linkHref + "/");
                  }
                };

                const isActive = isItemActive(href, pathname);

                return (
                  <li
                    key={label}
                    className={`gl-menu-item${isActive ? " active" : ""}`}
                  >
                    <Link
                      href={href}
                      className="gl-menu-link"
                      data-bs-toggle={dataBsToggle}
                      data-bs-target={dataBsTarget}
                      onClick={(e) => {
                        if (href === '#') {
                          e.preventDefault();
                        }
                      }}
                    >
                      <img src={icon} className="gl-menu-icon" alt="" />
                      <span className="gl-menu-text">{label}</span>
                    </Link>
                  </li>
                );
              }
            )}

          </ul>
        </div>
      </aside>
      <Logout />

    </>
  )
}

export default Sidebar