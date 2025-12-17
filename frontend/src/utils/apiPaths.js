const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export const API_PATHS = {
  // Auth endpoints
  AUTH: {
    REGISTER: `${API_BASE}/auth/register`,
    LOGIN: `${API_BASE}/auth/login`,
    PROFILE: `${API_BASE}/auth/profile`,
    UPDATE_PASSWORD: `${API_BASE}/auth/update-password`,
    UPLOAD_IMAGE: `${API_BASE}/auth/upload-image`,
    FORGOT_PASSWORD: `${API_BASE}/auth/forgot-password`,
    RESET_PASSWORD: `${API_BASE}/auth/reset-password`,
    VERIFY_EMAIL: `${API_BASE}/auth/verify-email`,
    RESEND_VERIFICATION: `${API_BASE}/auth/resend-verification`,
  },
  // Admin endpoints
  ADMIN: {
    USERS: `${API_BASE}/admin/users`,
    USERS_DETAIL: (id) => `${API_BASE}/admin/users/${id}`,
    USERS_APPROVAL: (id) => `${API_BASE}/admin/users/${id}/approval`,
    PROJECTS: `${API_BASE}/admin/projects`,
    PROJECT_BY_ID: (id) => `${API_BASE}/admin/projects/${id}`,
    ACTIVITY_BY_ID: (projectId, activityId) => `${API_BASE}/admin/projects/${projectId}/activities/${activityId}`,
    DASHBOARD_DATA: `${API_BASE}/admin/dashboard`,
  },
  // Program endpoints
  PROGRAM: {
    CREATE_PROJECT: `${API_BASE}/program/projects`,
    GET_PROJECTS: `${API_BASE}/program/projects`,
    GET_PROJECT_BY_ID: (id) => `${API_BASE}/program/projects/${id}`,
    GET_ACTIVITY_BY_ID: (projectId, activityId) =>
      `${API_BASE}/program/projects/${projectId}/activities/${activityId}`,
    UPDATE_PROJECT: (id) => `${API_BASE}/program/projects/${id}`,
    DELETE_PROJECT: (id) => `${API_BASE}/program/projects/${id}`,
    DELETE_ACTIVITY: (projectId, activityId) =>
      `${API_BASE}/program/projects/${projectId}/activities/${activityId}`,
    DELETE_SUBACTIVITY: (projectId, activityId, subactivityId) =>
      `${API_BASE}/program/projects/${projectId}/activities/${activityId}/subactivities/${subactivityId}`,
    FINANCE_PERSONNEL: `${API_BASE}/program/finance-personnel`,
    // Reallocation endpoints
    CREATE_REALLOCATION_REQUEST: `${API_BASE}/program/reallocation-requests`,
    GET_REALLOCATION_REQUESTS: `${API_BASE}/program/reallocation-requests`,
    GET_REALLOCATION_REQUEST_BY_ID: (id) =>
      `${API_BASE}/program/reallocation-requests/${id}`,
    DASHBOARD_DATA: `${API_BASE}/program/dashboard`,
  },
  // Finance endpoints
  FINANCE: {
    GET_REALLOCATION_REQUESTS: `${API_BASE}/finance/reallocation-requests`,
    GET_REALLOCATION_REQUEST_BY_ID: (id) =>
      `${API_BASE}/finance/reallocation-requests/${id}`,
    APPROVE_REALLOCATION_REQUEST: (id) =>
      `${API_BASE}/finance/reallocation-requests/${id}/approve`,
    REJECT_REALLOCATION_REQUEST: (id) =>
      `${API_BASE}/finance/reallocation-requests/${id}/reject`,
    GET_PROJECTS: `${API_BASE}/finance/projects`,
    GET_PROJECT_BY_ID: (id) => `${API_BASE}/finance/projects/${id}`,
    GET_ACTIVITY_BY_ID: (projectId, activityId) =>
      `${API_BASE}/finance/projects/${projectId}/activities/${activityId}`,
    UPDATE_PROJECT: (id) => `${API_BASE}/finance/projects/${id}`,
    DASHBOARD_DATA: `${API_BASE}/finance/dashboard`,
  },
  // Shared/Report endpoints (available to all authenticated users)
  REPORTS: {
    DOWNLOAD_PROJECT: (projectId) => `${API_BASE}/shared/reports/project/${projectId}`,
    DOWNLOAD_ACTIVITY: (projectId, activityId) =>
      `${API_BASE}/shared/reports/activity/${projectId}/${activityId}`,
    DOWNLOAD_SUBACTIVITY: (projectId, activityId, subactivityId) =>
      `${API_BASE}/shared/reports/subactivity/${projectId}/${activityId}/${subactivityId}`,
  },
};
