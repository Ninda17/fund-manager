const express = require("express");
const router = express.Router();
const { 
  createProject, 
  getFinancePersonnel, 
  getAllProjects, 
  getProjectById, 
  getActivityById,
  deleteProject,
  deleteActivity,
  deleteSubActivity,
  createReallocationRequest,
  getAllReallocationRequests,
  getReallocationRequestById,
  updateProject,
  getDashboardData,
  uploadDocument
} = require("../controllers/programController");
const { protect, programOnly } = require("../middleware/authMiddleware");
const { uploadDocument: uploadDocumentMiddleware } = require("../middleware/uploadDocumentMiddleware");


// All program routes require authentication and program role
router.use(protect, programOnly);

// Get finance personnel (for dropdown selection)
router.get("/finance-personnel", getFinancePersonnel);

// Get all projects created by logged-in user
router.get("/projects", getAllProjects);

// Get project by ID
router.get("/projects/:id", getProjectById);

// Update project (non-financial fields only)
router.put("/projects/:id", updateProject);

// Get activity by ID (within a project)
router.get("/projects/:projectId/activities/:activityId", getActivityById);

// Delete activity by ID (within a project)
router.delete("/projects/:projectId/activities/:activityId", deleteActivity);

// Delete subactivity by ID (within an activity within a project)
router.delete("/projects/:projectId/activities/:activityId/subactivities/:subactivityId", deleteSubActivity);

// Create project
router.post("/projects", createProject);

// Delete project
router.delete("/projects/:id", deleteProject);

// Reallocation request routes
router.post("/reallocation-requests", createReallocationRequest);
router.get("/reallocation-requests", getAllReallocationRequests);
router.get("/reallocation-requests/:id", getReallocationRequestById);

// Get dashboard data
router.get("/dashboard", getDashboardData);

// Upload document route (protected)
router.post("/upload-document", protect, programOnly, (req, res, next) => {
    uploadDocumentMiddleware(req, res, (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({
                success: false,
                message: err.message || "File upload error. Please check file type and size.",
            });
        }
        next();
    });
}, uploadDocument);

module.exports = router;

