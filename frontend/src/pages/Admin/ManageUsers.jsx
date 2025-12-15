import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/Layout/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

const ManageUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const getUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.USERS);

      // Filter out admin users
      const nonAdminUsers = (res.data.data || []).filter(
        (user) => user.role !== "admin"
      );

      setUsers(nonAdminUsers);
      setAllUsers(nonAdminUsers);
    } catch (err) {
      console.error("Fetch users error:", err);
      setError(err.response?.data?.message || "Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUsers();
  }, []);

  // Search filter - updated to include project count
  useEffect(() => {
    if (!searchQuery.trim()) {
      setUsers(allUsers);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = allUsers.filter((user) => {
      return (
        (user.name || "").toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        (user.role || "").toLowerCase().includes(query) ||
        (user.isApproved || "pending").toLowerCase().includes(query) ||
        (user.projectCount?.toString() || "0").includes(query)
      );
    });
    setUsers(filtered);
  }, [searchQuery, allUsers]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Manage Users
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            View and manage all non-admin users
          </p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Admin users are not shown in this list for security reasons
          </p>
        </div>

        {/* Full-width Search Bar */}
        <div className="mb-6 w-full">
          <div className="relative w-full">
            {/* Search Icon */}
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

            {/* Input */}
            <input
              type="text"
              placeholder="Search by name, email, role, status, or project count..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm sm:text-base"
            />

            {/* Clear Button */}
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

          {/* Search Result Info */}
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600">
              {users.length === 0
                ? `No users found matching "${searchQuery}"`
                : `Found ${users.length} ${
                    users.length === 1 ? "user" : "users"
                  } matching "${searchQuery}"`}
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-lg">Loading users...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Users Table */}
        {!loading && !error && users.length > 0 && (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Projects
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr
                        key={user._id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/admin/users/${user._id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          <span className="text-sm font-medium text-gray-900">
                            {user.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {user.email}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          <span className="text-sm font-medium text-gray-900">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-900 rounded-full text-sm font-semibold">
                            {user.projectCount || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                              user.isApproved === "approved"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : user.isApproved === "rejected"
                                ? "bg-red-100 text-red-700 border-red-200"
                                : "bg-yellow-100 text-yellow-700 border-yellow-200"
                            }`}
                          >
                            {user.isApproved || "pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Table */}
            <div className="lg:hidden space-y-4">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/admin/users/${user._id}`)}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Name</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {user.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Email</span>
                      <span className="text-sm text-gray-900">
                        {user.email}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Role</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {user.role}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Projects</span>
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-900 rounded-full text-sm font-semibold">
                        {user.projectCount || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Status</span>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                          user.isApproved === "approved"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : user.isApproved === "rejected"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-yellow-100 text-yellow-700 border-yellow-200"
                        }`}
                      >
                        {user.isApproved || "pending"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Users */}
        {!loading && !error && users.length === 0 && (
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0H15m12 0h-6"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No non-admin users found
            </h3>
            <p className="text-gray-500 mb-6">
              There are currently no non-admin users to display.
            </p>
            <p className="text-gray-400 text-sm">
              Admin users are not shown in this list
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ManageUsers;
