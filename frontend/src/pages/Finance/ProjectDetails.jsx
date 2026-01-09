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
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredActivities, setFilteredActivities] = useState([])

  useEffect(() => {
    if (id) {
      fetchProjectDetails()
    }
  }, [id])

  // Filter activities based on search query
  useEffect(() => {
    if (!project || !project.activities) {
      setFilteredActivities([])
      return
    }

    if (!searchQuery.trim()) {
      setFilteredActivities(project.activities)
      return
    }

    // Split search query into individual terms (support multiple search terms)
    const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0)
    
    const filtered = project.activities.filter((activity) => {
      const activityId = (activity.activityId || '').toLowerCase()
      const name = (activity.name || '').toLowerCase()
      const budgetFormatted = formatCurrency(activity.budget, project.currency).toLowerCase()
      const expenseFormatted = formatCurrency(activity.expense, project.currency).toLowerCase()
      const budgetRaw = (activity.budget?.toString() || '').toLowerCase()
      const expenseRaw = (activity.expense?.toString() || '').toLowerCase()
      const utilization = calculateActivityUtilization(activity).toFixed(1)
      const progressStatus = (activity.projectStatus || 'Not Started').toLowerCase()
      const budgetStatus = getActivityBudgetStatus(activity).toLowerCase()
      const budgetStatusFormatted = formatBudgetStatus(budgetStatus).toLowerCase()

      // Combine all searchable fields into a single string
      const searchableText = [
        activityId,
        name,
        budgetFormatted,
        expenseFormatted,
        budgetRaw,
        expenseRaw,
        utilization,
        progressStatus,
        budgetStatus,
        budgetStatusFormatted
      ].join(' ')

      // Check if ALL search terms match (AND logic)
      return searchTerms.every(term => searchableText.includes(term))
    })

    setFilteredActivities(filtered)
  }, [searchQuery, project])

  const fetchProjectDetails = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await axiosInstance.get(API_PATHS.FINANCE.GET_PROJECT_BY_ID(id))
      if (response.data.success) {
        setProject(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching project details:', error)
      setError(error.response?.data?.message || 'Failed to load project details. Please try again.')
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
      month: 'short',
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
    const totalExpense = project.totalExpense || 0
    return Math.min((totalExpense / project.amountDonated) * 100)
  }

  const calculateRemainingBudget = () => {
    if (!project) return 0
    const amountDonated = project.amountDonated || 0
    const totalExpense = project.totalExpense || 0
    return Math.max(amountDonated - totalExpense, 0)
  }

  const calculateActivityUtilization = (activity) => {
    if (!activity || !activity.budget || activity.budget === 0) return 0
    const expense = activity.expense || 0
    return Math.min((expense / activity.budget) * 100, 100)
  }

  const getProgressBadgeStyle = (status) => {
    const statusStyles = {
      'Not Started': 'bg-gray-100 text-gray-700 border-gray-200',
      'In Progress': 'bg-orange-100 text-orange-700 border-orange-200',
      'Completed': 'bg-green-100 text-green-700 border-green-200'
    }
    return statusStyles[status] || statusStyles['Not Started']
  }

  const getActivityBudgetStatus = (activity) => {
    if (!activity || activity.budget === null || activity.budget === undefined) return 'balanced'
    const budget = typeof activity.budget === 'string' ? parseFloat(activity.budget) : activity.budget
    const expense = activity.expense || 0
    
    if (expense < budget) return 'underspent'
    if (expense > budget) return 'overspent'
    return 'balanced'
  }

  const getBudgetStatusBadgeStyle = (status) => {
    const statusStyles = {
      'underspent': 'bg-green-100 text-green-700 border-green-200',
      'overspent': 'bg-red-100 text-red-700 border-red-200',
      'balanced': 'bg-blue-100 text-blue-700 border-blue-200'
    }
    return statusStyles[status] || statusStyles['balanced']
  }

  const formatBudgetStatus = (status) => {
    const statusMap = {
      'underspent': 'Underspent',
      'overspent': 'Overspent',
      'balanced': 'Spent'
    }
    return statusMap[status] || 'Spent'
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-lg">Loading project details...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="mb-6">
            <button
              onClick={() => navigate('/finance/projects')}
              className="text-primary hover:text-primary-dark mb-4 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Projects
            </button>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Project not found</h3>
            <button
              onClick={() => navigate('/finance/projects')}
              className="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const utilization = calculateUtilization()
  const remainingBudget = calculateRemainingBudget()

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <button
              onClick={() => navigate('/finance/projects')}
              className="text-primary hover:text-primary-dark flex items-center text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Projects
            </button>
            <button
              onClick={() => navigate(`/finance/projects/${id}/edit`)}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Project
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 break-words">{project.title}</h1>
          <p className="text-gray-600 text-xs sm:text-sm lg:text-base break-words">Project ID: {project.projectId}</p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Amount Donated */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Amount Donated</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  {formatCurrency(project.amountDonated, project.currency)}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Expense */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Expense</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  {formatCurrency(project.totalExpense, project.currency)}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Utilization */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex-1 w-full sm:w-auto">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Utilization</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{utilization.toFixed(1)}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gray-900 h-full rounded-full transition-all"
                    style={{ width: `${utilization}%` }}
                  />
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 self-end sm:self-auto sm:ml-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Remaining Budget */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Remaining Budget</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  {formatCurrency(remainingBudget, project.currency)}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Project Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="break-words">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Description</p>
              <p className="text-sm sm:text-base text-gray-900 break-words">{project.description || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Project Type</p>
              <p className="text-sm sm:text-base text-gray-900">{project.projectType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Start Date</p>
              <p className="text-sm sm:text-base text-gray-900">{formatDate(project.startDate)}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">End Date</p>
              <p className="text-sm sm:text-base text-gray-900">{formatDate(project.endDate)}</p>
            </div>
            <div className="break-words">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Donor Name</p>
              <p className="text-sm sm:text-base text-gray-900 break-words">{project.donorName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Currency</p>
              <p className="text-sm sm:text-base text-gray-900">{project.currency || 'N/A'}</p>
            </div>
            <div className="break-words">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Finance Personnel</p>
              <div className="text-sm sm:text-base">
                <p className="text-gray-900 font-medium break-words">{project.financePersonnel?.name || 'N/A'}</p>
                <p className="text-gray-600 break-words text-xs sm:text-sm">{project.financePersonnel?.email || ''}</p>
              </div>
            </div>
            <div className="break-words">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Program Personnel</p>
              <div className="text-sm sm:text-base">
                <p className="text-gray-900 font-medium break-words">{project.programPersonnel?.name || 'N/A'}</p>
                <p className="text-gray-600 break-words text-xs sm:text-sm">{project.programPersonnel?.email || ''}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Project Documents</h2>
          {project.documents && project.documents.length > 0 ? (
            <div className="space-y-3">
              {project.documents.map((documentUrl, index) => {
                // Extract filename from URL
                const fileName = documentUrl.split('/').pop().split('?')[0] || `Document ${index + 1}`;
                // Determine file extension
                const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
                const isWordDoc = fileExtension === 'doc' || fileExtension === 'docx';
                const isPdf = fileExtension === 'pdf';
                
                // Determine icon and styling
                let iconBg = 'bg-gray-100';
                let iconColor = 'text-gray-600';
                let fileTypeLabel = 'Document';
                
                if (isWordDoc) {
                  iconBg = 'bg-blue-100';
                  iconColor = 'text-blue-600';
                  fileTypeLabel = 'Word Document';
                } else if (isPdf) {
                  iconBg = 'bg-red-100';
                  iconColor = 'text-red-600';
                  fileTypeLabel = 'PDF Document';
                }
                
                return (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                        {isWordDoc ? (
                          <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        ) : isPdf ? (
                          <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                        <p className="text-xs text-gray-500">{fileTypeLabel}</p>
                      </div>
                    </div>
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors flex items-center flex-shrink-0"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-500">No supporting documents attached</p>
            </div>
          )}
        </div>

        {/* Activities Section */}
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Activities</h2>
            </div>

        {/* Activities Table */}
        {project.activities && project.activities.length > 0 ? (
          <>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by activity ID, name, budget, expense, utilization, progress status, budget status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 sm:py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary text-sm sm:text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg
                      className="h-5 w-5 text-gray-400 hover:text-gray-600"
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
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-2 text-sm text-gray-600">
                  {filteredActivities.length === 0 ? (
                    <span>No activities found matching "{searchQuery}"</span>
                  ) : (
                    <span>
                      Found {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'} matching "{searchQuery}"
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        NAME
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        BUDGET
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        EXPENSE
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        UTILIZATION
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PROGRESS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredActivities.length > 0 ? (
                      filteredActivities.map((activity, index) => {
                    const activityUtilization = calculateActivityUtilization(activity)
                    const progressStatus = activity.projectStatus || 'Not Started'
                    const budgetStatus = getActivityBudgetStatus(activity)
                    return (
                      <tr 
                        key={index} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/finance/projects/${id}/activities/${activity.id || activity._id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{activity.activityId}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{activity.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(activity.budget, project.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(activity.expense, project.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start">
                            <span className="text-sm text-gray-600 mb-1">{activityUtilization.toFixed(1)}%</span>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gray-900 h-full rounded-full transition-all"
                                style={{ width: `${activityUtilization}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getProgressBadgeStyle(progressStatus)}`}>
                            {progressStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getBudgetStatusBadgeStyle(budgetStatus)}`}>
                            {formatBudgetStatus(budgetStatus)}
                          </span>
                        </td>
                      </tr>
                      )
                    })
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">
                          No activities found matching "{searchQuery}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden divide-y divide-gray-200">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((activity, index) => {
                const activityUtilization = calculateActivityUtilization(activity)
                const progressStatus = activity.projectStatus || 'Not Started'
                const budgetStatus = getActivityBudgetStatus(activity)
                return (
                  <div 
                    key={index} 
                    className="p-4 sm:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => navigate(`/finance/projects/${id}/activities/${activity._id}`)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">ID</span>
                        <span className="text-sm font-semibold text-gray-900">{activity.activityId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">NAME</span>
                        <span className="text-sm text-gray-900 text-right break-words ml-4">{activity.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">BUDGET</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(activity.budget, project.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">EXPENSE</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(activity.expense, project.currency)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">UTILIZATION</span>
                          <span className="text-sm text-gray-600">{activityUtilization.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gray-900 h-full rounded-full transition-all"
                            style={{ width: `${activityUtilization}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">PROGRESS</span>
                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getProgressBadgeStyle(progressStatus)}`}>
                          {progressStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">STATUS</span>
                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getBudgetStatusBadgeStyle(budgetStatus)}`}>
                          {formatBudgetStatus(budgetStatus)}
                        </span>
                      </div>
                    </div>
                  </div>
                  )
                })
                ) : (
                  <div className="p-8 text-center text-sm text-gray-500">
                    No activities found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 13.5V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121.75 6v7.5V18a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 18v-4.5zm19.5-4.5v2.25m0 3.75v3.75M12 18h.008v.008H12v-.008zm0 2.25h.008v.008H12v-.008zm0 2.25h.008v.008H12v-.008zM12 12h.008v.008H12v-.008zM12 14.25h.008v.008H12v-.008zM12 16.5h.008v.008H12v-.008z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
            <p className="text-gray-500">This project has no activities</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default ProjectDetails
