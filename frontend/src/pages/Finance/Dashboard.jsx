import React from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'

const Dashboard = () => {
  return (
    <DashboardLayout activeMenu="/finance/dashboard">
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Finance Dashboard</h1>
        <p className="text-gray-600">Welcome to the Fund Manager Finance Dashboard</p>
        {/* Add your dashboard content here */}
      </div>
    </DashboardLayout>
  )
}

export default Dashboard

