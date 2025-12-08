import React from 'react'
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom"
import { UserProvider } from "./context/userContext"
import Login from "./pages/Auth/Login"
import Signup from "./pages/Auth/Signup"
import ForgetPassword from "./pages/Auth/ForgetPassword"
import VerifyEmail from "./pages/Auth/VerifyEmail"
import PrivateRoute from "./routes/PrivateRoute"
import AdminDashboard from "./pages/Admin/Dashboard"
import FinanceDashboard from "./pages/Finance/Dashboard"
import ProgramDashboard from "./pages/Program/Dashboard"
import CreateProject from './pages/Program/CreateProject'
import Profile from './pages/Auth/Profile'

const App = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login/>}/>
          <Route path='/signup' element={<Signup/>}/>
          <Route path='/forgot-password' element={<ForgetPassword/>}/>
          <Route path='/verify-email' element={<VerifyEmail/>}/>

          <Route element={<PrivateRoute allowedRoles={["admin"]}/>}>
            <Route path='admin/dashboard' element={<AdminDashboard/>}/>
          </Route>

          <Route element={<PrivateRoute allowedRoles={["finance"]}/>}>
            <Route path='finance/dashboard' element={<FinanceDashboard/>}/>
          </Route>

          <Route element={<PrivateRoute allowedRoles={["program"]}/>}>
            <Route path='program/dashboard' element={<ProgramDashboard/>}/>
            <Route path='program/createproject' element={<CreateProject/>}/>
          </Route>

          <Route element={<PrivateRoute allowedRoles={["admin", "finance", "program"]}/>}>
            <Route path='profile' element={<Profile/>}/>
          </Route>

        </Routes>
      </Router>
    </UserProvider>
  )
}

export default App
