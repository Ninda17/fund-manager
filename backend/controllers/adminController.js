const User = require("../models/userModel");
const Project = require("../models/projectModel");
const ReallocationRequest = require("../models/reallocationRequestModel")

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

// Get all projects (for admin)
const getAllProjectsAdmin = async (req, res) => {
  try {
    // Fetch all projects in the database
    const projects = await Project.find()
      .select(
        "projectId title startDate endDate financePersonnel amountDonated currency totalExpense projectStatus programPersonnel"
      )
      .populate("financePersonnel", "name email")
      .populate("programPersonnel", "name email") // show the program manager who created it
      .lean()
      .sort({ createdAt: -1 });

    // Decrypt fields if encrypted
    const { decrypt } = require("../utils/encryption");
    const decryptedProjects = projects.map((project) => {
      const p = { ...project };

      if (p.amountDonated && typeof p.amountDonated === "string" && p.amountDonated.includes(":")) {
        p.amountDonated = parseFloat(decrypt(p.amountDonated)) || 0;
      }
      if (p.totalExpense && typeof p.totalExpense === "string" && p.totalExpense.includes(":")) {
        p.totalExpense = parseFloat(decrypt(p.totalExpense)) || 0;
      }
      if (p.startDate && typeof p.startDate === "string" && p.startDate.includes(":")) {
        p.startDate = new Date(decrypt(p.startDate));
      }
      if (p.endDate && typeof p.endDate === "string" && p.endDate.includes(":")) {
        p.endDate = new Date(decrypt(p.endDate));
      }
      if (p.currency && typeof p.currency === "string" && p.currency.includes(":")) {
        p.currency = decrypt(p.currency);
      }

      return p;
    });

    res.status(200).json({
      success: true,
      count: decryptedProjects.length,
      data: decryptedProjects,
    });
  } catch (err) {
    console.error("Error fetching all projects for admin:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};


const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid project ID format" });
    }

    // Admin can fetch any project
    const project = await Project.findById(id)
      .populate("financePersonnel", "name email")
      .populate("programPersonnel", "name email")
      .lean();

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Decrypt fields
    const { decrypt } = require("../utils/encryption");
    const decryptField = (field) =>
      field && typeof field === "string" && field.includes(":")
        ? decrypt(field)
        : field;

    const decrypted = {
      ...project,
      donorName: decryptField(project.donorName),
      description: decryptField(project.description),
      amountDonated: parseFloat(decryptField(project.amountDonated)) || 0,
      startDate: project.startDate
        ? new Date(decryptField(project.startDate))
        : null,
      endDate: project.endDate ? new Date(decryptField(project.endDate)) : null,
      currency: decryptField(project.currency),
      projectType: decryptField(project.projectType),
      totalExpense: parseFloat(decryptField(project.totalExpense)) || 0,
    };

    // Decrypt activities recursively
    if (decrypted.activities && Array.isArray(decrypted.activities)) {
      decrypted.activities = decrypted.activities.map((activity) => {
        const decryptedActivity = { ...activity };
        decryptedActivity.name = decryptField(activity.name);
        decryptedActivity.description = decryptField(activity.description);
        decryptedActivity.budget =
          parseFloat(decryptField(activity.budget)) || 0;
        decryptedActivity.expense =
          parseFloat(decryptField(activity.expense)) || 0;

        if (activity.subActivities && Array.isArray(activity.subActivities)) {
          decryptedActivity.subActivities = activity.subActivities.map(
            (sub) => ({
              ...sub,
              name: decryptField(sub.name),
              budget: parseFloat(decryptField(sub.budget)) || 0,
              expense: parseFloat(decryptField(sub.expense)) || 0,
            })
          );
        }

        return decryptedActivity;
      });
    }

    res.status(200).json({ success: true, data: decrypted });
  } catch (error) {
    console.error("Error fetching project details:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error. Please try again later.",
      });
  }
};


// controllers/adminController.js
const getActivityById = async (req, res) => {
  try {
    const { activityId } = req.params;

    // For admin, we don't need projectId, just activityId
    // activityId can be MongoDB ObjectId or activityId field (like "102")

    // Check admin access
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    // Find the project that contains this activity
    let project = null;
    let activity = null;
    const mongoose = require('mongoose');

    // Strategy 1: Search by activityId field (like "102")
    project = await Project.findOne({
      "activities.activityId": activityId
    }).lean();

    if (project && project.activities) {
      activity = project.activities.find(
        (act) => act.activityId && act.activityId.toString() === activityId
      );
    }

    // Strategy 2: Search by MongoDB _id
    if (!activity && mongoose.Types.ObjectId.isValid(activityId)) {
      project = await Project.findOne({
        "activities._id": new mongoose.Types.ObjectId(activityId)
      }).lean();

      if (project && project.activities) {
        activity = project.activities.find(
          (act) => act._id && act._id.toString() === activityId
        );
      }
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Decrypt all encrypted fields manually
    const { decrypt } = require("../utils/encryption");
    const decryptedActivity = { ...activity };
    
    // Decrypt activity name
    if (decryptedActivity.name && typeof decryptedActivity.name === 'string' && decryptedActivity.name.includes(':')) {
      decryptedActivity.name = decrypt(decryptedActivity.name);
    }
    
    // Decrypt activity description
    if (decryptedActivity.description && typeof decryptedActivity.description === 'string' && decryptedActivity.description !== '' && decryptedActivity.description.includes(':')) {
      decryptedActivity.description = decrypt(decryptedActivity.description);
    }
    
    // Decrypt activity budget
    if (decryptedActivity.budget && typeof decryptedActivity.budget === 'string' && decryptedActivity.budget.includes(':')) {
      decryptedActivity.budget = parseFloat(decrypt(decryptedActivity.budget)) || 0;
    }
    
    // Decrypt activity expense
    if (decryptedActivity.expense && typeof decryptedActivity.expense === 'string' && decryptedActivity.expense.includes(':')) {
      decryptedActivity.expense = parseFloat(decrypt(decryptedActivity.expense)) || 0;
    }
    
    // Decrypt subActivities
    if (decryptedActivity.subActivities && Array.isArray(decryptedActivity.subActivities)) {
      decryptedActivity.subActivities = decryptedActivity.subActivities.map(subActivity => {
        const decryptedSubActivity = { ...subActivity };
        
        // Decrypt sub activity name
        if (decryptedSubActivity.name && typeof decryptedSubActivity.name === 'string' && decryptedSubActivity.name.includes(':')) {
          decryptedSubActivity.name = decrypt(decryptedSubActivity.name);
        }
        
        // Decrypt sub activity budget
        if (decryptedSubActivity.budget && typeof decryptedSubActivity.budget === 'string' && decryptedSubActivity.budget.includes(':')) {
          decryptedSubActivity.budget = parseFloat(decrypt(decryptedSubActivity.budget)) || 0;
        }
        
        // Decrypt sub activity expense
        if (decryptedSubActivity.expense && typeof decryptedSubActivity.expense === 'string' && decryptedSubActivity.expense.includes(':')) {
          decryptedSubActivity.expense = parseFloat(decrypt(decryptedSubActivity.expense)) || 0;
        }
        
        return decryptedSubActivity;
      });
    }

    // Also include project basic info for context
    const projectInfo = {
      _id: project._id,
      projectId: project.projectId,
      title: project.title && typeof project.title === 'string' && project.title.includes(':') 
        ? decrypt(project.title) 
        : project.title,
      currency: project.currency && typeof project.currency === 'string' && project.currency.includes(':') 
        ? decrypt(project.currency) 
        : project.currency
    };

    res.status(200).json({
      success: true,
      data: {
        activity: decryptedActivity,
        project: projectInfo
      },
    });
  } catch (error) {
    console.error("Error fetching activity details:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// controllers/adminController.js
const getAllReallocationRequestsForAdmin = async (req, res) => {
  try {
    const { 
      status, 
      requestedBy,
      approvedBy,
      sourceProjectId,
      destinationProjectId,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    // Status filter
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    // Requested by user filter
    if (requestedBy) {
      query.requestedBy = requestedBy;
    }

    // Approved by user filter
    if (approvedBy) {
      query.approvedBy = approvedBy;
    }

    // Source project filter
    if (sourceProjectId) {
      query.sourceProjectId = sourceProjectId;
    }

    // Destination project filter
    if (destinationProjectId) {
      query.destinationProjectId = destinationProjectId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Pagination calculation
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get total count for pagination info
    const totalRequests = await ReallocationRequest.countDocuments(query);

    // Fetch requests with pagination and population - REMOVE rejectedBy
    const requests = await ReallocationRequest.find(query)
      .populate("requestedBy", "name email employeeId department")
      .populate("sourceProjectId", "projectId title manager client")
      .populate("destinationProjectId", "projectId title manager client")
      .populate("projectId", "projectId title")
      .populate("approvedBy", "name email role")
      // .populate("rejectedBy", "name email role") // REMOVE THIS LINE
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(totalRequests / limitNum);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      count: requests.length,
      total: totalRequests,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        hasNextPage,
        hasPrevPage,
        limit: limitNum
      },
      data: requests,
    });
  } catch (error) {
    console.error("Get all reallocation requests for admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getReallocationRequestByIdForAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      // REMOVE THIS LINE:
      // console.log("Invalid ID format:", id);
      return res.status(400).json({
        success: false,
        message: "Invalid reallocation request ID format",
      });
    }

    // Admin can view any request without user restriction
    const request = await ReallocationRequest.findById(id)
      .populate("requestedBy", "name email employeeId department")
      .populate("sourceProjectId", "projectId title projectManager")
      .populate("destinationProjectId", "projectId title projectManager")
      .populate("projectId", "projectId title")
      .populate("approvedBy", "name email")
      .lean();


    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Reallocation request not found",
      });
    }

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    // Keep error logs for debugging
    console.error("Admin get reallocation request by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserApproval,
  getAllProjectsAdmin,
  getProjectById,
  getActivityById,
  getAllReallocationRequestsForAdmin,
  getReallocationRequestByIdForAdmin,
};
