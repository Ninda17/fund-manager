import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useUserAuth } from '../hooks/useUserAuth'

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useUserAuth()

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check if user's role is allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect based on role
    if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />
    } else if (user.role === 'finance') {
      return <Navigate to="/finance/dashboard" replace />
    } else {
      return <Navigate to="/user/dashboard" replace />
    }
  }

  return <Outlet />
}

export default PrivateRoute

