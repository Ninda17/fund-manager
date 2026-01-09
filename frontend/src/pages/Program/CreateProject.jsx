import React, { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import Input from '../../components/input/Input'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'
import { useNavigate } from 'react-router-dom'

const CreateProject = () => {
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
  const [projectType, setProjectType] = useState('Social Development Program')
  const [activities, setActivities] = useState([])
  
  
  // Finance users list
  const [financeUsers, setFinanceUsers] = useState([])
  const [loadingFinanceUsers, setLoadingFinanceUsers] = useState(true)
  // Add to state declarations (after line 30)
  const [wordDocuments, setWordDocuments] = useState([])
  const [uploadingDocs, setUploadingDocs] = useState(false)
  
  // Form errors
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
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
        setError('Failed to load finance personnel. Please refresh the page.', error)
      } finally {
        setLoadingFinanceUsers(false)
      }
    }
    
    fetchFinanceUsers()
  }, [])
  
  // Add new activity
  const addActivity = () => {
    setActivities([
      ...activities,
      {
        activityId: '',
        name: '',
        description: '',
        budget: '',
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

  // Handle Word document file selection
  const handleDocumentChange = (e) => {
    const files = Array.from(e.target.files)
    
    // Validate file types
    const validTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-word.document.macroEnabled.12',
      'application/pdf'
    ]
    
    const validExtensions = ['.doc', '.docx', '.pdf']
    
    // Validate file types and size (25MB limit per file)
    const maxSize = 25 * 1024 * 1024 // 25MB
    
    const invalidFiles = files.filter(file => {
      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      // Check file size
      if (file.size > maxSize) {
        return true
      }
      // Check file type
      return !validTypes.includes(file.type) && !validExtensions.includes(extension)
    })
    
    if (invalidFiles.length > 0) {
      setError('Please select only Word documents (.doc, .docx) or PDF files (.pdf). Maximum file size is 25MB per file.')
      return
    }
    
    // Add files to state
    setWordDocuments(prev => [...prev, ...files])
    setError('')
    
    // Reset file input
    e.target.value = ''
  }

  // Remove document from list
  const removeDocument = (index) => {
    setWordDocuments(prev => prev.filter((_, i) => i !== index))
  }

  // Upload documents function
  const uploadDocuments = async () => {
    if (wordDocuments.length === 0) return []
    
    setUploadingDocs(true)
    const uploadedUrls = []
    
    try {
      for (const file of wordDocuments) {
        const formData = new FormData()
        formData.append('document', file)
        
        const response = await axiosInstance.post(
          API_PATHS.PROGRAM.UPLOAD_DOCUMENT,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        )
        
        if (response.data.success && response.data.documentUrl) {
          uploadedUrls.push(response.data.documentUrl)
        }
      }
      
      return uploadedUrls
    } catch (error) {
      console.error('Document upload error:', error)
      console.error('Error response:', error.response?.data)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload documents. Please try again.'
      throw new Error(errorMessage)
    } finally {
      setUploadingDocs(false)
    }
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
    
    setLoading(true)
    
    try {
      // Upload documents first
      let documentUrls = []
      if (wordDocuments.length > 0) {
        try {
          documentUrls = await uploadDocuments()
        } catch (uploadError) {
          setError(uploadError.message || 'Failed to upload documents')
          setLoading(false)
          return
        }
      }
      
      // Prepare activities data - filter out empty activities
      const activitiesData = activities
        .map(activity => {
          // Filter out empty activities (no activityId, no name, no budget)
          if (!activity.activityId?.trim() && !activity.name?.trim() && (!activity.budget || activity.budget === 0)) {
            return null;
          }
          
          return {
            activityId: activity.activityId?.trim() || undefined,
            name: activity.name?.trim() || undefined,
            description: activity.description?.trim() || undefined,
            budget: activity.budget ? parseFloat(activity.budget) : 0,
            subActivities: (activity.subActivities || [])
              .map(sub => {
                // Filter out empty subactivities
                if (!sub.subactivityId?.trim() && !sub.name?.trim() && (!sub.budget || sub.budget === 0)) {
                  return null;
                }
                return {
                  subactivityId: sub.subactivityId?.trim() || undefined,
                  name: sub.name?.trim() || undefined,
                  budget: sub.budget ? parseFloat(sub.budget) : 0
                };
              })
              .filter(sub => sub !== null) // Remove null entries
          };
        })
        .filter(activity => activity !== null) // Remove null entries
      
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
        activities: activitiesData,
        documents: documentUrls.length > 0 ? documentUrls : undefined
      }
      
      const response = await axiosInstance.post(
        API_PATHS.PROGRAM.CREATE_PROJECT,
        projectData
      )
      
      if (response.data.success) {
        // Navigate to dashboard or project list
        navigate('/program/projects')
      }
    } catch (error) {
      console.error('Error creating project:', error.response?.data)
      const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0] || 'Failed to create project. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New Project</h1>
          <p className="text-gray-600">Fill in the details to create a new project</p>
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
                  label="Donor / Partner *"
                  placeholder="Enter donor name"
                  value={donorName}
                  onChange={(e) => {
                    setDonorName(e.target.value)
                    setError('')
                  }}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Total Budget *"
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
                  
              </div>
            </div>
            
            {/* Project Type */}
            <div className="mb-8">
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
            </div>

            <div className="border-t border-gray-200 my-10"></div>
            
            {/* Supporting Documents Upload Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Documents</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attach Documents (Word or PDF) - Optional (Max 25MB per file)
                </label>
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  multiple
                  onChange={handleDocumentChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={uploadingDocs || loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  You can select multiple Word documents (.doc, .docx). Max 25MB per file.
                </p>
              </div>
              
              {/* Display selected documents */}
              {wordDocuments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Selected Documents:</p>
                  {wordDocuments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        disabled={uploadingDocs || loading}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {uploadingDocs && (
                    <p className="text-sm text-blue-600">Uploading documents...</p>
                  )}
                </div>
              )}
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
                  
                  <div className="mb-4">
                    <Input
                      label="Activity Budget"
                      type="number"
                      placeholder="0.00"
                      value={activity.budget}
                      onChange={(e) => updateActivity(activityIndex, 'budget', e.target.value)}
                      min="0"
                      step="0.01"
                    />
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
                onClick={() => navigate('/program/projects')}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isFormValid()}
                className={`px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-opacity-90 transition-colors ${
                  loading || !isFormValid() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default CreateProject
