const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserApproval,
  getProjectById,
  getActivityById,
  getAllProjectsAdmin,
  getAllReallocationRequestsForAdmin,
  getReallocationRequestByIdForAdmin,
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All admin routes require authentication and admin role
router.use(protect, adminOnly);

// Get all users
router.get("/users", getAllUsers);

// Get user by ID
router.get("/users/:id", getUserById);

// Delete user
router.delete("/users/:id", deleteUser);

// Update user approval status
router.put("/users/:id/approval", updateUserApproval);

// Get all projects created by admin
router.get("/projects", getAllProjectsAdmin);

// Get project by ID
router.get("/projects/:id", getProjectById);

// Get activity by ID (within a project)
router.get("/projects/:projectId/activities/:activityId", getActivityById);

// get all reallocation
router.get("/allreallocation", getAllReallocationRequestsForAdmin) 

// Admin-only route to view reallocation request details
router.get('/allreallocation/:id', getReallocationRequestByIdForAdmin);


module.exports = router;

