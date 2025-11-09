import React from 'react'

const AuthLayout = ({ children }) => {
  return <div className='flex items-center justify-center min-h-screen w-full'>
    <div className='w-full max-w-lg px-12 pt-8 pb-12'>
        {children}
    </div>
  </div>
}

export default AuthLayout

