const User = require("../models/userModel");
const Project = require("../models/projectModel")

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    // Get project count for each user
    const usersWithProjectCount = await Promise.all(
      users.map(async (user) => {
        // Count projects where user is either programPersonnel or financePersonnel
        const programProjectCount = await Project.countDocuments({
          programPersonnel: user._id,
        });

        const financeProjectCount = await Project.countDocuments({
          financePersonnel: user._id,
        });

        // Total projects associated with this user
        const totalProjectCount = programProjectCount + financeProjectCount;

        // Convert user to plain object and add projectCount
        const userObject = user.toObject();
        return {
          ...userObject,
          projectCount: totalProjectCount,
          // You can also include breakdown if needed:
          programProjectCount,
          financeProjectCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: usersWithProjectCount.length,
      data: usersWithProjectCount,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};


const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};


const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting admin account
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete admin account",
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const updateUserApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Validate isApproved field - must be one of the enum values
    const validStatuses = ["approved", "pending", "rejected"];
    if (!isApproved || !validStatuses.includes(isApproved)) {
      return res.status(400).json({
        success: false,
        message: `isApproved must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Admin accounts are always approved (handled by pre-save hook)
    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Admin accounts are automatically approved and cannot be changed",
      });
    }

    // Update approval status
    user.isApproved = isApproved;
    await user.save();

    // Generate appropriate message based on status
    let message = "";
    switch (isApproved) {
      case "approved":
        message = "User approved successfully";
        break;
      case "pending":
        message = "User status set to pending";
        break;
      case "rejected":
        message = "User rejected successfully";
        break;
      default:
        message = "User approval status updated successfully";
    }

    res.status(200).json({
      success: true,
      message,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Update user approval error:", error);
    
    // Handle validation errors from mongoose
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserApproval,
};

