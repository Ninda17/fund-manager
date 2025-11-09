import React from 'react'
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom"
import { UserProvider } from "./context/userContext"
import Login from "./pages/Auth/Login"
import Signup from "./pages/Auth/Signup"
import PrivateRoute from "./routes/PrivateRoute"
import AdminDashboard from "./pages/Admin/Dashboard"
import FinanceDashboard from "./pages/Finance/Dashboard"
import UserDashboard from "./pages/User/Dashboard"

const App = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login/>}/>
          <Route path='/signup' element={<Signup/>}/>

          <Route element={<PrivateRoute allowedRoles={["admin"]}/>}>
            <Route path='admin/dashboard' element={<AdminDashboard/>}/>
          </Route>

          <Route element={<PrivateRoute allowedRoles={["finance"]}/>}>
            <Route path='finance/dashboard' element={<FinanceDashboard/>}/>
          </Route>

          <Route element={<PrivateRoute allowedRoles={["program"]}/>}>
            <Route path='user/dashboard' element={<UserDashboard/>}/>
          </Route>

        </Routes>
      </Router>
    </UserProvider>
  )
}

export default App
