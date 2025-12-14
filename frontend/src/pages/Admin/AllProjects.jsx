import React from "react";
import DashboardLayout from "../../components/Layout/DashboardLayout";
const AllProjects = () => {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p className="text-gray-600">
          Welcome to the Fund Manager Admin Dashboard
        </p>
        <div>AllProjects</div>
      </div>
    </DashboardLayout>
  );
};

export default AllProjects;
