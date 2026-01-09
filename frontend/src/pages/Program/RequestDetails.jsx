import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'

const RequestDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      fetchRequestDetails()
    }
  }, [id])

  const fetchRequestDetails = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await axiosInstance.get(API_PATHS.PROGRAM.GET_REALLOCATION_REQUEST_BY_ID(id))
      if (response.data.success) {
        setRequest(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching request details:', error)
      setError(error.response?.data?.message || 'Failed to load request details. Please try again.')
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  const getStatusBadgeStyle = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      approved: 'bg-green-100 text-green-700 border-green-200',
      rejected: 'bg-red-100 text-red-700 border-red-200'
    }
    return styles[status] || styles.pending
  }

  const getRequestTypeLabel = (type) => {
    const labels = {
      project_to_project: 'Project to Project',
      activity_to_activity: 'Activity to Activity',
      subactivity_to_subactivity: 'Subactivity to Subactivity'
    }
    return labels[type] || type
  }

  const getSourceDisplay = () => {
    if (!request) return 'N/A'
    
    if (request.requestType === 'project_to_project') {
      const project = request.sourceProject || request.sourceProjectId
      return project?.projectId || project?.title || 'N/A'
    } else if (request.requestType === 'activity_to_activity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Activity ${request.sourceActivityId || ''}`
    } else if (request.requestType === 'subactivity_to_subactivity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Subactivity ${request.sourceSubactivityId || ''}`
    }
    return 'N/A'
  }

  const getDestinationDisplay = () => {
    if (!request) return 'N/A'
    
    if (request.requestType === 'project_to_project') {
      const project = request.destinationProject || request.destinationProjectId
      return project?.projectId || project?.title || 'N/A'
    } else if (request.requestType === 'activity_to_activity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Activity ${request.destinationActivityId || ''}`
    } else if (request.requestType === 'subactivity_to_subactivity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Subactivity ${request.destinationSubactivityId || ''}`
    }
    return 'N/A'
  }

  const getEvidenceImageUrl = () => {
    if (!request?.evidenceImageUrl) return null
    // If it's a relative path, prepend the API base URL
    if (request.evidenceImageUrl.startsWith('/')) {
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
      return baseURL.replace('/api', '') + request.evidenceImageUrl
    }
    return request.evidenceImageUrl
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-lg">Loading request details...</div>
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
              onClick={() => navigate('/program/reallocations')}
              className="text-primary hover:text-primary-dark mb-4 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Requests
            </button>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!request) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Request not found</h3>
            <button
              onClick={() => navigate('/program/reallocations')}
              className="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              Back to Requests
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const evidenceImageUrl = getEvidenceImageUrl()

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <button
              onClick={() => navigate('/program/reallocations')}
              className="text-primary hover:text-primary-dark flex items-center text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Requests
            </button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Reallocation Request Details
            </h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeStyle(request.status)}`}>
              {request.status}
            </span>
          </div>
          <p className="text-gray-600 text-xs sm:text-sm lg:text-base">
            Request Type: {getRequestTypeLabel(request.requestType)}
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Amount */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Amount</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                  {formatCurrency(request.amount, request.sourceCurrency)}
                </p>
                {request.sourceCurrency !== request.destinationCurrency && request.convertedAmount && (
                  <p className="text-sm text-gray-500 mt-1">
                    → {formatCurrency(request.convertedAmount, request.destinationCurrency)}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Created Date */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Created</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                  {formatDate(request.createdAt)}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Approved/Rejected Date */}
          {request.approvedAt && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">
                    {request.status === 'approved' ? 'Approved' : 'Rejected'}
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                    {formatDate(request.approvedAt)}
                  </p>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4 ${
                  request.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${
                    request.status === 'approved' ? 'text-green-600' : 'text-red-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {request.status === 'approved' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Request Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Request Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Request Type</p>
              <p className="text-sm sm:text-base text-gray-900 font-medium">{getRequestTypeLabel(request.requestType)}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeStyle(request.status)}`}>
                {request.status}
              </span>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Source</p>
              <p className="text-sm sm:text-base text-gray-900 font-medium">{getSourceDisplay()}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Destination</p>
              <p className="text-sm sm:text-base text-gray-900 font-medium">{getDestinationDisplay()}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Source Currency</p>
              <p className="text-sm sm:text-base text-gray-900">{request.sourceCurrency || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Destination Currency</p>
              <p className="text-sm sm:text-base text-gray-900">{request.destinationCurrency || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Amount</p>
              <p className="text-sm sm:text-base text-gray-900 font-semibold">
                {formatCurrency(request.amount, request.sourceCurrency)}
              </p>
            </div>
            {request.convertedAmount && (
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Converted Amount</p>
                <p className="text-sm sm:text-base text-gray-900 font-semibold">
                  {formatCurrency(request.convertedAmount, request.destinationCurrency)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Exchange Rate Information */}
        {request.exchangeRate && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Exchange Rate Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Exchange Rate</p>
                <p className="text-sm sm:text-base text-gray-900 font-semibold">
                  1 {request.sourceCurrency} = {request.exchangeRate} {request.destinationCurrency}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Exchange Rate Date</p>
                <p className="text-sm sm:text-base text-gray-900">
                  {request.exchangeRateDate ? formatDate(request.exchangeRateDate) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Exchange Rate Source</p>
                <p className="text-sm sm:text-base text-gray-900 capitalize">
                  {request.exchangeRateSource || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reason */}
        {request.reason && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Reason</h2>
            <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap">{request.reason}</p>
          </div>
        )}

        {/* Approval Information */}
        {request.approvedBy && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              {request.status === 'approved' ? 'Approval' : 'Rejection'} Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">
                  {request.status === 'approved' ? 'Approved By' : 'Rejected By'}
                </p>
                <div className="text-sm sm:text-base">
                  <p className="text-gray-900 font-medium">{request.approvedBy?.name || 'N/A'}</p>
                  <p className="text-gray-600 text-xs sm:text-sm">{request.approvedBy?.email || ''}</p>
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">
                  {request.status === 'approved' ? 'Approved' : 'Rejected'} At
                </p>
                <p className="text-sm sm:text-base text-gray-900">{formatDate(request.approvedAt)}</p>
              </div>
            </div>
            {request.rejectionReason && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs sm:text-sm text-gray-500 mb-2">Rejection Reason</p>
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{request.rejectionReason}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evidence Image */}
        {evidenceImageUrl && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Evidence</h2>
            <div className="mt-4">
              <img
                src={evidenceImageUrl}
                alt="Evidence"
                className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                onError={(e) => {
                  e.target.style.display = 'none'
                  const errorDiv = document.createElement('div')
                  errorDiv.className = 'text-sm text-gray-500'
                  errorDiv.textContent = 'Failed to load image'
                  e.target.parentNode.appendChild(errorDiv)
                }}
              />
            </div>
          </div>
        )}

        {/* Requested By */}
        {request.requestedBy && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Requested By</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Name</p>
                <p className="text-sm sm:text-base text-gray-900 font-medium">
                  {request.requestedBy?.name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Email</p>
                <p className="text-sm sm:text-base text-gray-900">
                  {request.requestedBy?.email || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default RequestDetails
