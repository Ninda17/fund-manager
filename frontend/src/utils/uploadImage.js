import axiosInstance from './axiosInstance';
import { API_PATHS } from './apiPaths';

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await axiosInstance.post(
      API_PATHS.AUTH.UPLOAD_IMAGE,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (response.data.success && response.data.imageUrl) {
      return response.data.imageUrl;
    } else {
      throw new Error('Failed to upload image');
    }
  } catch (error) {
    console.error('Image upload error:', error);
    const errorMessage = error.response?.data?.message || 'Failed to upload image. Please try again.';
    throw new Error(errorMessage);
  }
};

