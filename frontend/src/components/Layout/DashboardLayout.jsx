import React, { useState } from 'react'
import { useUserAuth } from '../../hooks/useUserAuth'
import Navbar from './Navbar'
import SideMenu from './SideMenu'

const DashboardLayout = ({ children, activeMenu }) => {
  const { user } = useUserAuth()
  const [openSideMenu, setOpenSideMenu] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar activeMenu={activeMenu} openSideMenu={openSideMenu} setOpenSideMenu={setOpenSideMenu} />
      {user && (
        <div className="flex pt-16">
          {/* Mobile Menu Overlay - Shows when menu is open on mobile */}
          {openSideMenu && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setOpenSideMenu(false)}
            />
          )}
          
          {/* Sidebar - Mobile: slides in from left, Desktop: always visible */}
          <div
            className={`fixed left-0 top-16 h-[calc(100vh-4rem)] overflow-y-auto z-50 transition-transform duration-300 ease-in-out ${
              openSideMenu ? 'translate-x-0' : '-translate-x-full'
            } lg:translate-x-0 lg:block border-r border-gray-200`}
          >
            <SideMenu activeMenu={activeMenu} setOpenSideMenu={setOpenSideMenu} />
          </div>
          
          {/* Main Content Area - Add left margin to account for fixed sidebar */}
          <div className="flex-1 bg-white lg:ml-64">{children}</div>
        </div>
      )}
    </div>
  )
}

export default DashboardLayout

