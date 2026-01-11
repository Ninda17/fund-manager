import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'

const MyProjects = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    fetchProjects()
  }, [])

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
      const financeName = (project.financePersonnel?.name || '').toLowerCase()
      const financeEmail = (project.financePersonnel?.email || '').toLowerCase()
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
        } catch (_e) {
          // Silently ignore date parsing errors
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
        } catch (_e) {
          // Silently ignore date parsing errors
        }
      }

      const expenseRaw =
        project.totalExpense !== undefined && project.totalExpense !== null
          ? String(project.totalExpense)
          : "";
      const expenseFormatted =
        project.totalExpense !== undefined &&
        project.totalExpense !== null &&
        project.currency
          ? `${project.currency} ${project.totalExpense}`.toLowerCase()
          : "";


      // Combine all searchable fields into a single string
      const searchableText = [
        projectId,
        title,
        financeName,
        financeEmail,
        amount,
        expenseRaw,
        expenseFormatted,
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
        endDateDay,
      ].join(" ");

      // Check if ALL search terms match (AND logic)
      return searchTerms.every(term => searchableText.includes(term))
    })

    setProjects(filtered)
  }, [searchQuery, allProjects])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await axiosInstance.get(API_PATHS.PROGRAM.GET_PROJECTS)
      if (response.data.success) {
        const projectsData = response.data.data || []
        setAllProjects(projectsData)
        setProjects(projectsData)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      setError(error.response?.data?.message || 'Failed to load projects. Please try again.')
    } finally {
      setLoading(false)
    }
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

  const calculateUtilization = (project) => {
    if (!project) return 0;
    
    const donated = typeof project.amountDonated === 'string' ? parseFloat(project.amountDonated) : (project.amountDonated || 0);
    const expense = typeof project.totalExpense === 'string' ? parseFloat(project.totalExpense) : (project.totalExpense || 0);
    
    if (!donated || donated === 0 || isNaN(donated)) return 0;
    if (isNaN(expense)) return 0;
    
    const utilization = (expense / donated) * 100;
    return isNaN(utilization) ? 0 : utilization;
  };


  // const getProgressBadgeStyle = (status) => {
  //   const statusStyles = {
  //     'Not Started': 'bg-gray-100 text-gray-700 border-gray-200',
  //     'In Progress': 'bg-orange-100 text-orange-700 border-orange-200',
  //     'Completed': 'bg-green-100 text-green-700 border-green-200'
  //   }
  //   return statusStyles[status] || statusStyles['Not Started']
  // }

  const getBudgetStatus = (project) => {
    if (!project || project.amountDonated === null || project.amountDonated === undefined) return 'balanced'
    const amountDonated = typeof project.amountDonated === 'string' ? parseFloat(project.amountDonated) : project.amountDonated
    const totalExpense = project.totalExpense || 0
    
    if (totalExpense < amountDonated) return 'underspent'
    if (totalExpense > amountDonated) return 'overspent'
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
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">
              Loading projects...
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }


  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            My Projects
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            View and manage all your projects
          </p>
        </div>

        {/* Search Bar */}
        {allProjects.length > 0 && (
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
                placeholder="Search by project ID, title, dates, finance personnel, amount, progress status, budget status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 sm:py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary text-sm sm:text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
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
                {projects.length === 0 ? (
                  <span>No projects found matching "{searchQuery}"</span>
                ) : (
                  <span>
                    Found {projects.length}{" "}
                    {projects.length === 1 ? "project" : "projects"} matching "
                    {searchQuery}"
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Projects List */}
        {allProjects.length === 0 ? (
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No projects found
            </h3>
            <p className="text-gray-500 mb-6">
              Get started by creating your first project
            </p>
          </div>
        ) : projects.length === 0 ? (
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No matching projects
            </h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search query
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              Clear Search
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
                        Project ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        End Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Finance Personnel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Budget
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Expenditure
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Utilization
                      </th>
                      {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th> */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projects.map((project) => {
                      const utilization = calculateUtilization(project);
                      // const progressStatus =
                      //   project.projectStatus || "Not Started";
                      const budgetStatus = getBudgetStatus(project);
                      return (
                        <tr
                          key={project.id || project._id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() =>
                            navigate(`/program/projects/${project.id || project._id}`)
                          }
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {project.projectId}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-900">
                              {project.title}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {formatDate(project.startDate)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {formatDate(project.endDate)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {project.financePersonnel?.name || "N/A"}
                              </div>
                              <div className="text-gray-500">
                                {project.financePersonnel?.email || ""}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(
                                project.amountDonated,
                                project.currency
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(
                                project.totalExpense || 0,
                                project.currency
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-start">
                              <span className="text-sm text-gray-600 mb-1">
                                {utilization.toFixed(1)}%
                              </span>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-gray-900 h-full rounded-full transition-all"
                                  style={{ width: `${utilization}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          {/* <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getProgressBadgeStyle(
                                progressStatus
                              )}`}
                            >
                              {progressStatus}
                            </span>
                          </td> */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getBudgetStatusBadgeStyle(
                                budgetStatus
                              )}`}
                            >
                              {formatBudgetStatus(budgetStatus)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-4">
              {projects.map((project) => {
                const utilization = calculateUtilization(project);
                // const progressStatus = project.projectStatus || "Not Started";
                const budgetStatus = getBudgetStatus(project);
                return (
                  <div
                    key={project.id || project._id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/program/projects/${project.id || project._id}`)}
                  >
                    <div className="space-y-3">
                      {/* Project ID and Title */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500">
                            Project ID
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            {project.projectId}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mt-2">
                          {project.title}
                        </h3>
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">
                            Start Date
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(project.startDate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">
                            End Date
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(project.endDate)}
                          </span>
                        </div>
                      </div>

                      {/* Finance Personnel */}
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">
                          Finance Personnel
                        </span>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {project.financePersonnel?.name || "N/A"}
                          </div>
                          <div className="text-gray-500 text-xs mt-0.5">
                            {project.financePersonnel?.email || ""}
                          </div>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">
                          Amount Donated
                        </span>
                        <span className="text-lg font-semibold text-gray-900">
                          {formatCurrency(
                            project.amountDonated,
                            project.currency
                          )}
                        </span>
                      </div>

                      {/* Expenses */}
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">
                          Expenses
                        </span>
                        <span className="text-lg font-semibold text-gray-900">
                          {formatCurrency(
                            project.totalExpense || 0,
                            project.currency
                          )}
                        </span>
                      </div>

                      {/* Utilization */}
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 block mb-2">
                          Utilization
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-600 mb-2">
                            {utilization.toFixed(1)}%
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gray-900 h-full rounded-full transition-all"
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Progress */}
                      {/* <div className="pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 block mb-2">
                          Progress
                        </span>
                        <span
                          className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getProgressBadgeStyle(
                            progressStatus
                          )}`}
                        >
                          {progressStatus}
                        </span>
                      </div> */}

                      {/* Status */}
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 block mb-2">
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border ${getBudgetStatusBadgeStyle(
                            budgetStatus
                          )}`}
                        >
                          {formatBudgetStatus(budgetStatus)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MyProjects
