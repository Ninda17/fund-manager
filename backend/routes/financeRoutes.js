const express = require("express");
const router = express.Router();
const {
  getAllReallocationRequests,
  getReallocationRequestById,
  approveReallocationRequest,
  rejectReallocationRequest,
  getAllProjects,
  getProjectById,
  getActivityById,
} = require("../controllers/financeController");
const { protect, financeOnly } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// All finance routes require authentication and finance role
router.use(protect, financeOnly);

// Get all reallocation requests (for projects assigned to finance user)
router.get("/reallocation-requests", getAllReallocationRequests);

// Get specific reallocation request by ID
router.get("/reallocation-requests/:id", getReallocationRequestById);

// Approve reallocation request (with evidence image upload)
router.put(
  "/reallocation-requests/:id/approve",
  upload.single("evidenceImage"),
  approveReallocationRequest
);

// Reject reallocation request
router.put("/reallocation-requests/:id/reject", rejectReallocationRequest);

// Get all projects assigned to finance user
router.get("/projects", getAllProjects);

// Get project by ID
router.get("/projects/:id", getProjectById);

// Get activity by ID
router.get("/projects/:projectId/activities/:activityId", getActivityById);

module.exports = router;

