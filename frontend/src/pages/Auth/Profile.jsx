import React, { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import Input from '../../components/input/Input'
import { useUserAuth } from '../../hooks/useUserAuth'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'
import { uploadImage } from '../../utils/uploadImage'

const Profile = () => {
  const { user, setUser } = useUserAuth()
  const [name, setName] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState(null)
  const [profileImage, setProfileImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nameError, setNameError] = useState(false)
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [currentPasswordError, setCurrentPasswordError] = useState(false)
  const [newPasswordError, setNewPasswordError] = useState(false)
  const [confirmPasswordError, setConfirmPasswordError] = useState(false)
  
  const fileInputRef = useRef(null)

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setFetching(true)
        const response = await axiosInstance.get(API_PATHS.AUTH.PROFILE)
        if (response.data.success) {
          const userData = response.data.data
          setName(userData.name || '')
          setProfileImageUrl(userData.profileImageUrl || null)
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        setError('Failed to load profile. Please try again.')
      } finally {
        setFetching(false)
      }
    }

    fetchProfile()
  }, [])

  // Handle profile image change
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.match('image.*')) {
        setError('Please select a valid image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB')
        return
      }

      setProfileImage(file)
      setError('')
      
      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileImageUrl(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle avatar click to trigger file input
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  // Handle remove profile picture
  const handleRemovePhoto = async () => {
    if (!profileImageUrl) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await axiosInstance.put(
        API_PATHS.AUTH.PROFILE,
        {
          name: name.trim(),
          profileImageUrl: null,
        }
      )

      if (response.data.success) {
        // Update user context
        const updatedUser = {
          ...user,
          name: response.data.data.user.name,
          profileImageUrl: null,
        }
        setUser(updatedUser)
        
        setProfileImageUrl(null)
        setProfileImage(null)
        setSuccess('Profile picture removed successfully!')
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess('')
        }, 3000)
      }
    } catch (error) {
      console.error('Remove profile picture error:', error)
      const errorMessage = error.response?.data?.message || 'Failed to remove profile picture. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setNameError(false)

    // Validate name
    if (!name.trim()) {
      setError('Please enter your name')
      setNameError(true)
      return
    }

    setLoading(true)
    let uploadedImageUrl = profileImageUrl

    try {
      // Upload profile image if a new one is selected
      if (profileImage) {
        try {
          uploadedImageUrl = await uploadImage(profileImage)
        } catch (uploadError) {
          setError(uploadError.message || 'Failed to upload profile image')
          setLoading(false)
          return
        }
      }

      // Update profile
      const updateData = {
        name: name.trim(),
        profileImageUrl: uploadedImageUrl || null,
      }

      const response = await axiosInstance.put(
        API_PATHS.AUTH.PROFILE,
        updateData
      )

      if (response.data.success) {
        // Update user context
        const updatedUser = {
          ...user,
          name: response.data.data.user.name,
          profileImageUrl: response.data.data.user.profileImageUrl,
        }
        setUser(updatedUser)
        
        setSuccess('Profile updated successfully!')
        setProfileImage(null) // Clear the file input
        setError('')
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess('')
        }, 3000)
      }
    } catch (error) {
      console.error('Profile update error:', error)
      const errorMessage = error.response?.data?.message || 'Failed to update profile. Please try again.'
      setError(errorMessage)
      
      if (errorMessage.toLowerCase().includes('name')) {
        setNameError(true)
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle password change submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    setCurrentPasswordError(false)
    setNewPasswordError(false)
    setConfirmPasswordError(false)

    // Validate current password
    if (!currentPassword) {
      setPasswordError('Please enter your current password')
      setCurrentPasswordError(true)
      return
    }

    // Validate new password
    if (!newPassword) {
      setPasswordError('Please enter a new password')
      setNewPasswordError(true)
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long')
      setNewPasswordError(true)
      return
    }

    // Validate confirm password
    if (!confirmPassword) {
      setPasswordError('Please confirm your new password')
      setConfirmPasswordError(true)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match')
      setConfirmPasswordError(true)
      setNewPasswordError(true)
      return
    }

    setPasswordLoading(true)

    try {
      const response = await axiosInstance.put(
        API_PATHS.AUTH.UPDATE_PASSWORD,
        {
          currentPassword,
          newPassword,
        }
      )

      if (response.data.success) {
        setPasswordSuccess('Password updated successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordError('')
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setPasswordSuccess('')
        }, 3000)
      }
    } catch (error) {
      console.error('Password update error:', error)
      const errorMessage = error.response?.data?.message || 'Failed to update password. Please try again.'
      setPasswordError(errorMessage)
      
      if (errorMessage.toLowerCase().includes('current') || errorMessage.toLowerCase().includes('incorrect')) {
        setCurrentPasswordError(true)
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  if (fetching) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-lg">Loading profile...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile Settings</h1>
            <p className="text-gray-600">Manage your account information and profile picture</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Profile Image Section */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Profile Picture
              </label>
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-primary cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={handleAvatarClick}
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full bg-gray-200 border-2 border-primary flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
                      onClick={handleAvatarClick}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-12 h-12 text-gray-500"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
                <div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
                    >
                      Change Photo
                    </button>
                    {profileImageUrl && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    JPG, PNG or GIF. Max size 5MB
                  </p>
                </div>
              </div>
            </div>

            {/* Name Input */}
            <div className="mb-8">
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameError(false)
                  setError('')
                }}
                error={nameError}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-opacity-90 transition-colors ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Password Change Section */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Change Password</h2>
              <p className="text-gray-600">Update your password to keep your account secure</p>
            </div>

            {/* Password Success Message */}
            {passwordSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 text-sm">{passwordSuccess}</p>
              </div>
            )}

            {/* Password Error Message */}
            {passwordError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{passwordError}</p>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              {/* Current Password */}
              <div className="mb-4">
                <Input
                  label="Current Password"
                  placeholder="Enter your current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value)
                    setCurrentPasswordError(false)
                    setPasswordError('')
                  }}
                  error={currentPasswordError}
                />
              </div>

              {/* New Password */}
              <div className="mb-4">
                <Input
                  label="New Password"
                  placeholder="Enter your new password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setNewPasswordError(false)
                    setPasswordError('')
                  }}
                  error={newPasswordError}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 8 characters long
                </p>
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <Input
                  label="Confirm New Password"
                  placeholder="Confirm your new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setConfirmPasswordError(false)
                    setPasswordError('')
                  }}
                  error={confirmPasswordError}
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className={`px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-opacity-90 transition-colors ${
                    passwordLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Profile
