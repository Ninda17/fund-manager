import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useUserAuth } from "../../hooks/useUserAuth";

const SideMenu = ({ activeMenu, setOpenSideMenu }) => {
  const { user, logout } = useUserAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const isFinance = user?.role === "finance";

  // Close mobile menu when a link is clicked
  const handleLinkClick = () => {
    if (setOpenSideMenu) {
      setOpenSideMenu(false);
    }
  };

  // Shared Dashboard icon
  const dashboardIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  );

  const createProjectIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-4.379a1.5 1.5 0 01-1.06-.44z"
      />
    </svg>
  );

  const MyProjectIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );

  // Admin menu items
  const adminMenuItems = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: dashboardIcon,
    },
    {
      name: "Manage User",
      path: "/admin/manage-user",
      icon: dashboardIcon,
    },
    // Add more admin menu items here as needed
  ];

  // Finance menu items
  const financeMenuItems = [
    {
      name: "Dashboard",
      path: "/finance/dashboard",
      icon: dashboardIcon,
    },
    // Add more finance menu items here as needed
  ];

  // Program/User menu items
  const programMenuItems = [
    {
      name: "Dashboard",
      path: "/program/dashboard",
      icon: dashboardIcon,
    },
    {
      name: "Create Project",
      path: "/program/createproject",
      icon: createProjectIcon,
    },
    {
      name: "My Projects",
      path: "/program/projects",
      icon: MyProjectIcon,
    },
    // Add more program menu items here as needed
  ];

  // Select menu items based on role
  let menuItems = [];
  if (isAdmin) {
    menuItems = adminMenuItems;
  } else if (isFinance) {
    menuItems = financeMenuItems;
  } else {
    menuItems = programMenuItems;
  }

  const isActive = (path) => {
    return location.pathname === path || activeMenu === path;
  };

  const handleLogout = () => {
    // Show confirmation alert
    const confirmed = window.confirm("Are you sure you want to logout?");

    if (confirmed) {
      // Remove tokens and user data
      logout();
      // Redirect to login page
      window.location.href = "/login";
    }
  };

  return (
    <div className="w-64 bg-white h-full pt-4 pb-8">
      {/* User Profile Section */}
      <div className="px-6 pb-6 border-b border-gray-200">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <Link
            to="/profile"
            onClick={handleLinkClick}
            className="relative mb-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-primary"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 border-2 border-primary flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-10 h-10 text-gray-500"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              </div>
            )}
          </Link>

          {/* Role Badge */}
          <div className="mb-2">
            <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-md uppercase">
              {user?.role || "User"}
            </span>
          </div>

          {/* Name */}
          <h3 className="font-bold text-base mb-1">{user?.name || "User"}</h3>

          {/* Email */}
          <p className="text-sm">{user?.email || ""}</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="mt-6">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleLinkClick}
              className={`flex items-center px-6 py-3 mb-1 relative ${
                active ? "bg-primary text-white" : "hover:bg-gray-100"
              } transition-colors`}
            >
              {/* Active indicator line */}
              {active && (
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary"></div>
              )}

              {/* Icon */}
              <span className="mr-3">{item.icon}</span>

              {/* Text */}
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-6 py-3 hover:bg-gray-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 mr-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
            />
          </svg>
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default SideMenu;
