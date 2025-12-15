const express = require('express');
const router = express.Router();
const {
  downloadProjectReport,
  downloadActivityReport,
  downloadSubactivityReport,
} = require('../controllers/sharedController');
const { protect } = require('../middleware/authMiddleware');

// All shared routes require authentication (any role)
router.use(protect);

// Download project report
router.get('/reports/project/:projectId', downloadProjectReport);

// Download activity report
router.get('/reports/activity/:projectId/:activityId', downloadActivityReport);

// Download subactivity report
router.get('/reports/subactivity/:projectId/:activityId/:subactivityId', downloadSubactivityReport);

module.exports = router;

