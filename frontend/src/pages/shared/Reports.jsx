import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import { useUserAuth } from '../../hooks/useUserAuth';

const Reports = () => {
  const { user } = useUserAuth();
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedActivities, setExpandedActivities] = useState({});
  const [projectDetails, setProjectDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch projects based on user role
      let endpoint;
      if (user?.role === 'admin') {
        endpoint = API_PATHS.ADMIN.PROJECTS;
      } else if (user?.role === 'program') {
        endpoint = API_PATHS.PROGRAM.GET_PROJECTS;
      } else if (user?.role === 'finance') {
        endpoint = API_PATHS.FINANCE.GET_PROJECTS;
      } else {
        // Fallback to admin endpoint for unknown roles
        endpoint = API_PATHS.ADMIN.PROJECTS;
      }

      const response = await axiosInstance.get(endpoint);
      if (response.data.success) {
        const projectsData = response.data.data || [];
        setAllProjects(projectsData);
        setProjects(projectsData);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError(error.response?.data?.message || 'Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async (projectId) => {
    // If already fetched, don't fetch again
    if (projectDetails[projectId]) {
      return;
    }

    try {
      let endpoint;
      if (user?.role === 'admin') {
        endpoint = API_PATHS.ADMIN.PROJECT_BY_ID(projectId);
      } else if (user?.role === 'finance') {
        endpoint = API_PATHS.FINANCE.GET_PROJECT_BY_ID(projectId);
      } else {
        endpoint = API_PATHS.PROGRAM.GET_PROJECT_BY_ID(projectId);
      }

      const response = await axiosInstance.get(endpoint);
      if (response.data.success) {
        setProjectDetails(prev => ({
          ...prev,
          [projectId]: response.data.data
        }));
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
    }
  };

  const toggleProject = async (projectId) => {
    const isExpanded = expandedProjects[projectId];
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !isExpanded
    }));

    // Fetch project details when expanding
    if (!isExpanded) {
      await fetchProjectDetails(projectId);
    }
  };

  const toggleActivity = (projectId, activityId) => {
    const key = `${projectId}-${activityId}`;
    setExpandedActivities(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDownloadReport = async (type, projectId, activityId = null, subactivityId = null) => {
    const downloadKey = `${type}-${projectId}-${activityId || ''}-${subactivityId || ''}`;
    
    try {
      setDownloading(prev => ({ ...prev, [downloadKey]: true }));
      
      let url;
      if (type === 'project') {
        url = API_PATHS.REPORTS.DOWNLOAD_PROJECT(projectId);
      } else if (type === 'activity') {
        url = API_PATHS.REPORTS.DOWNLOAD_ACTIVITY(projectId, activityId);
      } else if (type === 'subactivity') {
        url = API_PATHS.REPORTS.DOWNLOAD_SUBACTIVITY(projectId, activityId, subactivityId);
      }

      const response = await axiosInstance.get(url, {
        responseType: 'blob',
      });

      // Create blob and download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      
      // Generate filename
      let filename = `report_${type}_${Date.now()}.xlsx`;
      if (type === 'project') {
        const project = allProjects.find(p => (p.id || p._id)?.toString() === projectId?.toString());
        filename = `project_${project?.projectId || projectId}_${Date.now()}.xlsx`;
      } else if (type === 'activity') {
        const project = projectDetails[projectId];
        const activity = project?.activities?.find(a => 
          (a.id || a._id)?.toString() === activityId?.toString() || a.activityId === activityId
        );
        filename = `activity_${activity?.activityId || activityId}_${Date.now()}.xlsx`;
      } else if (type === 'subactivity') {
        const project = projectDetails[projectId];
        const activity = project?.activities?.find(a => 
          (a.id || a._id)?.toString() === activityId?.toString() || a.activityId === activityId
        );
        const subactivity = activity?.subActivities?.find(sa => 
          (sa.id || sa._id)?.toString() === subactivityId?.toString() || sa.subactivityId === subactivityId
        );
        filename = `subactivity_${subactivity?.subactivityId || subactivityId}_${Date.now()}.xlsx`;
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download report. Please try again.');
    } finally {
      setDownloading(prev => ({ ...prev, [downloadKey]: false }));
    }
  };

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

  const getBudgetStatus = (project) => {
    if (!project || project.amountDonated === null || project.amountDonated === undefined) return 'balanced'
    const amountDonated = typeof project.amountDonated === 'string' ? parseFloat(project.amountDonated) : project.amountDonated
    const totalExpense = project.totalExpense || 0
    
    if (totalExpense < amountDonated) return 'underspent'
    if (totalExpense > amountDonated) return 'overspent'
    return 'balanced'
  }

  const formatBudgetStatus = (status) => {
    const statusMap = {
      'underspent': 'Underspent',
      'overspent': 'Overspent',
      'balanced': 'Balanced'
    }
    return statusMap[status] || 'Balanced'
  }

  const getBudgetStatusBadgeStyle = (status) => {
    const statusStyles = {
      'underspent': 'bg-green-100 text-green-700 border-green-200',
      'overspent': 'bg-red-100 text-red-700 border-red-200',
      'balanced': 'bg-blue-100 text-blue-700 border-blue-200'
    }
    return statusStyles[status] || statusStyles['balanced']
  }

  // Filter projects based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setProjects(allProjects)
      return
    }

    // Split search query into individual terms (support multiple search terms)
    const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0)
    
    const filtered = allProjects.filter((project) => {
      // Build searchable text for this project
      const projectId = (project.projectId || '').toLowerCase()
      const title = (project.title || '').toLowerCase()
      const programName = (project.programPersonnel?.name || '').toLowerCase()
      const programEmail = (project.programPersonnel?.email || '').toLowerCase()
      const amount = project.amountDonated?.toString() || ''
      const currency = (project.currency || '').toLowerCase()
      const progressStatus = (project.projectStatus || 'Not Started').toLowerCase()
      const budgetStatus = getBudgetStatus(project).toLowerCase()
      const budgetStatusFormatted = formatBudgetStatus(budgetStatus).toLowerCase()

      // Format dates for searching
      let startDateFormatted = ''
      let endDateFormatted = ''
      let startDateYear = ''
      let endDateYear = ''
      let startDateMonth = ''
      let endDateMonth = ''
      let startDateDay = ''
      let endDateDay = ''

      if (project.startDate) {
        try {
          const startDate = new Date(project.startDate)
          if (!isNaN(startDate.getTime())) {
            startDateFormatted = formatDate(project.startDate).toLowerCase()
            startDateYear = startDate.getFullYear().toString()
            startDateMonth = startDate.toLocaleDateString('en-US', { month: 'long' }).toLowerCase()
            startDateDay = startDate.getDate().toString()
          }
        } catch (e) {
          e
        }
      }

      if (project.endDate) {
        try {
          const endDate = new Date(project.endDate)
          if (!isNaN(endDate.getTime())) {
            endDateFormatted = formatDate(project.endDate).toLowerCase()
            endDateYear = endDate.getFullYear().toString()
            endDateMonth = endDate.toLocaleDateString('en-US', { month: 'long' }).toLowerCase()
            endDateDay = endDate.getDate().toString()
          }
        } catch (e) {
          e
        }
      }

      // Combine all searchable fields into a single string
      const searchableText = [
        projectId,
        title,
        programName,
        programEmail,
        amount,
        currency,
        progressStatus,
        budgetStatus,
        budgetStatusFormatted,
        startDateFormatted,
        endDateFormatted,
        startDateYear,
        endDateYear,
        startDateMonth,
        endDateMonth,
        startDateDay,
        endDateDay
      ].join(' ')

      // Check if ALL search terms match (AND logic)
      return searchTerms.every(term => searchableText.includes(term))
    })

    setProjects(filtered)
  }, [searchQuery, allProjects])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">
              Loading Reports...
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }


  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 sm:mb-5 md:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            Reports
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 leading-relaxed">
            Download detailed Excel reports for projects, activities, and subactivities
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-xs sm:text-sm">{error}</p>
          </div>
        )}

        {/* Search Bar */}
        {allProjects.length > 0 && (
          <div className="mb-4 sm:mb-5 md:mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
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
                placeholder="Search by project ID, title, dates, program personnel, amount, progress status, budget status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 md:py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-primary text-sm sm:text-base transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg
                    className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-gray-600"
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
              <p className="mt-2 text-xs sm:text-sm text-gray-600">
                {projects.length === 0 ? (
                  <span>No projects found matching "{searchQuery}"</span>
                ) : (
                  <span>
                    Found {projects.length} {projects.length === 1 ? 'project' : 'projects'} matching "{searchQuery}"
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Projects List */}
        {allProjects.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 md:p-10 lg:p-12 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 mb-1 sm:mb-2">
              No projects found
            </h3>
            <p className="text-sm sm:text-base text-gray-500">
              No projects available for reporting
            </p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 md:p-10 lg:p-12 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 mb-1 sm:mb-2">
              No matching projects
            </h3>
            <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">Try adjusting your search query</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4 md:space-y-5">
            {projects.map((project) => {
              const projectIdKey = project.id || project._id;
              const isProjectExpanded = expandedProjects[projectIdKey];
              const projectDetail = projectDetails[projectIdKey];
              const activities = projectDetail?.activities || [];

              return (
                <div
                  key={projectIdKey}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-shadow hover:shadow-md"
                >
                  {/* Project Header */}
                  <div className="p-3 sm:p-4 md:p-5 lg:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                          <button
                            onClick={() => toggleProject(projectIdKey)}
                            className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0 mt-0.5 sm:mt-1"
                            aria-label={isProjectExpanded ? 'Collapse project' : 'Expand project'}
                          >
                            <svg
                              className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${isProjectExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                          <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 break-words flex-1">
                            {project.title}
                          </h3>
                        </div>
                        <div className="ml-6 sm:ml-8 space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium whitespace-nowrap">Project ID:</span>
                            <span className="break-all">{project.projectId}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium whitespace-nowrap">Start Date:</span>
                            <span>{formatDate(project.startDate)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium whitespace-nowrap">End Date:</span>
                            <span>{formatDate(project.endDate)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium whitespace-nowrap">Progress:</span>
                            <span className={`inline-flex px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${
                              project.projectStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                              project.projectStatus === 'In Progress' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {project.projectStatus || 'Not Started'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium whitespace-nowrap">Status:</span>
                            <span className={`inline-flex px-2 py-0.5 sm:py-1 rounded-full text-xs font-semibold border ${getBudgetStatusBadgeStyle(getBudgetStatus(project))}`}>
                              {formatBudgetStatus(getBudgetStatus(project))}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadReport('project', projectIdKey)}
                        disabled={downloading[`project-${projectIdKey}--`]}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm hover:shadow-md"
                      >
                        {downloading[`project-${projectIdKey}--`] ? (
                          <>
                            <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="hidden sm:inline">Downloading...</span>
                            <span className="sm:hidden">Loading...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">Download Project Report</span>
                            <span className="sm:hidden">Download Report</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Activities List (when expanded) */}
                  {isProjectExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      {activities.length === 0 ? (
                        <div className="p-4 sm:p-5 md:p-6 text-center text-gray-500 text-sm sm:text-base">
                          No activities found in this project
                        </div>
                      ) : (
                        <div className="p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3">
                          {activities.map((activity) => {
                            const activityIdKey = activity.id || activity._id || activity.activityId;
                            const activityKey = `${projectIdKey}-${activityIdKey}`;
                            const isActivityExpanded = expandedActivities[activityKey];
                            const subActivities = activity.subActivities || [];

                            return (
                              <div
                                key={activityIdKey}
                                className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 transition-shadow hover:shadow-sm"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-2 sm:gap-3 mb-2">
                                      <button
                                        onClick={() => toggleActivity(projectIdKey, activityIdKey)}
                                        className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0 mt-0.5"
                                        disabled={subActivities.length === 0}
                                        aria-label={isActivityExpanded ? 'Collapse activity' : 'Expand activity'}
                                      >
                                        <svg
                                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isActivityExpanded ? 'rotate-90' : ''} ${subActivities.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                          />
                                        </svg>
                                      </button>
                                      <h4 className="font-medium text-sm sm:text-base text-gray-900 break-words flex-1">
                                        {activity.name || activity.activityId}
                                      </h4>
                                    </div>
                                    <div className="ml-5.5 sm:ml-7 text-xs sm:text-sm text-gray-600">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className="font-medium whitespace-nowrap">Activity ID:</span>
                                        <span className="break-all">{activity.activityId || 'N/A'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDownloadReport('activity', projectIdKey, activityIdKey)}
                                    disabled={downloading[`activity-${projectIdKey}-${activityIdKey}-`]}
                                    className="w-full sm:w-auto px-3 py-1.5 sm:py-2 bg-primary text-white text-xs sm:text-sm rounded-lg hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 font-medium shadow-sm hover:shadow-md flex-shrink-0"
                                  >
                                    {downloading[`activity-${projectIdKey}-${activityIdKey}-`] ? (
                                      <>
                                        <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="hidden sm:inline">Downloading...</span>
                                        <span className="sm:hidden">Loading...</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="hidden sm:inline">Download Activity</span>
                                        <span className="sm:hidden">Download</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* Subactivities List (when expanded) */}
                                {isActivityExpanded && subActivities.length > 0 && (
                                  <div className="mt-2 sm:mt-3 ml-5.5 sm:ml-7 space-y-2 border-t border-gray-100 pt-2 sm:pt-3">
                                    {subActivities.map((subActivity) => {
                                      const subActivityIdKey = subActivity.id || subActivity._id || subActivity.subactivityId;
                                      return (
                                      <div
                                        key={subActivityIdKey}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 bg-gray-50 rounded-lg p-2.5 sm:p-3 transition-colors hover:bg-gray-100"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-xs sm:text-sm text-gray-900 break-words">
                                            {subActivity.name || subActivity.subactivityId}
                                          </p>
                                          <p className="text-xs text-gray-600 mt-0.5 sm:mt-1">
                                            Subactivity ID: <span className="break-all">{subActivity.subactivityId || 'N/A'}</span>
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => handleDownloadReport('subactivity', projectIdKey, activityIdKey, subActivityIdKey)}
                                          disabled={downloading[`subactivity-${projectIdKey}-${activityIdKey}-${subActivityIdKey}`]}
                                          className="w-full sm:w-auto px-2.5 sm:px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-medium shadow-sm hover:shadow-md flex-shrink-0"
                                        >
                                          {downloading[`subactivity-${projectIdKey}-${activityIdKey}-${subActivityIdKey}`] ? (
                                            <>
                                              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                              <span>Loading...</span>
                                            </>
                                          ) : (
                                            <>
                                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                              </svg>
                                              <span>Download</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
