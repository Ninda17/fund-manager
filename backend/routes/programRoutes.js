const express = require("express");
const router = express.Router();
const { createProject, getFinancePersonnel } = require("../controllers/programController");
const { protect, programOnly } = require("../middleware/authMiddleware");


// All program routes require authentication and program role
router.use(protect, programOnly);

// Get finance personnel (for dropdown selection)
router.get("/finance-personnel", getFinancePersonnel);

// Create project
router.post("/projects", createProject);

module.exports = router;

