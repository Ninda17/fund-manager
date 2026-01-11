const { User, Project, ReallocationRequest, ActivityLog, Activity, SubActivity, ProjectDocument } = require("../models");
const { Op } = require("sequelize");
const { decrypt } = require("../utils/encryption");

// Helper function to decrypt nested activities and subactivities
const decryptActivityData = (activity) => {
  if (!activity) return activity;
  
  const decryptField = (encryptedValue, returnType = 'string') => {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      return encryptedValue;
    }
    
    // Check if encrypted (contains ':')
    if (!encryptedValue.includes(':')) {
      return encryptedValue;
    }
    
    try {
      const decrypted = decrypt(encryptedValue);
      
      if (returnType === 'number') {
        return parseFloat(decrypted) || 0;
      }
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedValue; // Return as-is if decryption fails
    }
  };
  
  // Decrypt activity fields (check for null/undefined, but also handle empty strings)
  if (activity.name !== null && activity.name !== undefined) {
    activity.name = decryptField(activity.name);
  }
  if (activity.description !== null && activity.description !== undefined) {
    activity.description = decryptField(activity.description);
  }
  if (activity.budget !== null && activity.budget !== undefined) {
    activity.budget = decryptField(activity.budget, 'number');
  }
  if (activity.expense !== null && activity.expense !== undefined) {
    activity.expense = decryptField(activity.expense, 'number');
  }
  
  // Decrypt subactivities if present
  if (activity.subActivities && Array.isArray(activity.subActivities)) {
    activity.subActivities.forEach(subActivity => {
      if (subActivity.name !== null && subActivity.name !== undefined) {
        subActivity.name = decryptField(subActivity.name);
      }
      if (subActivity.budget !== null && subActivity.budget !== undefined) {
        subActivity.budget = decryptField(subActivity.budget, 'number');
      }
      if (subActivity.expense !== null && subActivity.expense !== undefined) {
        subActivity.expense = decryptField(subActivity.expense, 'number');
      }
    });
  }
  
  return activity;
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });

    // Get project count for each user
    const usersWithProjectCount = await Promise.all(
      users.map(async (user) => {
        // Count projects where user is either programPersonnel or financePersonnel
        const programProjectCount = await Project.count({
          where: {
            programPersonnelId: user.id,
          },
        });

        const financeProjectCount = await Project.count({
          where: {
            financePersonnelId: user.id,
          },
        });

        // Total projects associated with this user
        const totalProjectCount = programProjectCount + financeProjectCount;

        // Convert user to plain object and add projectCount
        const userObject = user.toJSON();
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

    // Validate integer ID format
    const userId = parseInt(id);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
    });

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

    // Validate integer ID format
    const userId = parseInt(id);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // // Prevent deleting admin account
    // if (user.role === "admin") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Cannot delete admin account",
    //   });
    // }

    // // Prevent deleting yourself
    // if (user.id === req.user.id) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Cannot delete your own account",
    //   });
    // }

    await user.destroy();

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

    // Validate integer ID format
    const userId = parseInt(id);
    if (isNaN(userId) || userId <= 0) {
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

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Admin accounts are always approved (handled by beforeCreate hook)
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
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Update user approval error:", error);
    
    // Handle validation errors from Sequelize
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err) => err.message);
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
    const projects = await Project.findAll({
      attributes: [
        "id",
        "projectId",
        "title",
        "startDate",
        "endDate",
        "amountDonated",
        "currency",
        "totalExpense",
        "projectStatus",
        "programPersonnelId",
        "financePersonnelId",
        "createdAt",
      ],
      include: [
        {
          model: User,
          as: "financePersonnel",
          attributes: ["name", "email"],
        },
        {
          model: User,
          as: "programPersonnel",
          attributes: ["name", "email"],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Projects are already decrypted by model hooks
    const projectsData = projects.map((project) => project.toJSON());
    
    // Manually decrypt nested activities if present (hooks may not run for nested includes)
    projectsData.forEach(project => {
      if (project.activities && Array.isArray(project.activities)) {
        project.activities.forEach(activity => {
          decryptActivityData(activity);
        });
      }
    });

    res.status(200).json({
      success: true,
      count: projectsData.length,
      data: projectsData,
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

    // Validate integer ID format
    if (!Number.isInteger(parseInt(id))) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid project ID format" });
    }

    // Admin can fetch any project
    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          as: "financePersonnel",
          attributes: ["name", "email"],
        },
        {
          model: User,
          as: "programPersonnel",
          attributes: ["name", "email"],
        },
        {
          model: Activity,
          as: "activities",
          include: [
            {
              model: SubActivity,
              as: "subActivities",
            },
          ],
        },
        {
          model: ProjectDocument,
          as: "documents",
        },
      ],
    });

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Project fields are already decrypted by model hooks
    const projectData = project.toJSON();
    
    // Manually decrypt nested activities and subactivities (hooks may not run for nested includes)
    if (projectData.activities && Array.isArray(projectData.activities)) {
      projectData.activities.forEach(activity => {
        decryptActivityData(activity);
      });
    }
    
    // Transform documents array: Sequelize returns objects, but frontend expects array of URL strings
    if (projectData.documents && Array.isArray(projectData.documents)) {
      projectData.documents = projectData.documents.map(doc => {
        if (doc && typeof doc === 'object' && doc.documentUrl) {
          return doc.documentUrl;
        }
        if (typeof doc === 'string') {
          return doc;
        }
        return doc?.documentUrl || doc;
      }).filter(url => url);
    } else if (!projectData.documents) {
      projectData.documents = [];
    }

    res.status(200).json({ success: true, data: projectData });
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

    // Check admin access
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    // Find activity - can be by ID (integer) or activityId (string)
    let activity = null;

    // Strategy 1: Search by integer ID
    if (Number.isInteger(parseInt(activityId))) {
      activity = await Activity.findByPk(activityId, {
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "projectId", "title", "currency"],
          },
          {
            model: SubActivity,
            as: "subActivities",
          },
        ],
      });
    }

    // Strategy 2: Search by activityId field (string like "102")
    if (!activity) {
      activity = await Activity.findOne({
        where: { activityId: activityId },
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["id", "projectId", "title", "currency"],
          },
          {
            model: SubActivity,
            as: "subActivities",
          },
        ],
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Activity fields are already decrypted by model hooks
    const activityData = activity.toJSON();
    
    // Manually decrypt nested subactivities (hooks may not run for nested includes)
    decryptActivityData(activityData);
    
    // Manually decrypt project currency if present (hooks may not run for nested includes)
    const projectInfo = activityData.project;
    if (projectInfo && projectInfo.currency) {
      const decryptField = (encryptedValue) => {
        if (!encryptedValue || typeof encryptedValue !== 'string') {
          return encryptedValue;
        }
        if (!encryptedValue.includes(':')) {
          return encryptedValue; // Not encrypted
        }
        try {
          return decrypt(encryptedValue);
        } catch (error) {
          console.error('Decryption error for project currency:', error);
          return encryptedValue;
        }
      };
      projectInfo.currency = decryptField(projectInfo.currency);
    }

    res.status(200).json({
      success: true,
      data: {
        activity: activityData,
        project: projectInfo,
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

const getDashboardData = async (req, res) => {
  try {
    // Fetch Statistics
    const totalProjects = await Project.count();
    const totalReallocations = await ReallocationRequest.count();

    // Get all projects to calculate underspent/overspent
    const allProjects = await Project.findAll({
      attributes: ["amountDonated", "totalExpense"],
    });

    let underspentProjects = 0;
    let overspentProjects = 0;

    allProjects.forEach((project) => {
      // Fields are already decrypted by model hooks
      const amountDonated = project.amountDonated || 0;
      const totalExpense = project.totalExpense || 0;

      if (totalExpense < amountDonated) {
        underspentProjects++;
      } else if (totalExpense > amountDonated) {
        overspentProjects++;
      }
    });

    // Reallocation Status Distribution
    const reallocationStatuses = ["pending", "approved", "rejected"];
    const reallocationStatusDistribution = {};
    
    for (const status of reallocationStatuses) {
      const count = await ReallocationRequest.count({
        where: { status },
      });
      reallocationStatusDistribution[status] = count;
    }

    // Project Status Distribution
    const projectStatuses = ["Not Started", "In Progress", "Completed"];
    const projectStatusDistribution = {};
    
    for (const status of projectStatuses) {
      const count = await Project.count({
        where: { projectStatus: status },
      });
      projectStatusDistribution[status] = count;
    }

    // Fetch recent 5 projects
    const recentProjects = await Project.findAll({
      attributes: ["id", "projectId", "title", "projectStatus", "createdAt"],
      include: [
        {
          model: User,
          as: "financePersonnel",
          attributes: ["name", "email"],
        },
        {
          model: User,
          as: "programPersonnel",
          attributes: ["name", "email"],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    // Projects are already decrypted by model hooks
    const recentProjectsData = recentProjects.map((project) => project.toJSON());

    // Fetch recent 5 users
    const recentUsers = await User.findAll({
      attributes: ["id", "name", "email", "role", "isApproved", "createdAt"],
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    const recentUsersData = recentUsers.map((user) => user.toJSON());

    res.status(200).json({
      success: true,
      statistics: {
        totalProjects,
        totalReallocations,
        underspentProjects,
        overspentProjects,
      },
      charts: {
        reallocationStatusDistribution,
        projectStatusDistribution,
      },
      recentProjects: recentProjectsData,
      recentUsers: recentUsersData,
    });
  } catch (error) {
    console.error("Get dashboard data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: error.message,
    });
  }
};
// Get user activity history (only for admin)
const getUserActivityHistory = async (req, res) => {
  try {
    const { search = "" } = req.query;

    // Only admin can access this endpoint
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admin can view activity logs.",
      });
    }

    // Build query - only show finance and program manager activities
    const where = {
      userRole: { [Op.in]: ["finance", "program"] },
    };

    // Optional search by email or action
    if (search) {
      where[Op.or] = [
        { userEmail: { [Op.like]: `%${search}%` } },
        { action: { [Op.like]: `%${search}%` } },
      ];
    }

    // Fetch all logs without pagination
    const logs = await ActivityLog.findAll({
      attributes: ["id", "timestamp", "userEmail", "action"],
      where,
      order: [['timestamp', 'DESC']],
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      dateTime: log.timestamp,
      email: log.userEmail,
      action: log.action,
    }));

    res.status(200).json({
      success: true,
      count: formattedLogs.length,
      total: formattedLogs.length,
      data: formattedLogs,
    });
  } catch (error) {
    console.error("Get user activity history error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Delete user activity history (only for admin)
const deleteUserActivityHistory = async (req, res) => {
  try {
    const { logIds } = req.body;

    // Only admin can access this endpoint
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admin can delete activity logs.",
      });
    }

    // Validate logIds
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of log IDs to delete.",
      });
    }

    // Validate all IDs are integers
    const validIds = logIds.filter((id) => Number.isInteger(parseInt(id)) && parseInt(id) > 0);
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid log IDs provided.",
      });
    }

    // Delete the logs
    const deletedCount = await ActivityLog.destroy({
      where: {
        id: { [Op.in]: validIds },
        userRole: { [Op.in]: ["finance", "program"] }, // Only allow deleting finance and program logs
      },
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No activity logs found to delete.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} ${deletedCount === 1 ? 'log' : 'logs'}.`,
      deletedCount,
    });
  } catch (error) {
    console.error("Delete user activity history error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Admin - Get all reallocation requests
const getAllReallocationRequestsForAdmin = async (req, res) => {
  try {
    const { status } = req.query;

    // Build query - empty query gets all requests (no user filter)
    const where = {};
    
    // Optional status filter
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }

    // Fetch all requests with populated data
    const requests = await ReallocationRequest.findAll({
      where,
      include: [
        {
          model: User,
          as: "requestedBy",
          attributes: ["name", "email"],
        },
        {
          model: Project,
          as: "sourceProject",
          attributes: ["projectId", "title"],
        },
        {
          model: Project,
          as: "destinationProject",
          attributes: ["projectId", "title"],
        },
        {
          model: Project,
          as: "project",
          attributes: ["projectId", "title"],
        },
        {
          model: User,
          as: "approvedBy",
          attributes: ["name", "email"],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const requestsData = requests.map((request) => request.toJSON());

    res.status(200).json({
      success: true,
      count: requestsData.length,
      data: requestsData,
    });
  } catch (error) {
    console.error("Admin get all reallocation requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Simple admin version
const getReallocationRequestByIdForAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate integer ID format
    if (!Number.isInteger(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    // Note: Using findByPk instead of findOne with requestedBy filter
    const request = await ReallocationRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: "requestedBy",
          attributes: ["name", "email"],
        },
        {
          model: Project,
          as: "sourceProject",
          attributes: ["projectId", "title"],
        },
        {
          model: Project,
          as: "destinationProject",
          attributes: ["projectId", "title"],
        },
        {
          model: Project,
          as: "project",
          attributes: ["projectId", "title"],
        },
        {
          model: User,
          as: "approvedBy",
          attributes: ["name", "email"],
        },
      ],
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Reallocation request not found",
      });
    }

    const requestData = request.toJSON();

    res.status(200).json({
      success: true,
      data: requestData,
    });
  } catch (error) {
    console.error("Admin get reallocation request by ID error:", error);
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
  getAllProjectsAdmin,
  getProjectById,
  getActivityById,
  getDashboardData,
  getUserActivityHistory,
  deleteUserActivityHistory,
  getAllReallocationRequestsForAdmin,
  getReallocationRequestByIdForAdmin,
};
