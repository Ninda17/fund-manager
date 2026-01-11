import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import Input from '../../components/input/Input'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'

const EditProject = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  
  // Form state - only financial fields
  const [donorName, setDonorName] = useState('')
  const [amountDonated, setAmountDonated] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [totalExpense, setTotalExpense] = useState('')
  const [activities, setActivities] = useState([])
  
  // Read-only display fields
  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [projectType, setProjectType] = useState('')
  const [projectStatus, setProjectStatus] = useState('')
  
  // Loading and error states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Fetch project details on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')
        
        // Fetch project details
        const projectResponse = await axiosInstance.get(API_PATHS.FINANCE.GET_PROJECT_BY_ID(id))
        if (projectResponse.data.success) {
          const project = projectResponse.data.data
          
          // Format dates for display (YYYY-MM-DD)
          const formatDateForInput = (dateString) => {
            if (!dateString) return ''
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().split('T')[0]
          }
          
          // Set read-only display fields
          setProjectId(project.projectId || '')
          setTitle(project.title || '')
          setDescription(project.description || '')
          setStartDate(formatDateForInput(project.startDate))
          setEndDate(formatDateForInput(project.endDate))
          setProjectType(project.projectType || '')
          setProjectStatus(project.projectStatus || '')
          
          // Set editable financial fields
          setDonorName(project.donorName || '')
          setAmountDonated(project.amountDonated?.toString() || '')
          setCurrency(project.currency || 'USD')
          setTotalExpense(project.totalExpense?.toString() || '')
          
          // Set activities with proper structure (only budget and expense are editable)
          if (project.activities && Array.isArray(project.activities)) {
            const formattedActivities = project.activities.map(activity => ({
              id: activity.id || activity._id,
              _id: activity.id || activity._id, // Keep _id for compatibility
              activityId: activity.activityId || '',
              name: activity.name || '',
              description: activity.description || '',
              budget: activity.budget?.toString() || '',
              expense: activity.expense?.toString() || '',
              projectStatus: activity.projectStatus || 'Not Started',
              subActivities: (activity.subActivities || []).map(sub => ({
                id: sub.id || sub._id,
                _id: sub.id || sub._id, // Keep _id for compatibility
                subactivityId: sub.subactivityId || '',
                name: sub.name || '',
                budget: sub.budget?.toString() || '',
                expense: sub.expense?.toString() || ''
              }))
            }))
            setActivities(formattedActivities)
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setError(error.response?.data?.message || 'Failed to load project details. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    
    if (id) {
      fetchData()
    }
  }, [id])
  
  // Update activity budget or expense
  const updateActivity = (index, field, value) => {
    const updated = [...activities]
    if (field === 'budget' || field === 'expense') {
      updated[index][field] = value
      setActivities(updated)
    }
  }
  
  // Update subactivity budget or expense
  const updateSubActivity = (activityIndex, subIndex, field, value) => {
    const updated = [...activities]
    if (field === 'budget' || field === 'expense') {
      updated[activityIndex].subActivities[subIndex][field] = value
      setActivities(updated)
    }
  }
  
  // Check if form is valid
  const isFormValid = () => {
    // Check basic required fields
    if (!donorName.trim() || !amountDonated) {
      return false
    }
    
    // Check if amountDonated is valid
    if (parseFloat(amountDonated) < 0 || isNaN(parseFloat(amountDonated))) {
      return false
    }
    
    return true
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // Validation
    if (!donorName.trim()) {
      setError('Donor name is required')
      return
    }
    
    if (!amountDonated || parseFloat(amountDonated) < 0) {
      setError('Amount donated must be a non-negative number')
      return
    }
    
    setSaving(true)
    
    try {
      // Prepare activities data - only include budget and expense fields
      const activitiesData = activities.map(activity => ({
        id: activity.id || activity._id,
        _id: activity.id || activity._id, // Keep _id for compatibility
        activityId: activity.activityId,
        budget: activity.budget ? parseFloat(activity.budget) : undefined,
        expense: activity.expense ? parseFloat(activity.expense) : undefined,
        subActivities: (activity.subActivities || []).map(sub => ({
          id: sub.id || sub._id,
          _id: sub.id || sub._id, // Keep _id for compatibility
          subactivityId: sub.subactivityId,
          budget: sub.budget ? parseFloat(sub.budget) : undefined,
          expense: sub.expense ? parseFloat(sub.expense) : undefined
        }))
      }))
      
      const projectData = {
        donorName: donorName.trim(),
        amountDonated: parseFloat(amountDonated),
        currency,
      }
      
      // Include activities if project has activities
      if (activities && activities.length > 0) {
        projectData.activities = activitiesData
      } else {
        // Include totalExpense if project has no activities
        if (totalExpense) {
          projectData.totalExpense = parseFloat(totalExpense)
        }
      }
      
      const response = await axiosInstance.put(
        API_PATHS.FINANCE.UPDATE_PROJECT(id),
        projectData
      )
      
      if (response.data.success) {
        // Navigate back to project details
        navigate(`/finance/projects/${id}`)
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to update project. Please try again.'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">
              Loading project details...
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Project Financial Information</h1>
          <p className="text-gray-600">Update financial details only</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            {/* Read-only Project Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information (Read-only)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Project ID
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {projectId || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Project Title
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {title || 'N/A'}
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Description
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700 min-h-[80px]">
                  {description || 'N/A'}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Start Date
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {startDate || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    End Date
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {endDate || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Project Type
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {projectType || 'N/A'}
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Project Status
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                  {projectStatus || 'N/A'}
                </div>
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-gray-200 my-10"></div>
            
            {/* Editable Funding Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Funding Information (Editable)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <Input
                  label="Donor Name *"
                  placeholder="Enter donor name"
                  value={donorName}
                  onChange={(e) => {
                    setDonorName(e.target.value)
                    setError('')
                  }}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Amount Donated *"
                    type="number"
                    placeholder="0.00"
                    value={amountDonated}
                    onChange={(e) => {
                      setAmountDonated(e.target.value)
                      setError('')
                    }}
                    min="0"
                    step="0.01"
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency *
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value)
                        setError('')
                      }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="BTN">BTN</option>
                    </select>
                  </div>
                </div>
                
                {/* Show totalExpense field only when project has no activities */}
                {(!activities || activities.length === 0) && (
                  <div className="mt-4">
                    <Input
                      label="Total Expense *"
                      type="number"
                      placeholder="0.00"
                      value={totalExpense}
                      onChange={(e) => {
                        setTotalExpense(e.target.value)
                        setError('')
                      }}
                      min="0"
                      step="0.01"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Set project-level expense when there are no activities
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-gray-200 my-10"></div>
            
            {/* Activities - Budget and Expense Only */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activities - Budget & Expense (Editable)</h2>
              
              {activities.map((activity, activityIndex) => (
                <div key={activityIndex} className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <div className="mb-4">
                    <h3 className="text-md font-medium text-gray-800 mb-2">Activity {activityIndex + 1}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div><span className="font-medium">ID:</span> {activity.activityId || 'N/A'}</div>
                      <div><span className="font-medium">Name:</span> {activity.name || 'N/A'}</div>
                      {activity.description && (
                        <div><span className="font-medium">Description:</span> {activity.description}</div>
                      )}
                      <div><span className="font-medium">Status:</span> {activity.projectStatus || 'Not Started'}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input
                      label="Activity Budget"
                      type="number"
                      placeholder="0.00"
                      value={activity.budget}
                      onChange={(e) => updateActivity(activityIndex, 'budget', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    
                    <div>
                      <Input
                        label={`Activity Expense${activity.subActivities && activity.subActivities.length > 0 ? ' (Calculated from sub-activities)' : ' (Editable)'}`}
                        type="number"
                        placeholder="0.00"
                        value={activity.expense}
                        onChange={(e) => updateActivity(activityIndex, 'expense', e.target.value)}
                        min="0"
                        step="0.01"
                        disabled={activity.subActivities && activity.subActivities.length > 0}
                      />
                      {activity.subActivities && activity.subActivities.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          Expense is calculated from sub-activity expenses
                        </p>
                      )}
                      {(!activity.subActivities || activity.subActivities.length === 0) && (
                        <p className="mt-1 text-xs text-gray-500">
                          Set expense directly when activity has no sub-activities
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Sub-Activities */}
                  {activity.subActivities && activity.subActivities.length > 0 && (
                    <div className="ml-4 border-l-2 border-gray-200 pl-4 mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Sub-Activities</h4>
                      
                      {activity.subActivities.map((subActivity, subIndex) => (
                        <div key={subIndex} className="mb-3 p-3 bg-gray-50 rounded-md">
                          <div className="mb-2">
                            <span className="text-xs text-gray-600 font-medium">Sub-Activity {subIndex + 1}</span>
                            <div className="text-xs text-gray-600 mt-1">
                              <div><span className="font-medium">ID:</span> {subActivity.subactivityId || 'N/A'}</div>
                              <div><span className="font-medium">Name:</span> {subActivity.name || 'N/A'}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              label="Budget"
                              type="number"
                              placeholder="0.00"
                              value={subActivity.budget}
                              onChange={(e) => updateSubActivity(activityIndex, subIndex, 'budget', e.target.value)}
                              min="0"
                              step="0.01"
                            />
                            
                            <Input
                              label="Expense"
                              type="number"
                              placeholder="0.00"
                              value={subActivity.expense}
                              onChange={(e) => updateSubActivity(activityIndex, subIndex, 'expense', e.target.value)}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {activities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No activities found in this project.
                </div>
              )}
            </div>
            
            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate(`/finance/projects/${id}`)}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !isFormValid()}
                className={`px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-opacity-90 transition-colors ${
                  saving || !isFormValid() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {saving ? 'Updating...' : 'Update Financial Information'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default EditProject
