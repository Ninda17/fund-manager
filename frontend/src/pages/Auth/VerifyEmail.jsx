import React, { useState, useEffect } from 'react'
import AuthLayout from '../../components/Layout/AuthLayout'
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Input from '../../components/input/Input';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, _setToken] = useState(searchParams.get('token') || '');
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token && !verifying) {
      handleVerifyEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Verify email with token from URL
  const handleVerifyEmail = async () => {
    if (!token) {
      setError("Verification token is missing");
      return;
    }

    setVerifying(true);
    setError("");
    setSuccess("");

    try {
      const response = await axiosInstance.get(API_PATHS.AUTH.VERIFY_EMAIL, {
        params: { token },
      });

      if (response.data.success) {
        setSuccess("Email verified successfully! You can now log in.");
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('Verify email error:', error);
      const errorMessage = error.response?.data?.message || 'Invalid or expired verification link.';
      setError(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  // Resend verification email
  const handleResendVerification = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setResending(true);

    if (!email) {
      setError("Please enter your email address");
      setResending(false);
      return;
    }

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.RESEND_VERIFICATION, {
        email: email.trim(),
      });

      if (response.data.success) {
        setSuccess("Verification email has been sent. Please check your inbox.");
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to resend verification email. Please try again.';
      setError(errorMessage);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className='w-full flex flex-col'>
        {token ? (
          // Verification in progress
          <>
            <h3 className='text-2xl font-bold text-black mb-2'>Verifying Email</h3>
            <p className='text-sm text-slate-700 mb-6'>
              Please wait while we verify your email address...
            </p>
            {verifying && (
              <div className='text-center py-4'>
                <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
              </div>
            )}
          </>
        ) : (
          // Manual verification or resend
          <>
            <h3 className='text-2xl font-bold text-black mb-2'>Verify Your Email</h3>
            <p className='text-sm text-slate-700 mb-6'>
              {email 
                ? "We've sent a verification link to your email. Please check your inbox and click the link to verify your account."
                : "Enter your email address to receive a verification link."
              }
            </p>

            {email && (
              <div className='mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md'>
                <p className='text-sm text-blue-800'>
                  <strong>Email:</strong> {email}
                </p>
              </div>
            )}

            <form onSubmit={handleResendVerification} className='w-full'>
              {!email && (
                <Input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) {
                      setError("");
                    }
                  }}
                  label="Email Address"
                  placeholder="mike@timetoprogram.com"
                  type='text'
                />
              )}

              {error && (
                <p className='text-red-500 text-sm mt-2 mb-4'>
                  {error}
                </p>
              )}

              {success && (
                <p className='text-green-500 text-sm mt-2 mb-4'>
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={resending || !email}
                className='w-full bg-primary text-white uppercase font-semibold py-3 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {resending ? 'Sending...' : email ? 'Resend Verification Email' : 'Send Verification Email'}
              </button>
            </form>
          </>
        )}

        {error && !token && (
          <p className='text-red-500 text-sm mt-4 text-center'>
            {error}
          </p>
        )}

        {success && !token && (
          <p className='text-green-500 text-sm mt-4 text-center'>
            {success}
          </p>
        )}

        <p className='text-sm text-black mt-6 text-center'>
          Already verified?{' '}
          <Link to="/login" className='text-primary underline hover:text-blue-700'>
            Login
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default VerifyEmail

