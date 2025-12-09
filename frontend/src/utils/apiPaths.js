const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

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
  },
  // Program endpoints
  PROGRAM: {
    CREATE_PROJECT: `${API_BASE}/program/projects`,
    GET_PROJECTS: `${API_BASE}/program/projects`,
    FINANCE_PERSONNEL: `${API_BASE}/program/finance-personnel`,
  },
};

