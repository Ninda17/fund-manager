import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import Input from '../../components/input/Input'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'

const EditProject = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  
  // Form state
  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [financePersonnel, setFinancePersonnel] = useState('')
  const [donorName, setDonorName] = useState('')
  const [amountDonated, setAmountDonated] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [projectType, setProjectType] = useState('Education')
  const [projectStatus, setProjectStatus] = useState('Not Started')
  const [activities, setActivities] = useState([])
  
  // Finance users list
  const [financeUsers, setFinanceUsers] = useState([])
  const [loadingFinanceUsers, setLoadingFinanceUsers] = useState(true)
  
  // Loading and error states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Fetch project details and finance users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')
        
        // Fetch project details
        const projectResponse = await axiosInstance.get(API_PATHS.PROGRAM.GET_PROJECT_BY_ID(id))
        if (projectResponse.data.success) {
          const project = projectResponse.data.data
          
          // Format dates for input fields (YYYY-MM-DD)
          const formatDateForInput = (dateString) => {
            if (!dateString) return ''
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().split('T')[0]
          }
          
          setProjectId(project.projectId || '')
          setTitle(project.title || '')
          setDescription(project.description || '')
          setStartDate(formatDateForInput(project.startDate))
          setEndDate(formatDateForInput(project.endDate))
          // Use financePersonnelId (foreign key) or fallback to financePersonnel.id for compatibility
          setFinancePersonnel(project.financePersonnelId?.toString() || project.financePersonnel?.id?.toString() || project.financePersonnel?._id?.toString() || '')
          setDonorName(project.donorName || '')
          setAmountDonated(project.amountDonated?.toString() || '')
          setCurrency(project.currency || 'USD')
          setProjectType(project.projectType || 'Education')
          setProjectStatus(project.projectStatus || 'Not Started')
          
          // Set activities with proper structure
          if (project.activities && Array.isArray(project.activities)) {
            const formattedActivities = project.activities.map(activity => ({
              activityId: activity.activityId || '',
              name: activity.name || '',
              description: activity.description || '',
              budget: activity.budget?.toString() || '',
              projectStatus: activity.projectStatus || 'Not Started',
              subActivities: (activity.subActivities || []).map(sub => ({
                subactivityId: sub.subactivityId || '',
                name: sub.name || '',
                budget: sub.budget?.toString() || ''
              }))
            }))
            setActivities(formattedActivities)
          }
        }
        
        // Fetch finance users
        setLoadingFinanceUsers(true)
        const financeResponse = await axiosInstance.get(API_PATHS.PROGRAM.FINANCE_PERSONNEL)
        if (financeResponse.data.success) {
          setFinanceUsers(financeResponse.data.data)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setError(error.response?.data?.message || 'Failed to load project details. Please try again.')
      } finally {
        setLoading(false)
        setLoadingFinanceUsers(false)
      }
    }
    
    if (id) {
      fetchData()
    }
  }, [id])
  
  // Add new activity
  const addActivity = () => {
    setActivities([
      ...activities,
      {
        activityId: '',
        name: '',
        description: '',
        budget: '',
        projectStatus: 'Not Started',
        subActivities: []
      }
    ])
  }
  
  // Remove activity
  const removeActivity = (index) => {
    setActivities(activities.filter((_, i) => i !== index))
  }
  
  // Update activity
  const updateActivity = (index, field, value) => {
    const updated = [...activities]
    updated[index][field] = value
    setActivities(updated)
  }
  
  // Add sub-activity
  const addSubActivity = (activityIndex) => {
    const updated = [...activities]
    updated[activityIndex].subActivities.push({
      subactivityId: '',
      name: '',
      budget: ''
    })
    setActivities(updated)
  }
  
  // Remove sub-activity
  const removeSubActivity = (activityIndex, subIndex) => {
    const updated = [...activities]
    updated[activityIndex].subActivities = updated[activityIndex].subActivities.filter(
      (_, i) => i !== subIndex
    )
    setActivities(updated)
  }
  
  // Update sub-activity
  const updateSubActivity = (activityIndex, subIndex, field, value) => {
    const updated = [...activities]
    updated[activityIndex].subActivities[subIndex][field] = value
    setActivities(updated)
  }
  
  // Check if all required fields are filled
  const isFormValid = () => {
    // Check basic required fields
    if (!projectId.trim() || !title.trim() || !startDate || !endDate || !financePersonnel || !donorName.trim() || !amountDonated || financeUsers.length === 0) {
      return false
    }
    
    // Check if amountDonated is valid
    if (parseFloat(amountDonated) < 0 || isNaN(parseFloat(amountDonated))) {
      return false
    }
    
    // Check if endDate is after startDate
    if (new Date(endDate) < new Date(startDate)) {
      return false
    }
    
    return true
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // Validation
    if (!projectId.trim()) {
      setError('Project ID is required')
      return
    }
    
    if (!title.trim()) {
      setError('Project title is required')
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
      setError('Please select a finance personnel')
      return
    }
    
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
      // Prepare activities data
      const activitiesData = activities.map(activity => ({
        activityId: activity.activityId?.trim() || undefined,
        name: activity.name?.trim() || undefined,
        description: activity.description?.trim() || undefined,
        budget: activity.budget ? parseFloat(activity.budget) : 0,
        projectStatus: activity.projectStatus || 'Not Started',
        subActivities: (activity.subActivities || []).map(sub => ({
          subactivityId: sub.subactivityId?.trim() || undefined,
          name: sub.name?.trim() || undefined,
          budget: sub.budget ? parseFloat(sub.budget) : 0
        }))
      }))
      
      const projectData = {
        projectId: projectId.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        financePersonnel,
        donorName: donorName.trim(),
        amountDonated: parseFloat(amountDonated),
        currency,
        projectType,
        projectStatus,
        activities: activitiesData
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
          <p className="text-gray-600">Update project details</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Project ID *"
                  placeholder="e.g., PROJ001"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value)
                    setError('')
                  }}
                />
                
                <Input
                  label="Project Title *"
                  placeholder="Enter project title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setError('')
                  }}
                />
              </div>
              
              <div className="mt-4">
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
                  rows="3"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Dates */}
            <div className="mb-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setError('')
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setError('')
                    }}
                    min={startDate}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            {/* Finance Personnel */}
            <div className="mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Finance Personnel *
                </label>
                {loadingFinanceUsers ? (
                  <div className="text-gray-500">Loading finance personnel...</div>
                ) : financeUsers.length === 0 ? (
                  <div className="text-red-500">No verified and approved finance personnel available</div>
                ) : (
                  <select
                    value={financePersonnel}
                    onChange={(e) => {
                      setFinancePersonnel(e.target.value)
                      setError('')
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select finance personnel</option>
                    {financeUsers.map(user => (
                      <option key={user.id || user._id} value={user.id || user._id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-gray-200 my-10"></div>
            
            {/* Donor Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Funding Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <Input
                  label="Donor Name *"
                  placeholder="Enter donor name"
                  value={donorName}
                  onChange={(e) => {
                    setDonorName(e.target.value)
                    setError('')
                  }}
                  readOnly
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
                    readOnly
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
                      disabled
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="BTN">BTN</option>
                    </select>
                  </div>
                </div>
                  
              </div>
            </div>
            
            {/* Project Type and Status */}
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Project Type *
                  </label>
                  <select
                    value={projectType}
                    onChange={(e) => {
                      setProjectType(e.target.value)
                      setError('')
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="Social Development Program">Social Development Program</option>
                    <option value="Economic Development Program">Economic Development Program</option>
                    <option value="Environmental and Climate Change Program">Environmental and Climate Change Program</option>
                    <option value="Research Advocacy and Network Program">Research Advocacy and Network Program</option>
                  </select>
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
            
            {/* Activities */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Activities</h2>
                <button
                  type="button"
                  onClick={addActivity}
                  className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
                >
                  + Add Activity
                </button>
              </div>
              
              {activities.map((activity, activityIndex) => (
                <div key={activityIndex} className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-md font-medium text-gray-800">Activity {activityIndex + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeActivity(activityIndex)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input
                      label="Activity ID"
                      placeholder="e.g., ACT001"
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
                      rows="2"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
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
                      readOnly
                    />
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Activity Status
                      </label>
                      <select
                        value={activity.projectStatus || 'Not Started'}
                        onChange={(e) => updateActivity(activityIndex, 'projectStatus', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Sub-Activities */}
                  <div className="ml-4 border-l-2 border-gray-200 pl-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Sub-Activities</h4>
                      <button
                        type="button"
                        onClick={() => addSubActivity(activityIndex)}
                        className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
                      >
                        + Add Sub-Activity
                      </button>
                    </div>
                    
                    {activity.subActivities.map((subActivity, subIndex) => (
                      <div key={subIndex} className="mb-3 p-3 bg-gray-50 rounded-md">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-600">Sub-Activity {subIndex + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeSubActivity(activityIndex, subIndex)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <Input
                            label="Sub-Activity ID"
                            placeholder="e.g., SUB001"
                            value={subActivity.subactivityId || ''}
                            onChange={(e) => updateSubActivity(activityIndex, subIndex, 'subactivityId', e.target.value)}
                          />
                          
                          <Input
                            label="Name"
                            placeholder="Enter sub-activity name"
                            value={subActivity.name}
                            onChange={(e) => updateSubActivity(activityIndex, subIndex, 'name', e.target.value)}
                          />
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
                            readOnly
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {activities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No activities added. Click "Add Activity" to get started.
                </div>
              )}
            </div>
            
            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
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

