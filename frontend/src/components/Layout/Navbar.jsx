import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserAuth } from '../../hooks/useUserAuth'

const Navbar = () => {
  const [openSideMenu, setOpenMenu] = useState(false)
  const { user } = useUserAuth()
  
  // Determine dashboard path based on user role
  const getDashboardPath = () => {
    if (user?.role === 'admin') return '/admin/dashboard'
    if (user?.role === 'finance') return '/finance/dashboard'
    if (user?.role === 'program') return '/program/dashboard'
    return '/login'
  }
  
  const dashboardPath = getDashboardPath()

  return (
    <div className="bg-white border-b border-gray-200 px-5 py-4 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between">
        {/* Fund Manager Title - Left side */}
        <Link to={dashboardPath} className="text-xl text-black">
          Fund Tracker
        </Link>
        
        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpenMenu(!openSideMenu)}
          className="lg:hidden text-gray-600 hover:text-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default Navbar

