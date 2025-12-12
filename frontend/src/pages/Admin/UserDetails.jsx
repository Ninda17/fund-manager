import React, { useEffect, useState } from "react";
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
  const [isImageOpen, setIsImageOpen] = useState(false);

  const fetchUser = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get(`${API_PATHS.ADMIN.USERS_DETAIL(id)}`);
      setUser(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch user.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [id]);

const handleStatusChange = async (newStatus) => {
  if (!user) return;
  setActionLoading(true);
  try {
    const res = await axiosInstance.put(API_PATHS.ADMIN.USERS_APPROVAL(id), {
      isApproved: newStatus,
    });
    alert(res.data.message);
    setUser((prev) => ({ ...prev, isApproved: newStatus }));
  } catch (err) {
    console.error("Update status error:", err);
    alert(err.response?.data?.message || "Failed to update status.");
  } finally {
    setActionLoading(false);
  }
};


  const handleDelete = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    setActionLoading(true);
    try {
      const res = await axiosInstance.delete(`${API_PATHS.ADMIN.USERS_DETAIL(id)}`);
      alert(res.data.message || "User deleted successfully!");
      navigate("/admin/users");
    } catch (err) {
      console.error("Delete user error:", err);
      alert(err.response?.data?.message || "Failed to delete user.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <DashboardLayout>
        <div className="text-center mt-20">Loading user...</div>
      </DashboardLayout>
    );

  if (error)
    return (
      <DashboardLayout>
        <div className="text-center mt-20 text-red-600">{error}</div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 mt-6">
        <div className="flex flex-col items-center space-y-4">
          {/* Profile Image */}
          <img
            src={user?.profileImageUrl || "/default-profile.png"}
            alt={user?.name}
            className="w-32 h-32 rounded-full object-cover border cursor-pointer hover:scale-105 transition"
            onClick={() => setIsImageOpen(true)}
          />

          <h2 className="text-2xl font-bold">{user?.name}</h2>
          <p className="text-gray-600">{user?.email}</p>
          <p className="text-gray-600 capitalize">Role: {user?.role}</p>

          <p className="text-gray-600 capitalize">
            Status:{" "}
            <span
              className={`font-semibold ${
                user?.isApproved === "approved"
                  ? "text-green-600"
                  : user?.isApproved === "rejected"
                  ? "text-red-600"
                  : "text-yellow-600"
              }`}
            >
              {user?.isApproved || "pending"}
            </span>
          </p>

          <p className="text-gray-600">
            Account Created:{" "}
            <span className="font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A"}
            </span>
          </p>

          {/* Dynamic Action Buttons */}
          <div className="flex space-x-4 mt-4">
            {user?.isApproved === "pending" && (
              <>
                <button
                  onClick={() => handleStatusChange("approved")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleStatusChange("rejected")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}

            {user?.isApproved === "approved" && (
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
              >
                Delete User
              </button>
            )}

            {user?.isApproved === "rejected" && (
              <>
                <button
                  onClick={() => handleStatusChange("approved")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
                >
                  Delete User
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {isImageOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setIsImageOpen(false)}
        >
          <img
            src={user?.profileImageUrl || "/default-profile.png"}
            alt="Full view"
            className="max-w-[92%] max-h-[92%] rounded-xl shadow-lg"
          />
        </div>
      )}
    </DashboardLayout>
  );
};

export default UserDetails;
