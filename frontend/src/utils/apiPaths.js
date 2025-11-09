const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const API_PATHS = {
  // Auth endpoints
  AUTH: {
    REGISTER: `${API_BASE}/auth/register`,
    LOGIN: `${API_BASE}/auth/login`,
    PROFILE: `${API_BASE}/auth/profile`,
    UPLOAD_IMAGE: `${API_BASE}/auth/upload-image`,
  },
};

