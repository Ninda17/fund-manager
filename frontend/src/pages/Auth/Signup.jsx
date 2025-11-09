import React, { useState, useRef } from 'react'
import AuthLayout from '../../components/Layout/AuthLayout'
import { Link, useNavigate } from "react-router-dom";
import Input from '../../components/input/Input';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import { uploadImage } from '../../utils/uploadImage';
const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("program");
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation function
  const validatePassword = (password) => {
    return password.length >= 8;
  };

  // Handle profile image upload
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.match('image.*')) {
        setError("Please select a valid image file");
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB");
        return;
      }

      setProfileImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImageUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle avatar click to trigger file input
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Handle signup submit
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setNameError(false);
    setEmailError(false);
    setPasswordError(false);

    // Validate name
    if (!name.trim()) {
      setError("Please enter your full name");
      setNameError(true);
      return;
    }

    // Validate email
    if (!email) {
      setError("Please enter your email address");
      setEmailError(true);
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      setEmailError(true);
      return;
    }

    // Validate password
    if (!password) {
      setError("Please enter the password");
      setPasswordError(true);
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters");
      setPasswordError(true);
      return;
    }

    // Start signup process
    setLoading(true);
    let uploadedImageUrl = null;

    try {
      // Upload profile image if selected
      if (profileImage) {
        try {
          uploadedImageUrl = await uploadImage(profileImage);
        } catch (uploadError) {
          setError(uploadError.message || "Failed to upload profile image");
          setLoading(false);
          return;
        }
      }

      // Register user
      const registerData = {
        name: name.trim(),
        email: email.trim(),
        password,
        role: role || "program",
        profileImageUrl: uploadedImageUrl || undefined,
      };

      await axiosInstance.post(
        API_PATHS.AUTH.REGISTER,
        registerData,
      );

      navigate('/login');
    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create account. Please try again.';
      setError(errorMessage);
      
      // Set field-specific errors
      if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('already exists')) {
        setEmailError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className='w-full flex flex-col'>
        <h3 className='text-2xl font-bold text-black mb-2'>Create an Account</h3>
        <p className='text-sm text-slate-700 mb-6'>
          Join us today by entering your details below.
        </p>

        {/* Avatar Upload Section */}
        <div className='mb-6 flex justify-center'>
          <div className='relative'>
            <div 
              className='w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors relative overflow-hidden'
              onClick={handleAvatarClick}
            >
              {profileImageUrl ? (
                <img 
                  src={profileImageUrl} 
                  alt="Profile" 
                  className='w-full h-full object-cover'
                />
              ) : (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={1.5} 
                  stroke="#1368EC" 
                  className="w-12 h-12"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" 
                  />
                </svg>
              )}
            </div>
            {/* Upload Button Overlay */}
            <div 
              className='absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg'
              onClick={handleAvatarClick}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2.5} 
                stroke="white" 
                className="w-5 h-5"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18m0 0l-4.5-4.5M12 21l4.5-4.5" 
                />
              </svg>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className='hidden'
            />
          </div>
        </div>

        <form onSubmit={handleSignup} className='w-full'>
          {/* Two Column Layout for Full Name and Email */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error || nameError) {
                  setError("");
                  setNameError(false);
                }
              }}
              label="Full Name"
              placeholder="Mike"
              type='text'
              error={nameError}
            />
            
            <Input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error || emailError) {
                  setError("");
                  setEmailError(false);
                }
              }}
              label="Email Address"
              placeholder="mike@timetoprogram.com"
              type='text'
              error={emailError}
            />
          </div>

          {/* Password Field */}
          <div>
            <Input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error || passwordError) {
                  setError("");
                  setPasswordError(false);
                }
              }}
              label="Password"
              placeholder="Min 8 Characters"
              type='password'
              error={passwordError}
            />
            
            {/* Error Message - appears below password field */}
            {error && passwordError && (
              <p className='text-red-500 text-sm -mt-2 mb-4'>
                {error}
              </p>
            )}
          </div>

          {/* Role Selection */}
          <div className='mb-4'>
            <label className='block text-sm font-medium text-black mb-2'>
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className='w-full px-4 py-3 bg-white-300 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
            >
              <option value="program">Program</option>
              <option value="finance">Finance</option>
            </select>
            <p className='text-xs text-gray-500 mt-1'> Your account should be approved by the admin in order to login</p>
          </div>

          {/* General Error Message (for other errors) */}
          {error && !passwordError && (
            <p className='text-red-500 text-sm mt-2 mb-4'>
              {error}
            </p>
          )}

          {/* Sign Up Button */}
          <button
            type="submit"
            disabled={loading}
            className='w-full bg-primary text-white uppercase font-semibold py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
        </form>

        {/* Footer Link */}
        <p className='text-sm text-black mt-6 text-center'>
          Already an account?{' '}
          <Link to="/login" className='text-primary underline hover:text-blue-700'>
            Login
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default Signup
