const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserApproval,
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

module.exports = router;

