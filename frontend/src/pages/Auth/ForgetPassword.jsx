import React from 'react'
import AuthLayout from '../../components/Layout/AuthLayout'
import { useState } from 'react'
import { Link, useNavigate } from "react-router-dom";
import Input from '../../components/input/Input';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';

const ForgetPassword = () => {
  const [step, setStep] = useState(1); // 1: email, 2: OTP, 3: new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
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

  // Request OTP function (can be called from form or button)
  const requestOTP = async () => {
    setError("");
    setEmailError(false);
    setSuccessMessage("");

    // Validate email
    if (!email) {
      setError("Please enter your email address");
      setEmailError(true);
      return false;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      setEmailError(true);
      return false;
    }

    setLoading(true);

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.FORGOT_PASSWORD, {
        email: email.trim(),
      });

      if (response.data.success) {
        setSuccessMessage("OTP has been sent to your email address");
        if (step === 1) {
          setStep(2);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Request OTP error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send OTP. Please try again.';
      setError(errorMessage);
      setEmailError(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    await requestOTP();
  };

  // Step 2: Verify OTP (just format validation, actual verification happens in step 3)
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    setOtpError(false);
    setSuccessMessage("");

    // Validate OTP
    if (!otp) {
      setError("Please enter the OTP");
      setOtpError(true);
      return;
    }

    if (otp.length !== 6) {
      setError("OTP must be 6 digits");
      setOtpError(true);
      return;
    }

    // Move to password reset step
    // Actual OTP verification will happen when resetting password
    setStep(3);
    setSuccessMessage("Please enter your new password.");
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setPasswordError(false);
    setConfirmPasswordError(false);
    setSuccessMessage("");

    // Validate password
    if (!newPassword) {
      setError("Please enter your new password");
      setPasswordError(true);
      return;
    }

    if (!validatePassword(newPassword)) {
      setError("Password must be at least 8 characters");
      setPasswordError(true);
      return;
    }

    // Validate confirm password
    if (!confirmPassword) {
      setError("Please confirm your password");
      setConfirmPasswordError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setPasswordError(true);
      setConfirmPasswordError(true);
      return;
    }

    setLoading(true);

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.RESET_PASSWORD, {
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });

      if (response.data.success) {
        setSuccessMessage("Password has been reset successfully!");
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(errorMessage);
      
      if (errorMessage.toLowerCase().includes('otp')) {
        setOtpError(true);
        setStep(2); // Go back to OTP step
      } else {
        setPasswordError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className='w-full flex flex-col'>
        <h3 className='text-2xl font-bold text-black mb-2'>Reset Password</h3>
        <p className='text-sm text-slate-700 mb-6'>
          {step === 1 && "Enter your email address to receive an OTP"}
          {step === 2 && "Enter the OTP sent to your email"}
          {step === 3 && "Enter your new password"}
        </p>

        {/* Step 1: Email */}
        {step === 1 && (
          <form onSubmit={handleRequestOTP} className='w-full'>
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

            {error && (
              <p className='text-red-500 text-sm mt-2 mb-4'>
                {error}
              </p>
            )}

            {successMessage && (
              <p className='text-green-500 text-sm mt-2 mb-4'>
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className='w-full bg-primary text-white uppercase font-semibold py-3 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className='w-full'>
            <Input
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(value);
                if (error || otpError) {
                  setError("");
                  setOtpError(false);
                }
              }}
              label="OTP"
              placeholder="Enter 6-digit OTP"
              type='text'
              error={otpError}
            />

            <div className="w-full flex mb-4 justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                  setOtpError(false);
                }}
                className="text-sm text-primary hover:text-blue-700"
              >
                ← Back to Email
              </button>
              <button
                type="button"
                onClick={async () => {
                  setOtpError(false);
                  await requestOTP();
                }}
                disabled={loading}
                className="text-sm text-primary hover:text-blue-700 disabled:opacity-50"
              >
                Resend OTP
              </button>
            </div>

            {error && (
              <p className='text-red-500 text-sm mt-2 mb-4'>
                {error}
              </p>
            )}

            {successMessage && (
              <p className='text-green-500 text-sm mt-2 mb-4'>
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className='w-full bg-primary text-white uppercase font-semibold py-3 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className='w-full'>
            <Input
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (error || passwordError) {
                  setError("");
                  setPasswordError(false);
                }
              }}
              label="New Password"
              placeholder="Min 8 Characters"
              type='password'
              error={passwordError}
            />

            <Input
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error || confirmPasswordError) {
                  setError("");
                  setConfirmPasswordError(false);
                }
              }}
              label="Confirm Password"
              placeholder="Confirm your password"
              type='password'
              error={confirmPasswordError}
            />

            <div className="w-full flex mb-4 justify-start">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setNewPassword("");
                  setConfirmPassword("");
                  setError("");
                  setPasswordError(false);
                  setConfirmPasswordError(false);
                }}
                className="text-sm text-primary hover:text-blue-700"
              >
                ← Back to OTP
              </button>
            </div>

            {error && (
              <p className='text-red-500 text-sm mt-2 mb-4'>
                {error}
              </p>
            )}

            {successMessage && (
              <p className='text-green-500 text-sm mt-2 mb-4'>
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className='w-full bg-primary text-white uppercase font-semibold py-3 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p className='text-sm text-black mt-6 text-center'>
          Remember your password?{' '}
          <Link to="/login" className='text-primary underline hover:text-blue-700'>
            Login
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default ForgetPassword

