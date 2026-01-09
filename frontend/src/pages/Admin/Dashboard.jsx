import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/Layout/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { useUserAuth } from "../../hooks/useUserAuth";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const Dashboard = () => {
  const { user } = useUserAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [pieChartData, setPieChartData] = useState([]);
  const [barChartData, setBarChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getDashboardData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.get(API_PATHS.ADMIN.DASHBOARD_DATA);

      if (response.data && response.data.success) {
        setDashboardData(response.data);

        // Transform data for pie chart (Reallocation Status)
        const reallocationDistribution =
          response.data.charts?.reallocationStatusDistribution || {};
        const pieData = [
          {
            name: "Pending",
            value: reallocationDistribution.pending || 0,
            color: "#9333EA",
          },
          {
            name: "Approved",
            value: reallocationDistribution.approved || 0,
            color: "#10B981",
          },
          {
            name: "Rejected",
            value: reallocationDistribution.rejected || 0,
            color: "#EF4444",
          },
        ].filter((item) => item.value > 0);
        setPieChartData(pieData);

        // Transform data for bar chart (Project Status)
        const projectDistribution =
          response.data.charts?.projectStatusDistribution || {};
        const barData = [
          {
            name: "Not Started",
            value: projectDistribution["Not Started"] || 0,
          },
          {
            name: "In Progress",
            value: projectDistribution["In Progress"] || 0,
          },
          { name: "Completed", value: projectDistribution["Completed"] || 0 },
        ];
        setBarChartData(barData);
      } else {
        throw new Error(
          response.data?.message || "Failed to fetch dashboard data"
        );
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError(
        error.response?.data?.message ||
          "Failed to load dashboard data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getDashboardData();
    return () => {};
  }, []);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Format date
  const formatDate = () => {
    const date = new Date();
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName} ${day}${
      day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"
    } ${month} ${year}`;
  };

  const statistics = dashboardData?.statistics || {};
  const recentProjects = dashboardData?.recentProjects || [];
  const recentUsers = dashboardData?.recentUsers || [];

  // Colors for status badges
  const getStatusColor = (status) => {
    switch (status) {
      case "Not Started":
        return { bg: "#F3E8FF", text: "#9333EA" };
      case "In Progress":
        return { bg: "#DBEAFE", text: "#2563EB" };
      case "Completed":
        return { bg: "#D1FAE5", text: "#059669" };
      case "pending":
        return { bg: "#F3E8FF", text: "#9333EA" };
      case "approved":
        return { bg: "#D1FAE5", text: "#059669" };
      case "rejected":
        return { bg: "#FEE2E2", text: "#DC2626" };
      default:
        return { bg: "#E5E7EB", text: "#6B7280" };
    }
  };
  const formatTaskDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const ordinal =
      day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
    return `${day}${ordinal} ${month} ${year}`;
  };

  return (
    <DashboardLayout activeMenu="/admin/dashboard">
      <div className="p-6">
        {/* Loading - Same as UserHistory */}
        {loading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <div className="text-lg text-gray-600">
                Loading...
              </div>
            </div>
          </div>
        )}

        {/* Error Message - Same pattern as UserHistory */}
        {error && !loading && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => getDashboardData()}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Dashboard Content - Only show when not loading and no error */}
        {!loading && !error && (
          <>
            {/* Welcome Header */}
            <div className="mb-6">
              <h1 className="text-3xl text-black mb-1">
                {getGreeting()}! {user?.name || "Admin"}
              </h1>
              <p className="text-gray-600">{formatDate()}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Projects */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                      Total Projects
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {statistics.totalProjects || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Total Reallocations */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                      Total Reallocations
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {statistics.totalReallocations || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Underspent Projects */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                      Underspent Projects
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {statistics.underspentProjects || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
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

              {/* Overspent Projects */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                      Overspent Projects
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {statistics.overspentProjects || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2 sm:ml-4">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Reallocation Status Pie Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-black mb-4">
                  Reallocation Status Distribution
                </h2>
                {pieChartData.length > 0 ? (
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          animationDuration={500}
                          animationBegin={0}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-4">
                      {pieChartData.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          ></div>
                          <span className="text-sm text-gray-700">
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    No data available
                  </div>
                )}
              </div>

              {/* Project Status Bar Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-black mb-4">
                  Project Status Distribution
                </h2>
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {barChartData.map((entry, index) => {
                          const colorObj = getStatusColor(entry.name);
                          return (
                            <Cell key={`cell-${index}`} fill={colorObj.text} />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Recent Data Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Projects */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-black">
                    Recent Projects
                  </h2>
                </div>
                {recentProjects.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Project ID
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Title
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Created On
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentProjects.map((project, index) => {
                          return (
                            <tr
                              key={index}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {project.projectId}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {project.title}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {project.projectStatus}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {formatTaskDate(project.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No recent projects
                  </div>
                )}
              </div>

              {/* Recent Users */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-black">
                    Recent Users
                  </h2>
                </div>
                {recentUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Name
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Email
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Role
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentUsers.map((user, index) => {
                          return (
                            <tr
                              key={index}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {user.name}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {user.email}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {user.role}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {user.isApproved}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No recent users
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty State - No dashboard data */}
        {!loading && !error && !dashboardData && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No dashboard data
            </h3>
            <p className="text-gray-500 mb-6">
              Dashboard data is not available at the moment.
            </p>
            <button
              onClick={() => getDashboardData()}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              Refresh Data
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
