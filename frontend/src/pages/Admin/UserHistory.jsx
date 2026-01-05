import React, { useEffect, useState } from "react";
import DashboardLayout from "../../components/Layout/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

const UserHistory = () => {
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const getActivityLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.ACTIVITY_LOGS);

      if (res.data.success) {
        const logsData = res.data.data || [];
        setLogs(logsData);
        setAllLogs(logsData);
      } else {
        throw new Error(res.data.message || "Failed to fetch activity logs");
      }
    } catch (err) {
      console.error("Fetch activity logs error:", err);
      setError(err.response?.data?.message || "Failed to fetch activity logs.");
      setLogs([]);
      setAllLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getActivityLogs();
  }, []); // Fetch on initial load

  // Client-side filtering similar to MyProjects
  useEffect(() => {
    if (!searchQuery.trim()) {
      setLogs(allLogs);
      return;
    }

    // Split search query into individual terms (AND logic)
    const searchTerms = searchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    const filtered = allLogs.filter((log) => {
      // Build searchable text for this log
      const dateTime = log.dateTime
        ? new Date(log.dateTime).toLocaleString().toLowerCase()
        : "";

      const dateOnly = log.dateTime
        ? new Date(log.dateTime).toLocaleDateString().toLowerCase()
        : "";

      const timeOnly = log.dateTime
        ? new Date(log.dateTime)
            .toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            .toLowerCase()
        : "";

      const email = (log.email || "").toLowerCase();
      const action = formatAction(log.action || "").toLowerCase();
      const rawAction = (log.action || "").toLowerCase();

      const searchableText = [
        dateTime,
        dateOnly,
        timeOnly,
        email,
        action,
        rawAction,
      ].join(" ");

      // Check if ALL search terms match (AND logic)
      return searchTerms.every((term) => searchableText.includes(term));
    });

    setLogs(filtered);
  }, [searchQuery, allLogs]);

  const formatDateTime = (dateTime) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    return (
      <div>
        <div className="font-medium">{date.toLocaleDateString()}</div>
        <div className="text-xs text-gray-500">
          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    );
  };

  const formatAction = (action) => {
    // Convert underscore to spaces and capitalize each word
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  };

  const clearSearch = () => {
    setSearchQuery(""); // This will trigger the useEffect to reset logs to allLogs
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            User Activity History
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Track activities of finance and program managers
          </p>
          <div className="flex items-center mt-2 text-sm text-gray-500">
            <span className="mr-4">Total Records: {logs.length}</span>
          </div>
        </div>

        {/* Search Bar - Updated to match MyProjects */}
        <div className="mb-6">
          <div className="relative w-full">
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
              placeholder="Search by date, time, email, or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 sm:py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary text-sm sm:text-base"
            />

            {searchQuery && (
              <button
                onClick={clearSearch}
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
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                {logs.length === 0 ? (
                  <span>No logs found matching "{searchQuery}"</span>
                ) : (
                  <span>
                    Found {logs.length} {logs.length === 1 ? "log" : "logs"}{" "}
                    matching "{searchQuery}"
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <div className="text-lg text-gray-600">
                Loading activity logs...
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => getActivityLogs()}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Activity Logs Table */}
        {!loading && !error && logs.length > 0 && (
          <div className="space-y-4">
            {/* Desktop Table - Only 3 Columns */}
            <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          {formatDateTime(log.dateTime)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {log.email}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">
                            {formatAction(log.action)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards - Only 3 Fields */}
            <div className="lg:hidden space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="space-y-3">
                    {/* Date & Time */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        Date & Time:
                      </span>
                      <span className="text-sm text-gray-900">
                        {new Date(log.dateTime).toLocaleDateString()}{" "}
                        {new Date(log.dateTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Email */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-900 font-medium">
                        {log.email}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        Action:
                      </span>
                      <span className="text-sm text-gray-900">
                        {formatAction(log.action)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Activity Logs - Updated to match MyProjects */}
        {!loading && logs.length === 0 && searchQuery && !error && (
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
              No matching logs
            </h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search query
            </p>
            <button
              onClick={clearSearch}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* No Activity Logs (initial state) */}
        {!loading && logs.length === 0 && !searchQuery && !error && (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No activity logs found
            </h3>
            <p className="text-gray-500 mb-6">
              There are no activity logs to display at the moment.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default UserHistory;
