import React from 'react'
import AuthLayout from '../../components/Layout/AuthLayout'
import { useState} from 'react'
import { Link, useNavigate } from "react-router-dom";
import Input from '../../components/input/Input';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import { useUserAuth } from '../../hooks/useUserAuth';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useUserAuth();


  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation function
  const validatePassword = (password) => {
    return password.length >= 8;
  };

  //handle login submit
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setEmailError(false);
    setPasswordError(false);

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
      setError("Please enter your password");
      setPasswordError(true);
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters");
      setPasswordError(true);
      return;
    }

    // If validation passes, proceed with login
    setLoading(true);

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email: email.trim(),
        password,
      });

      // Store user data and token
      const { data } = response.data;
      localStorage.setItem('token', data.token);
      setUser(data.user);

      // Redirect based on role
      if (data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (data.user.role === 'finance') {
        navigate('/finance/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Invalid email or password';
      setError(errorMessage);
      
      // Set field-specific errors
      if (errorMessage.toLowerCase().includes('email')) {
        setEmailError(true);
      } else {
        setPasswordError(true);
      }
    } finally {
      setLoading(false);
    }
  } 

  return (
    <AuthLayout>
      <div className='w-full flex flex-col'>
        <h3 className='text-2xl font-bold text-black mb-2'>Welcome Back</h3>
        <p className='text-sm text-slate-700 mb-6'>
          Please enter your details to log in
        </p>

        <form onSubmit={handleLogin} className='w-full'>
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

          {error && (
            <p className='text-red-500 text-sm mt-2 mb-4'>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className='w-full bg-primary text-white uppercase font-semibold py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className='text-sm text-black mt-6 text-center'>
          Don't have an account?{' '}
          <Link to="/signup" className='text-primary underline hover:text-blue-700'>
            Signup
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default Login

