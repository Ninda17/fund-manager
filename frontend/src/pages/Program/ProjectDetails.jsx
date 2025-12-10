import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'

const ProjectDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      fetchProject()
    }
  }, [id])

  const fetchProject = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await axiosInstance.get(API_PATHS.PROGRAM.GET_PROJECT_BY_ID(id))
      if (response.data.success) {
        setProject(response.data.data)
      } else {
        setError(response.data.message || 'Failed to load project')
      }
    } catch (error) {
      console.error('Error fetching project:', error)
      setError(error.response?.data?.message || 'Failed to load project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount, currency) => {
    if (amount === null || amount === undefined) return 'N/A'
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(numAmount)) return 'N/A'
    
    const currencySymbols = {
      USD: '$',
      EUR: '€',
      BTN: 'Nu.'
    }
    
    const symbol = currencySymbols[currency] || currency
    return `${symbol}${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const calculateUtilization = () => {
    if (!project || !project.amountDonated || project.amountDonated === 0) return 0
    const utilization = (project.totalExpense / project.amountDonated) * 100
    return Math.min(100, Math.max(0, utilization))
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-lg text-gray-600">Loading project details...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-2">
              <svg
                className="w-5 h-5 text-red-600 mr-2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-lg font-semibold text-red-800">Error</h3>
            </div>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/program/projects')}
                className="px-4 py-2 text-sm font-medium text-red-800 border border-red-300 rounded-md hover:bg-red-100 transition-colors"
              >
                Back to Projects
              </button>
              <button
                onClick={fetchProject}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Project not found</h3>
            <p className="text-gray-500 mb-6">The project you're looking for doesn't exist or you don't have access to it.</p>
            <button
              onClick={() => navigate('/program/projects')}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-gray-800 transition-colors"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const utilization = calculateUtilization()

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/program/projects')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Projects
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{project.title}</h1>
              <p className="text-gray-600">Project ID: <span className="font-medium">{project.projectId}</span></p>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Amount Donated */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Amount Donated</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(project.amountDonated, project.currency)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Expense */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Expense</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(project.totalExpense, project.currency)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Utilization */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Utilization</p>
                <p className="text-2xl font-bold text-gray-900">{utilization.toFixed(1)}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      utilization > 90 ? 'bg-red-600' : utilization > 70 ? 'bg-yellow-500' : 'bg-green-600'
                    }`}
                    style={{ width: `${utilization}%` }}
                  />
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Remaining Budget */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Remaining Budget</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    Math.max(0, (project.amountDonated || 0) - (project.totalExpense || 0)),
                    project.currency
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Project Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="mt-1 text-gray-900">{project.description || 'No description provided'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Start Date</label>
                    <p className="mt-1 text-gray-900">{formatDate(project.startDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Date</label>
                    <p className="mt-1 text-gray-900">{formatDate(project.endDate)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Project Type</label>
                    <p className="mt-1 text-gray-900">{project.projectType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Currency</label>
                    <p className="mt-1 text-gray-900">{project.currency}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Donor Name</label>
                  <p className="mt-1 text-gray-900">{project.donorName || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Activities ({project.activities?.length || 0})
              </h2>
              {project.activities && project.activities.length > 0 ? (
                <div className="space-y-4">
                  {project.activities.map((activity, activityIndex) => (
                    <div
                      key={activity.activityId || activityIndex}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {activity.name}
                          </h3>
                          {activity.description && (
                            <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Budget: </span>
                              <span className="font-medium text-gray-900">
                                {formatCurrency(activity.budget || 0, project.currency)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Expense: </span>
                              <span className="font-medium text-gray-900">
                                {formatCurrency(activity.expense || 0, project.currency)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded">
                          {activity.activityId}
                        </span>
                      </div>

                      {/* Sub-Activities */}
                      {activity.subActivities && activity.subActivities.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Sub-Activities ({activity.subActivities.length})
                          </h4>
                          <div className="space-y-2">
                            {activity.subActivities.map((subActivity, subIndex) => (
                              <div
                                key={subIndex}
                                className="bg-white rounded-md p-3 border border-gray-200"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 mb-1">
                                      {subActivity.name}
                                    </p>
                                    <div className="flex flex-wrap gap-4 text-xs">
                                      <div>
                                        <span className="text-gray-500">Budget: </span>
                                        <span className="font-medium text-gray-900">
                                          {formatCurrency(subActivity.budget || 0, project.currency)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Expense: </span>
                                        <span className="font-medium text-gray-900">
                                          {formatCurrency(subActivity.expense || 0, project.currency)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No activities found</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Personnel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Personnel</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Finance Personnel</label>
                  <div className="mt-1">
                    <p className="text-gray-900 font-medium">
                      {project.financePersonnel?.name || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">{project.financePersonnel?.email || ''}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Program Personnel</label>
                  <div className="mt-1">
                    <p className="text-gray-900 font-medium">
                      {project.programPersonnel?.name || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">{project.programPersonnel?.email || ''}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Metadata */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 text-gray-900">
                    {formatDate(project.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Last Updated:</span>
                  <span className="ml-2 text-gray-900">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default ProjectDetails
