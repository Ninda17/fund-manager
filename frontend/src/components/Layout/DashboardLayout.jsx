import React from 'react'
import { useUserAuth } from '../../hooks/useUserAuth'
import Navbar from './Navbar'
import SideMenu from './SideMenu'

const DashboardLayout = ({ children, activeMenu }) => {
  const { user } = useUserAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar activeMenu={activeMenu} />
      {user && (
        <div className="flex pt-16">
          {/* Sidebar - Hidden on mobile, visible on desktop, fixed position */}
          <div className="hidden lg:block border-r border-gray-200 fixed left-0 top-16 h-[calc(100vh-4rem)] overflow-y-auto z-40">
            <SideMenu activeMenu={activeMenu} />
          </div>
          
          {/* Main Content Area - Add left margin to account for fixed sidebar */}
          <div className="flex-1 bg-white lg:ml-64">{children}</div>
        </div>
      )}
    </div>
  )
}

export default DashboardLayout

