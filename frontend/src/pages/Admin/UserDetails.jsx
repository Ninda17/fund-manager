import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/Layout/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState("pending");

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.USERS_DETAIL(id));
      setUser(res.data.data);
      setStatus(res.data.data.isApproved || "pending");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch user.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    setActionLoading(true);
    try {
      await axiosInstance.delete(API_PATHS.ADMIN.USERS_DETAIL(id));
      alert("User deleted successfully!");
      navigate("/admin/manage-user");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await axiosInstance.put(API_PATHS.ADMIN.USERS_APPROVAL(id), {
        isApproved: status,
      });
      alert("User updated successfully!");
      navigate("/admin/manage-user");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update user.");
    } finally {
      setActionLoading(false);
    }
  };

  // Get initials for default avatar
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading user details...</div>
          </div>
        </div>
      </DashboardLayout>
    );


  if (error)
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-red-600">
          {error}
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/admin/manage-user")}
              className="text-primary hover:text-primary-dark flex items-center text-sm sm:text-base"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Users
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 break-words">
            {user.name}
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Review the user profile, update their approval status, or remove
            them from the system.
          </p>
        </div>

        {/* Profile & Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 flex flex-col md:flex-row md:items-start gap-6">
          {/* Avatar Section - Updated to match Signup page */}
          <div className="flex flex-col items-center">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.name}
                className="w-28 h-28 rounded-full border-2 border-primary object-cover"
              />
            ) : (
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center relative overflow-hidden">
                  {/* Default avatar - same as Signup page */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="#18181B"
                    className="w-16 h-16"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>

                  {/* Optional: Add user initials as overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-semibold text-gray-700 opacity-0">
                      {getInitials(user.name)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-3 text-sm text-gray-500 text-center">
              {user.profileImageUrl ? "Profile Picture" : "Default Avatar"}
            </p>
          </div>

          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Full Name</p>
                <p className="text-gray-900 font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Email</p>
                <p className="text-gray-900 font-medium break-words">
                  {user.email}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Role</p>
                <p className="text-gray-900 font-medium capitalize">
                  {user.role}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Status</p>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
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
              <div>
                <p className="text-gray-500 text-sm">Account Created</p>
                <p className="text-gray-900 font-medium">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Update & Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="block text-sm font-medium text-gray-700">
              Update Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              style={{ minWidth: "160px" }}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleUpdate}
              disabled={actionLoading}
              className={`px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors ${
                actionLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {actionLoading ? "Updating..." : "Update User"}
            </button>

            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-600 hover:text-white transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete User
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserDetails;
