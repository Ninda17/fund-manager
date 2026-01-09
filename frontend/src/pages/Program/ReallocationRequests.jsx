import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'
import Input from '../../components/input/Input'

const ReallocationRequests = () => {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [allRequests, setAllRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  
  // Form state for creating request
  const [requestType, setRequestType] = useState('project_to_project')
  const [sourceProjectId, setSourceProjectId] = useState('')
  const [destinationProjectId, setDestinationProjectId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [sourceActivityId, setSourceActivityId] = useState('')
  const [destinationActivityId, setDestinationActivityId] = useState('')
  const [sourceSubactivityId, setSourceSubactivityId] = useState('')
  const [destinationSubactivityId, setDestinationSubactivityId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  
  // Data for dropdowns
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedSourceActivity, setSelectedSourceActivity] = useState(null)
  const [_selectedDestinationActivity, setSelectedDestinationActivity] = useState(null)

  useEffect(() => {
    fetchRequests()
    fetchProjects()
  }, [])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError('')
      const url = statusFilter 
        ? `${API_PATHS.PROGRAM.GET_REALLOCATION_REQUESTS}?status=${statusFilter}`
        : API_PATHS.PROGRAM.GET_REALLOCATION_REQUESTS
      
      const response = await axiosInstance.get(url)
      if (response.data.success) {
        const requestsData = response.data.data || []
        setAllRequests(requestsData)
        setRequests(requestsData)
      }
    } catch (error) {
      console.error('Error fetching reallocation requests:', error)
      setError(error.response?.data?.message || 'Failed to load reallocation requests.')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await axiosInstance.get(API_PATHS.PROGRAM.GET_PROJECTS)
      if (response.data.success) {
        setProjects(response.data.data || [])
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  useEffect(() => {
    let filtered = [...allRequests]

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(req => req.status === statusFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(req => {
        const sourceProject = req.sourceProject?.projectId || req.sourceProjectId?.projectId || req.sourceProjectId?.id?.toString() || req.sourceProjectId?._id?.toString() || ''
        const destProject = req.destinationProject?.projectId || req.destinationProjectId?.projectId || req.destinationProjectId?.id?.toString() || req.destinationProjectId?._id?.toString() || ''
        const project = req.project?.projectId || req.projectId?.projectId || req.projectId?.id?.toString() || req.projectId?._id?.toString() || ''
        const amountStr = req.amount?.toString() || ''
        const reasonStr = (req.reason || '').toLowerCase()
        const statusStr = (req.status || '').toLowerCase()
        const typeStr = (req.requestType || '').toLowerCase()
        
        return (
          sourceProject.toLowerCase().includes(query) ||
          destProject.toLowerCase().includes(query) ||
          project.toLowerCase().includes(query) ||
          amountStr.includes(query) ||
          reasonStr.includes(query) ||
          statusStr.includes(query) ||
          typeStr.includes(query)
        )
      })
    }

    setRequests(filtered)
  }, [statusFilter, searchQuery, allRequests])

  const handleCreateRequest = async (e) => {
    e.preventDefault()
    setError('')
    
    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount must be a positive number')
      return
    }
    
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }

    if (requestType === 'project_to_project') {
      if (!sourceProjectId || !destinationProjectId) {
        setError('Please select both source and destination projects')
        return
      }
    } else if (requestType === 'activity_to_activity') {
      if (!projectId || !sourceActivityId || !destinationActivityId) {
        setError('Please select project and both activities')
        return
      }
    } else if (requestType === 'subactivity_to_subactivity') {
      if (!projectId || !sourceActivityId || !destinationActivityId || !sourceSubactivityId || !destinationSubactivityId) {
        setError('Please fill all required fields')
        return
      }
    }

    setCreateLoading(true)

    try {
      const requestData = {
        requestType,
        amount: parseFloat(amount),
        reason: reason.trim(),
      }

      if (requestType === 'project_to_project') {
        requestData.sourceProjectId = sourceProjectId
        requestData.destinationProjectId = destinationProjectId
      } else {
        requestData.projectId = projectId
        requestData.sourceActivityId = sourceActivityId
        requestData.destinationActivityId = destinationActivityId
        if (requestType === 'subactivity_to_subactivity') {
          requestData.sourceSubactivityId = sourceSubactivityId
          requestData.destinationSubactivityId = destinationSubactivityId
        }
      }

      const response = await axiosInstance.post(
        API_PATHS.PROGRAM.CREATE_REALLOCATION_REQUEST,
        requestData
      )

      if (response.data.success) {
        // Reset form
        setRequestType('project_to_project')
        setSourceProjectId('')
        setDestinationProjectId('')
        setProjectId('')
        setSourceActivityId('')
        setDestinationActivityId('')
        setSourceSubactivityId('')
        setDestinationSubactivityId('')
        setAmount('')
        setReason('')
        setSelectedProject(null)
        setSelectedSourceActivity(null)
        setSelectedDestinationActivity(null)
        setShowCreateModal(false)
        
        // Refresh requests
        fetchRequests()
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to create reallocation request.'
      setError(errorMessage)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleProjectSelect = async (projectIdValue) => {
    setProjectId(projectIdValue)
    setSourceActivityId('')
    setDestinationActivityId('')
    setSourceSubactivityId('')
    setDestinationSubactivityId('')
    setSelectedSourceActivity(null)
    setSelectedDestinationActivity(null)
    
    // Fetch full project details to get activities
    try {
      const response = await axiosInstance.get(API_PATHS.PROGRAM.GET_PROJECT_BY_ID(projectIdValue))
      if (response.data.success) {
        setSelectedProject(response.data.data)
      } else {
        const project = projects.find(p => (p.id || p._id)?.toString() === projectIdValue?.toString())
        setSelectedProject(project)
      }
    } catch (error) {
      console.error('Error fetching project details:', error)
      const project = projects.find(p => (p.id || p._id)?.toString() === projectIdValue?.toString())
      setSelectedProject(project)
    }
  }

  const handleSourceActivitySelect = (activityId) => {
    setSourceActivityId(activityId)
    if (selectedProject) {
      const activity = selectedProject.activities?.find(
        a => (a.id || a._id)?.toString() === activityId?.toString() || a.activityId === activityId
      )
      setSelectedSourceActivity(activity)
    }
    setSourceSubactivityId('')
  }

  const handleDestinationActivitySelect = (activityId) => {
    setDestinationActivityId(activityId)
    if (selectedProject) {
      const activity = selectedProject.activities?.find(
        a => (a.id || a._id)?.toString() === activityId?.toString() || a.activityId === activityId
      )
      setSelectedDestinationActivity(activity)
    }
    setDestinationSubactivityId('')
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

  const getSourceDisplay = (request) => {
    if (request.requestType === 'project_to_project') {
      const project = request.sourceProject || request.sourceProjectId
      return project?.projectId || project?.title || 'N/A'
    } else if (request.requestType === 'activity_to_activity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Activity`
    } else if (request.requestType === 'subactivity_to_subactivity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Subactivity`
    }
    return 'N/A'
  }

  const getDestinationDisplay = (request) => {
    if (request.requestType === 'project_to_project') {
      const project = request.destinationProject || request.destinationProjectId
      return project?.projectId || project?.title || 'N/A'
    } else if (request.requestType === 'activity_to_activity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Activity`
    } else if (request.requestType === 'subactivity_to_subactivity') {
      const project = request.project || request.projectId
      const projectName = project?.projectId || project?.title || 'N/A'
      return `${projectName} - Subactivity`
    }
    return 'N/A'
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-lg">Loading reallocation requests...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Reallocation Requests</h1>
            <p className="text-gray-600 text-sm sm:text-base">Manage your fund reallocation requests</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-opacity-90 transition-colors"
          >
            + Create Request
          </button>
        </div>

        {/* Search Bar */}
        {allRequests.length > 0 && (
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
                placeholder="Search by project IDs, amounts, reasons, status, or type..."
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
                {requests.length === 0 ? (
                  <span>No requests found matching "{searchQuery}"</span>
                ) : (
                  <span>
                    Found {requests.length} {requests.length === 1 ? 'request' : 'requests'} matching "{searchQuery}"
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Status Filter */}
        {allRequests.length > 0 && (
          <div className="mb-6">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-48 px-4 py-2 sm:py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm sm:text-base"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Requests List */}
        {allRequests.length === 0 ? (
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
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reallocation requests found</h3>
            <p className="text-gray-500 mb-6">Create your first reallocation request to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-opacity-90 transition-colors"
            >
              Create Request
            </button>
          </div>
        ) : requests.length === 0 ? (
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
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No matching requests</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search query or status filter</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('')
              }}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Destination
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((request) => (
                      <tr 
                        key={request.id || request._id} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/program/reallocations/${request.id || request._id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{formatDate(request.createdAt)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{getSourceDisplay(request)}</div>
                            <div className="text-gray-500 text-xs mt-0.5">{getRequestTypeLabel(request.requestType)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{getDestinationDisplay(request)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(request.amount, request.sourceCurrency)}
                            </div>
                            {request.sourceCurrency !== request.destinationCurrency && (
                              <div className="text-gray-500 text-xs">
                                → {formatCurrency(request.convertedAmount || request.amount, request.destinationCurrency)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {request.approvedBy ? (
                              <>
                                <div className="font-medium text-gray-900">{request.approvedBy?.name || 'N/A'}</div>
                                <div className="text-gray-500 text-xs">{request.approvedBy?.email || ''}</div>
                              </>
                            ) : (
                              <span className="text-gray-500">Pending</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getStatusBadgeStyle(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id || request._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/program/reallocations/${request.id || request._id}`)}
                >
                  <div className="space-y-3">
                    {/* Status and Type */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeStyle(request.status)}`}>
                        {request.status}
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {getRequestTypeLabel(request.requestType)}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 block mb-1">Date</span>
                      <span className="text-sm font-medium text-gray-900">{formatDate(request.createdAt)}</span>
                    </div>

                    {/* Source */}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 block mb-1">Source</span>
                      <span className="text-sm font-medium text-gray-900">{getSourceDisplay(request)}</span>
                    </div>

                    {/* Destination */}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 block mb-1">Destination</span>
                      <span className="text-sm font-medium text-gray-900">{getDestinationDisplay(request)}</span>
                    </div>

                    {/* Amount */}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 block mb-1">Amount</span>
                      <div className="text-sm">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(request.amount, request.sourceCurrency)}
                        </div>
                        {request.sourceCurrency !== request.destinationCurrency && (
                          <div className="text-gray-500 text-xs mt-0.5">
                            → {formatCurrency(request.convertedAmount || request.amount, request.destinationCurrency)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Approved By */}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 block mb-1">Approved By</span>
                      {request.approvedBy ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{request.approvedBy?.name || 'N/A'}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{request.approvedBy?.email || ''}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Pending</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Request Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto z-50">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Create Reallocation Request</h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setError('')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleCreateRequest}>
                  <div className="space-y-4">
                    {/* Request Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Request Type *
                      </label>
                      <select
                        value={requestType}
                        onChange={(e) => {
                          setRequestType(e.target.value)
                          setError('')
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="project_to_project">Project to Project</option>
                        <option value="activity_to_activity">Activity to Activity</option>
                        <option value="subactivity_to_subactivity">Subactivity to Subactivity</option>
                      </select>
                    </div>

                    {/* Project to Project Fields */}
                    {requestType === 'project_to_project' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Source Project *
                          </label>
                          <select
                            value={sourceProjectId}
                            onChange={(e) => {
                              setSourceProjectId(e.target.value)
                              setError('')
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select source project</option>
                            {projects.map(project => (
                              <option key={project.id || project._id} value={project.id || project._id}>
                                {project.projectId} - {project.title} ({formatCurrency(project.amountDonated, project.currency)})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Destination Project *
                          </label>
                          <select
                            value={destinationProjectId}
                            onChange={(e) => {
                              setDestinationProjectId(e.target.value)
                              setError('')
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select destination project</option>
                            {projects.map(project => (
                              <option key={project.id || project._id} value={project.id || project._id}>
                                {project.projectId} - {project.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Activity to Activity Fields */}
                    {requestType === 'activity_to_activity' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Project *
                          </label>
                          <select
                            value={projectId}
                            onChange={(e) => {
                              handleProjectSelect(e.target.value)
                              setError('')
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select project</option>
                            {projects.map(project => (
                              <option key={project.id || project._id} value={project.id || project._id}>
                                {project.projectId} - {project.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedProject && selectedProject.activities && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Source Activity *
                              </label>
                              <select
                                value={sourceActivityId}
                                onChange={(e) => {
                                  handleSourceActivitySelect(e.target.value)
                                  setError('')
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="">Select source activity</option>
                                {selectedProject.activities.map(activity => (
                                  <option key={activity.id || activity._id || activity.activityId} value={activity.id || activity._id || activity.activityId}>
                                    {activity.name || activity.activityId} ({formatCurrency(activity.budget, selectedProject.currency)})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Destination Activity *
                              </label>
                              <select
                                value={destinationActivityId}
                                onChange={(e) => {
                                  handleDestinationActivitySelect(e.target.value)
                                  setError('')
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="">Select destination activity</option>
                                {selectedProject.activities
                                  .filter(a => (a.id || a._id || a.activityId)?.toString() !== sourceActivityId?.toString())
                                  .map(activity => (
                                    <option key={activity.id || activity._id || activity.activityId} value={activity.id || activity._id || activity.activityId}>
                                      {activity.name || activity.activityId}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Subactivity to Subactivity Fields */}
                    {requestType === 'subactivity_to_subactivity' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Project *
                          </label>
                          <select
                            value={projectId}
                            onChange={(e) => {
                              handleProjectSelect(e.target.value)
                              setError('')
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select project</option>
                            {projects.map(project => (
                              <option key={project.id || project._id} value={project.id || project._id}>
                                {project.projectId} - {project.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedProject && selectedProject.activities && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Activity *
                              </label>
                              <select
                                value={sourceActivityId}
                                onChange={(e) => {
                                  handleSourceActivitySelect(e.target.value)
                                  setDestinationActivityId(e.target.value)
                                  setError('')
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="">Select activity</option>
                                {selectedProject.activities.map(activity => (
                                  <option key={activity.id || activity._id || activity.activityId} value={activity.id || activity._id || activity.activityId}>
                                    {activity.name || activity.activityId}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {selectedSourceActivity && selectedSourceActivity.subActivities && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Source Subactivity *
                                  </label>
                                  <select
                                    value={sourceSubactivityId}
                                    onChange={(e) => {
                                      setSourceSubactivityId(e.target.value)
                                      setError('')
                                    }}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                  >
                                    <option value="">Select source subactivity</option>
                                    {selectedSourceActivity.subActivities.map(sub => (
                                      <option key={sub.id || sub._id || sub.subactivityId} value={sub.id || sub._id || sub.subactivityId}>
                                        {sub.name || sub.subactivityId} ({formatCurrency(sub.budget, selectedProject.currency)})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Destination Subactivity *
                                  </label>
                                  <select
                                    value={destinationSubactivityId}
                                    onChange={(e) => {
                                      setDestinationSubactivityId(e.target.value)
                                      setError('')
                                    }}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                  >
                                    <option value="">Select destination subactivity</option>
                                    {selectedSourceActivity.subActivities
                                      .filter(s => (s.id || s._id || s.subactivityId)?.toString() !== sourceSubactivityId?.toString())
                                      .map(sub => (
                                        <option key={sub.id || sub._id || sub.subactivityId} value={sub.id || sub._id || sub.subactivityId}>
                                          {sub.name || sub.subactivityId}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Amount */}
                    <Input
                      label="Amount *"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value)
                        setError('')
                      }}
                      min="0"
                      step="0.01"
                    />

                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason *
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value)
                          setError('')
                        }}
                        placeholder="Enter reason for reallocation"
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        setError('')
                      }}
                      className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className={`px-6 py-2 bg-primary text-white font-medium rounded-md hover:bg-opacity-90 ${
                        createLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {createLoading ? 'Creating...' : 'Create Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default ReallocationRequests
