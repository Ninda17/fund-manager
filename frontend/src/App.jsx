import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { UserProvider } from "./context/userContext";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";
import ForgetPassword from "./pages/Auth/ForgetPassword";
import VerifyEmail from "./pages/Auth/VerifyEmail";
import PrivateRoute from "./routes/PrivateRoute";
import AdminDashboard from "./pages/Admin/Dashboard";
import FinanceDashboard from "./pages/Finance/Dashboard";
import ProgramDashboard from "./pages/Program/Dashboard";
import CreateProject from "./pages/Program/CreateProject";
import EditProject from "./pages/Program/EditProject";
import Profile from "./pages/Auth/Profile";
import MyProjects from "./pages/Program/Projects";
import ProjectDetails from "./pages/Program/ProjectDetails";
import ActivityDetails from "./pages/Program/ActivityDetails";
import ManageUsers from "./pages/Admin/ManageUsers";
import UserDetail from "./pages/Admin/UserDetails";
import AllProjects from "./pages/Admin/AllProjects";
import ReallocationRequests from "./pages/Program/ReallocationRequests";
import Reallocations from './pages/Finance/Reallocations'
import FinanceRequestDetails from './pages/Finance/RequestDetails'
import RequestDetails from "./pages/Program/RequestDetails";
import ProjectDetail from "./pages/Admin/ProjectDetail";
import ActivityDetail from "./pages/Admin/ActivityDetail";
import Reports from "./pages/shared/Reports";
import AllProjectsFinance from "./pages/Finance/AllProjects";
import ProjectDetailsFinance from "./pages/Finance/ProjectDetails";
import ActivityDetailsFinance from "./pages/Finance/ActivityDetails";

const App = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/manage-user" element={<ManageUsers />} />
            <Route path="admin/users/:id" element={<UserDetail />} />
            <Route path="admin/allprojects" element={<AllProjects />} />
            <Route path="admin/projects/:id" element={<ProjectDetail/>}/>
            <Route path="admin/projects/:projectId/activities/:activityId" element={<ActivityDetail/>}/>
          </Route>

          <Route element={<PrivateRoute allowedRoles={["finance"]} />}>
            <Route path="finance/dashboard" element={<FinanceDashboard />} />
            <Route path="finance/reallocations" element={<Reallocations />} />
            <Route path="finance/reallocations/:id" element={<FinanceRequestDetails />} />
            <Route path="finance/projects" element={<AllProjectsFinance />} />
            <Route path="finance/projects/:id" element={<ProjectDetailsFinance />} />
            <Route path="finance/projects/:projectId/activities/:activityId" element={<ActivityDetailsFinance />} />
          </Route>

          <Route element={<PrivateRoute allowedRoles={["program"]} />}>
            <Route path="program/dashboard" element={<ProgramDashboard />} />
            <Route path="program/createproject" element={<CreateProject />} />
            <Route path="program/projects" element={<MyProjects />} />
            <Route path="program/projects/:id" element={<ProjectDetails />} />
            <Route path="program/projects/:id/edit" element={<EditProject />} />
            <Route path="program/projects/:projectId/activities/:activityId" element={<ActivityDetails />}/>
            <Route path="program/reallocations" element={<ReallocationRequests />}/>
            <Route path="program/reallocations/:id" element={<RequestDetails />}/>
          </Route>

          <Route
            element={
              <PrivateRoute allowedRoles={["admin", "finance", "program"]} />
            }
          >
            <Route path="profile" element={<Profile />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </Router>
    </UserProvider>
  );
};

export default App;
