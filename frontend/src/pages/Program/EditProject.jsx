import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import Input from '../../components/input/Input'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'

const EditProject = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  
  // Form state - editable non-financial fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [financePersonnel, setFinancePersonnel] = useState('')
  const [projectType, setProjectType] = useState('Education')
  const [projectStatus, setProjectStatus] = useState('Not Started')
  const [activities, setActivities] = useState([])
  
  // Read-only display fields (financial)
  const [projectId, setProjectId] = useState('')
  const [donorName, setDonorName] = useState('')
  const [amountDonated, setAmountDonated] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [totalExpense, setTotalExpense] = useState('')
  
  // Finance users list
  const [financeUsers, setFinanceUsers] = useState([])
  const [loadingFinanceUsers, setLoadingFinanceUsers] = useState(true)
  
  // Loading and error states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Fetch finance users on mount
  useEffect(() => {
    const fetchFinanceUsers = async () => {
      try {
        setLoadingFinanceUsers(true)
        const response = await axiosInstance.get(API_PATHS.PROGRAM.FINANCE_PERSONNEL)
        if (response.data.success) {
          setFinanceUsers(response.data.data)
        }
      } catch (error) {
        console.error('Error fetching finance users:', error)
      } finally {
        setLoadingFinanceUsers(false)
      }
    }
    
    fetchFinanceUsers()
  }, [])

  // Fetch project details on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')
        
        // Fetch project details
        const projectResponse = await axiosInstance.get(API_PATHS.PROGRAM.GET_PROJECT_BY_ID(id))
        if (projectResponse.data.success) {
          const project = projectResponse.data.data
          
          // Format dates for display (YYYY-MM-DD)
          const formatDateForInput = (dateString) => {
            if (!dateString) return ''
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().split('T')[0]
          }
          
          // Set editable non-financial fields
          setTitle(project.title || '')
          setDescription(project.description || '')
          setStartDate(formatDateForInput(project.startDate))
          setEndDate(formatDateForInput(project.endDate))
          // Handle financePersonnel - could be populated object or just ID string
          const financePersonnelId = project.financePersonnel?._id 
            ? project.financePersonnel._id.toString()
            : (project.financePersonnel ? project.financePersonnel.toString() : '')
          setFinancePersonnel(financePersonnelId)
          setProjectType(project.projectType || 'Education')
          setProjectStatus(project.projectStatus || 'Not Started')
          
          // Set read-only financial fields
          setProjectId(project.projectId || '')
          setDonorName(project.donorName || '')
          setAmountDonated(project.amountDonated?.toString() || '')
          setCurrency(project.currency || 'USD')
          setTotalExpense(project.totalExpense?.toString() || '')
          
          // Set activities with proper structure (only non-financial fields are editable)
          if (project.activities && Array.isArray(project.activities)) {
            const formattedActivities = project.activities.map(activity => ({
              _id: activity._id,
              activityId: activity.activityId || '',
              name: activity.name || '',
              description: activity.description || '',
              projectStatus: activity.projectStatus || 'Not Started',
              budget: activity.budget?.toString() || '', // Read-only
              expense: activity.expense?.toString() || '', // Read-only
              subActivities: (activity.subActivities || []).map(sub => ({
                _id: sub._id,
                subactivityId: sub.subactivityId || '',
                name: sub.name || '',
                budget: sub.budget?.toString() || '', // Read-only
                expense: sub.expense?.toString() || '' // Read-only
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
  
  // Update activity non-financial fields
  const updateActivity = (index, field, value) => {
    const updated = [...activities]
    if (field === 'name' || field === 'description' || field === 'activityId' || field === 'projectStatus') {
      updated[index][field] = value
      setActivities(updated)
    }
  }
  
  // Update subactivity non-financial fields
  const updateSubActivity = (activityIndex, subIndex, field, value) => {
    const updated = [...activities]
    if (field === 'name' || field === 'subactivityId') {
      updated[activityIndex].subActivities[subIndex][field] = value
      setActivities(updated)
    }
  }
  
  // Check if form is valid
  const isFormValid = () => {
    // Check basic required fields
    if (!title.trim()) {
      return false
    }
    
    if (!startDate) {
      return false
    }
    
    if (!endDate) {
      return false
    }
    
    if (!financePersonnel || financePersonnel === '') {
      return false
    }
    
    // Check if endDate is after startDate
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return false
    }
    
    return true
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // Validation
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    
    if (!startDate) {
      setError('Start date is required')
      return
    }
    
    if (!endDate) {
      setError('End date is required')
      return
    }
    
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date')
      return
    }
    
    if (!financePersonnel) {
      setError('Finance personnel is required')
      return
    }
    
    setSaving(true)
    
    try {
      // Prepare activities data - only include non-financial fields
      const activitiesData = activities.map(activity => {
        const activityData = {
          _id: activity._id,
          activityId: activity.activityId,
        }
        
        // Only include fields that have values
        if (activity.name !== undefined && activity.name !== null && activity.name.trim() !== '') {
          activityData.name = activity.name.trim()
        }
        
        if (activity.description !== undefined) {
          activityData.description = activity.description.trim()
        }
        
        if (activity.projectStatus !== undefined && activity.projectStatus !== null) {
          activityData.projectStatus = activity.projectStatus
        }
        
        // Handle subActivities
        if (activity.subActivities && activity.subActivities.length > 0) {
          activityData.subActivities = activity.subActivities.map(sub => {
            const subData = {
              _id: sub._id,
              subactivityId: sub.subactivityId,
            }
            
            // Only include name if it has a value
            if (sub.name !== undefined && sub.name !== null && sub.name.trim() !== '') {
              subData.name = sub.name.trim()
            }
            
            return subData
          })
        }
        
        return activityData
      })
      
      const projectData = {
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        financePersonnel,
        projectType,
        projectStatus,
      }
      
      // Include activities if project has activities
      if (activities && activities.length > 0) {
        projectData.activities = activitiesData
      }
      
      const response = await axiosInstance.put(
        API_PATHS.PROGRAM.UPDATE_PROJECT(id),
        projectData
      )
      
      if (response.data.success) {
        // Navigate back to project details
        navigate(`/program/projects/${id}`)
      }
    } catch (error) {
      console.error('Error updating project:', error)
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
          <div className="text-lg">Loading project details...</div>
        </div>
      </DashboardLayout>
    )
  }
  
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Project</h1>
          <p className="text-gray-600">Update project information (non-financial fields only)</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            {/* Read-only Financial Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Information (Read-only)</h2>
              
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
                    Donor Name
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {donorName || 'N/A'}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Amount Donated
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {amountDonated ? `${amountDonated} ${currency}` : 'N/A'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Currency
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {currency || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Total Expense
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                    {totalExpense ? `${totalExpense} ${currency}` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-gray-200 my-10"></div>
            
            {/* Editable Project Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information (Editable)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <Input
                  label="Project Title *"
                  placeholder="Enter project title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setError('')
                  }}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value)
                      setError('')
                    }}
                    placeholder="Enter project description"
                    rows={4}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Start Date *"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setError('')
                    }}
                  />
                  
                  <Input
                    label="End Date *"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setError('')
                    }}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Finance Personnel *
                    </label>
                    <select
                      value={financePersonnel}
                      onChange={(e) => {
                        setFinancePersonnel(e.target.value)
                        setError('')
                      }}
                      disabled={loadingFinanceUsers}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select finance personnel</option>
                      {financeUsers.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                    {loadingFinanceUsers && (
                      <p className="mt-1 text-xs text-gray-500">Loading finance personnel...</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Type *
                    </label>
                    <select
                      value={projectType}
                      onChange={(e) => {
                        setProjectType(e.target.value)
                        setError('')
                      }}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="Education">Education</option>
                      <option value="Welfare">Welfare</option>
                      <option value="Youth">Youth</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Status *
                  </label>
                  <select
                    value={projectStatus}
                    onChange={(e) => {
                      setProjectStatus(e.target.value)
                      setError('')
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-gray-200 my-10"></div>
            
            {/* Activities - Non-financial Fields Only */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activities - Information (Editable)</h2>
              
              {activities.map((activity, activityIndex) => (
                <div key={activityIndex} className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <div className="mb-4">
                    <h3 className="text-md font-medium text-gray-800 mb-2">Activity {activityIndex + 1}</h3>
                    
                    {/* Read-only financial info */}
                    <div className="mb-3 p-2 bg-gray-50 rounded-md">
                      <div className="text-xs text-gray-600 space-y-1">
                        <div><span className="font-medium">Budget:</span> {activity.budget ? `${activity.budget} ${currency}` : 'N/A'}</div>
                        <div><span className="font-medium">Expense:</span> {activity.expense ? `${activity.expense} ${currency}` : 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input
                      label="Activity ID"
                      placeholder="Enter activity ID"
                      value={activity.activityId}
                      onChange={(e) => updateActivity(activityIndex, 'activityId', e.target.value)}
                    />
                    
                    <Input
                      label="Activity Name"
                      placeholder="Enter activity name"
                      value={activity.name}
                      onChange={(e) => updateActivity(activityIndex, 'name', e.target.value)}
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Activity Description
                    </label>
                    <textarea
                      value={activity.description}
                      onChange={(e) => updateActivity(activityIndex, 'description', e.target.value)}
                      placeholder="Enter activity description"
                      rows={3}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Activity Status
                    </label>
                    <select
                      value={activity.projectStatus}
                      onChange={(e) => updateActivity(activityIndex, 'projectStatus', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  
                  {/* Sub-Activities */}
                  {activity.subActivities && activity.subActivities.length > 0 && (
                    <div className="ml-4 border-l-2 border-gray-200 pl-4 mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Sub-Activities</h4>
                      
                      {activity.subActivities.map((subActivity, subIndex) => (
                        <div key={subIndex} className="mb-3 p-3 bg-gray-50 rounded-md">
                          <div className="mb-2">
                            <span className="text-xs text-gray-600 font-medium">Sub-Activity {subIndex + 1}</span>
                            {/* Read-only financial info */}
                            <div className="mt-1 text-xs text-gray-600 space-y-1">
                              <div><span className="font-medium">Budget:</span> {subActivity.budget ? `${subActivity.budget} ${currency}` : 'N/A'}</div>
                              <div><span className="font-medium">Expense:</span> {subActivity.expense ? `${subActivity.expense} ${currency}` : 'N/A'}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              label="Sub-Activity ID"
                              placeholder="Enter sub-activity ID"
                              value={subActivity.subactivityId}
                              onChange={(e) => updateSubActivity(activityIndex, subIndex, 'subactivityId', e.target.value)}
                            />
                            
                            <Input
                              label="Sub-Activity Name"
                              placeholder="Enter sub-activity name"
                              value={subActivity.name}
                              onChange={(e) => updateSubActivity(activityIndex, subIndex, 'name', e.target.value)}
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
            <div className="flex justify-end space-x-4 items-center">
              {/* Debug info - show why button is disabled */}
              {!isFormValid() && !saving && (
                <div className="text-sm text-gray-500 mr-4">
                  {!title.trim() && <span>Title required</span>}
                  {title.trim() && !startDate && <span>Start date required</span>}
                  {title.trim() && startDate && !endDate && <span>End date required</span>}
                  {title.trim() && startDate && endDate && !financePersonnel && <span>Finance personnel required</span>}
                  {title.trim() && startDate && endDate && financePersonnel && new Date(endDate) < new Date(startDate) && (
                    <span>End date must be after start date</span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate(`/program/projects/${id}`)}
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
                {saving ? 'Updating...' : 'Update Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default EditProject
