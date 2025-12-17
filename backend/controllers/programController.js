const Project = require("../models/projectModel");
const User = require("../models/userModel");
const ReallocationRequest = require("../models/reallocationRequestModel");
const mongoose = require("mongoose");

const createProject = async (req, res) => {
  try {
    const {
      projectId,
      title,
      description,
      startDate,
      endDate,
      financePersonnel,
      donorName,
      amountDonated,
      currency,
      projectType,
      activities,
    } = req.body;

    // Validate required fields
    if (!projectId || !title || !startDate || !endDate || !financePersonnel || !donorName || !amountDonated) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: projectId, title, startDate, endDate, financePersonnel, donorName, and amountDonated",
      });
    }

    // Validate projectId format (if you have a specific format requirement)
    // Check if projectId already exists
    const existingProject = await Project.findOne({ projectId });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "Project with this projectId already exists",
      });
    }

    // Validate financePersonnel is a valid ObjectId
    if (!financePersonnel.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid financePersonnel ID format",
      });
    }

    // Verify financePersonnel exists and has role "finance"
    const financeUser = await User.findById(financePersonnel);
    if (!financeUser) {
      return res.status(404).json({
        success: false,
        message: "Finance personnel user not found",
      });
    }

    if (financeUser.role !== "finance") {
      return res.status(400).json({
        success: false,
        message: "Finance personnel must be a user with role 'finance'",
      });
    }

    // Validate amountDonated is a positive number
    const amount = parseFloat(amountDonated);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount donated must be a non-negative number",
      });
    }

    // Validate currency if provided
    const validCurrencies = ["USD", "EUR", "BTN"];
    const selectedCurrency = currency || "USD";
    if (!validCurrencies.includes(selectedCurrency)) {
      return res.status(400).json({
        success: false,
        message: `Currency must be one of: ${validCurrencies.join(", ")}`,
      });
    }

    // Validate projectType if provided
    const validProjectTypes = ["Education", "Welfare", "Youth"];
    const selectedProjectType = projectType || "Education";
    if (!validProjectTypes.includes(selectedProjectType)) {
      return res.status(400).json({
        success: false,
        message: `Project type must be one of: ${validProjectTypes.join(", ")}`,
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid startDate format",
      });
    }

    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid endDate format",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Validate activities structure if provided
    if (activities && Array.isArray(activities)) {
      for (const activity of activities) {
        if (!activity.activityId || !activity.name) {
          return res.status(400).json({
            success: false,
            message: "Each activity must have activityId and name",
          });
        }

        // Validate subActivities if provided
        if (activity.subActivities && Array.isArray(activity.subActivities)) {
          for (const subActivity of activity.subActivities) {
            if (!subActivity.subactivityId) {
              return res.status(400).json({
                success: false,
                message: "Each sub-activity must have a subactivityId",
              });
            }
            
            if (!subActivity.name) {
              return res.status(400).json({
                success: false,
                message: "Each sub-activity must have a name",
              });
            }

            // Validate budget if provided
            if (subActivity.budget !== undefined && subActivity.budget !== null) {
              const budget = parseFloat(subActivity.budget);
              if (isNaN(budget) || budget < 0) {
                return res.status(400).json({
                  success: false,
                  message: "Sub-activity budget must be a non-negative number",
                });
              }
            }
          }
        }

        // Validate activity budget if provided
        if (activity.budget !== undefined && activity.budget !== null) {
          const budget = parseFloat(activity.budget);
          if (isNaN(budget) || budget < 0) {
            return res.status(400).json({
              success: false,
              message: "Activity budget must be a non-negative number",
            });
          }
        }
      }
    }

    // Create project
    // Note: amountDonated will be encrypted by pre-save hook
    // programPersonnel is set from the authenticated user
    const project = await Project.create({
      programPersonnel: req.user.id, // Set from authenticated user
      projectId,
      title,
      description: description || "",
      startDate: start,
      endDate: end,
      financePersonnel,
      donorName,
      amountDonated: amount.toString(), // Will be encrypted by pre-save hook
      currency: selectedCurrency,
      projectType: selectedProjectType,
      activities: activities || [],
    });

    // Project will be automatically decrypted by post-save hook
    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {

    // Handle validation errors from mongoose
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle duplicate key error (projectId)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Project with this projectId already exists",
      });
    }

    // Handle custom validation errors from pre-save hooks
    if (error.message.includes("Financial personnel") || 
        error.message.includes("Program personnel") ||
        error.message.includes("End date")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getFinancePersonnel = async (req, res) => {
  try {
    const User = require("../models/userModel");
    
    // Get all finance users who are verified and approved
    const financeUsers = await User.find({
      role: "finance",
      isEmailVerified: true,
      isApproved: "approved"
    })
    .select("-password")
    .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: financeUsers.length,
      data: financeUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getAllProjects = async (req, res) => {
  try {
    // Get all projects created by the logged-in user (programPersonnel)
    // Use lean() to get plain objects, then decrypt manually
    const projects = await Project.find({
      programPersonnel: req.user.id
    })
    .select("projectId title startDate endDate financePersonnel amountDonated currency totalExpense projectStatus")
    .populate("financePersonnel", "name email")
    .lean()
    .sort({ createdAt: -1 });

    // Decrypt the encrypted fields manually
    const { decrypt } = require("../utils/encryption");
    const decryptedProjects = projects.map(project => {
      const decrypted = { ...project };
      
      // Decrypt amountDonated
      if (decrypted.amountDonated && typeof decrypted.amountDonated === 'string' && decrypted.amountDonated.includes(':')) {
        decrypted.amountDonated = parseFloat(decrypt(decrypted.amountDonated)) || 0;
      }
      
      // Decrypt startDate
      if (decrypted.startDate && typeof decrypted.startDate === 'string' && decrypted.startDate.includes(':')) {
        decrypted.startDate = new Date(decrypt(decrypted.startDate));
      }
      
      // Decrypt endDate
      if (decrypted.endDate && typeof decrypted.endDate === 'string' && decrypted.endDate.includes(':')) {
        decrypted.endDate = new Date(decrypt(decrypted.endDate));
      }
      
      // Decrypt currency
      if (decrypted.currency && typeof decrypted.currency === 'string' && decrypted.currency.includes(':')) {
        decrypted.currency = decrypt(decrypted.currency);
      }
      
      // Decrypt totalExpense
      if (decrypted.totalExpense && typeof decrypted.totalExpense === 'string' && decrypted.totalExpense.includes(':')) {
        decrypted.totalExpense = parseFloat(decrypt(decrypted.totalExpense)) || 0;
      }
      
      return decrypted;
    });

    res.status(200).json({
      success: true,
      count: decryptedProjects.length,
      data: decryptedProjects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Get project by ID, ensuring it belongs to the logged-in user
    // Use lean() to get plain objects, then decrypt manually
    const project = await Project.findOne({
      _id: id,
      programPersonnel: req.user.id
    })
    .populate("financePersonnel", "name email")
    .populate("programPersonnel", "name email")
    .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Decrypt all encrypted fields manually
    const { decrypt } = require("../utils/encryption");
    const decrypted = { ...project };
    
    // Decrypt donorName
    if (decrypted.donorName && typeof decrypted.donorName === 'string' && decrypted.donorName.includes(':')) {
      decrypted.donorName = decrypt(decrypted.donorName);
    }
    
    // Decrypt description
    if (decrypted.description && typeof decrypted.description === 'string' && decrypted.description !== '' && decrypted.description.includes(':')) {
      decrypted.description = decrypt(decrypted.description);
    }
    
    // Decrypt amountDonated
    if (decrypted.amountDonated && typeof decrypted.amountDonated === 'string' && decrypted.amountDonated.includes(':')) {
      decrypted.amountDonated = parseFloat(decrypt(decrypted.amountDonated)) || 0;
    }
    
    // Decrypt startDate
    if (decrypted.startDate && typeof decrypted.startDate === 'string' && decrypted.startDate.includes(':')) {
      decrypted.startDate = new Date(decrypt(decrypted.startDate));
    }
    
    // Decrypt endDate
    if (decrypted.endDate && typeof decrypted.endDate === 'string' && decrypted.endDate.includes(':')) {
      decrypted.endDate = new Date(decrypt(decrypted.endDate));
    }
    
    // Decrypt currency
    if (decrypted.currency && typeof decrypted.currency === 'string' && decrypted.currency.includes(':')) {
      decrypted.currency = decrypt(decrypted.currency);
    }
    
    // Decrypt projectType
    if (decrypted.projectType && typeof decrypted.projectType === 'string' && decrypted.projectType.includes(':')) {
      decrypted.projectType = decrypt(decrypted.projectType);
    }
    
    // Decrypt totalExpense
    if (decrypted.totalExpense && typeof decrypted.totalExpense === 'string' && decrypted.totalExpense.includes(':')) {
      decrypted.totalExpense = parseFloat(decrypt(decrypted.totalExpense)) || 0;
    }
    
    // Decrypt activities
    if (decrypted.activities && Array.isArray(decrypted.activities)) {
      decrypted.activities = decrypted.activities.map(activity => {
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
        
        return decryptedActivity;
      });
    }

    res.status(200).json({
      success: true,
      data: decrypted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};


const getActivityById = async (req, res) => {
  try {
    const { projectId, activityId } = req.params;

    // Validate projectId format
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // activityId can be MongoDB ObjectId or activityId string, so no strict validation needed

    // Get project by ID, ensuring it belongs to the logged-in user
    // Use lean() to get plain objects, then decrypt manually
    const project = await Project.findOne({
      _id: projectId,
      programPersonnel: req.user.id
    })
    .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Find the activity within the project's activities array
    // activityId could be MongoDB _id or activityId field
    let activity = null;
    if (project.activities && Array.isArray(project.activities)) {
      activity = project.activities.find(
        (act) => act._id?.toString() === activityId || act.activityId === activityId
      );
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
      title: project.title,
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

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId,
      title,
      description,
      startDate,
      endDate,
      financePersonnel,
      donorName,
      amountDonated,
      currency,
      projectType,
      projectStatus,
      activities,
    } = req.body;

    // Validate id format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Find project by ID, ensuring it belongs to the logged-in user
    // Use lean() to get plain object and avoid Mongoose document validation issues
    const existingProject = await Project.findOne({
      _id: id,
      programPersonnel: req.user.id
    }).lean();

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // If projectId is being updated, check for duplicates (excluding current project)
    if (projectId && projectId !== existingProject.projectId) {
      const duplicateProject = await Project.findOne({ 
        projectId,
        _id: { $ne: id } // Exclude current project
      });
      if (duplicateProject) {
        return res.status(400).json({
          success: false,
          message: "Project with this projectId already exists",
        });
      }
    }

    // Build update object
    const updateObj = {};

    // Update projectId if provided
    if (projectId !== undefined) {
      updateObj.projectId = projectId;
    }

    // Update title if provided
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty",
        });
      }
      updateObj.title = title.trim();
    }

    // Update description if provided
    if (description !== undefined) {
      updateObj.description = description || "";
    }

    // Update dates if provided
    if (startDate !== undefined) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate format",
        });
      }
      updateObj.startDate = start;
    }

    if (endDate !== undefined) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid endDate format",
        });
      }
      updateObj.endDate = end;
    }

    // Validate date range if both dates are provided
    const finalStartDate = updateObj.startDate || existingProject.startDate;
    const finalEndDate = updateObj.endDate || existingProject.endDate;
    if (finalStartDate && finalEndDate) {
      // Handle encrypted dates from existingProject
      let start = finalStartDate instanceof Date ? finalStartDate : new Date(finalStartDate);
      let end = finalEndDate instanceof Date ? finalEndDate : new Date(finalEndDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }
      
      if (end < start) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    // Update financePersonnel if provided
    if (financePersonnel !== undefined) {
      if (!financePersonnel.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: "Invalid financePersonnel ID format",
        });
      }

      // Verify financePersonnel exists and has role "finance"
      const financeUser = await User.findById(financePersonnel);
      if (!financeUser) {
        return res.status(404).json({
          success: false,
          message: "Finance personnel user not found",
        });
      }

      if (financeUser.role !== "finance") {
        return res.status(400).json({
          success: false,
          message: "Finance personnel must be a user with role 'finance'",
        });
      }

      updateObj.financePersonnel = financePersonnel;
    }

    // Update donorName if provided
    if (donorName !== undefined) {
      if (!donorName || !donorName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Donor name cannot be empty",
        });
      }
      updateObj.donorName = donorName.trim();
    }

    // Update amountDonated if provided
    if (amountDonated !== undefined) {
      const amount = parseFloat(amountDonated);
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({
          success: false,
          message: "Amount donated must be a non-negative number",
        });
      }
      updateObj.amountDonated = amount.toString(); // Will be encrypted by pre-save hook
    }

    // Update currency if provided
    if (currency !== undefined) {
      const validCurrencies = ["USD", "EUR", "BTN"];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({
          success: false,
          message: `Currency must be one of: ${validCurrencies.join(", ")}`,
        });
      }
      updateObj.currency = currency;
    }

    // Update projectType if provided
    if (projectType !== undefined) {
      const validProjectTypes = ["Education", "Welfare", "Youth", "other"];
      if (!validProjectTypes.includes(projectType)) {
        return res.status(400).json({
          success: false,
          message:`Project type must be one of: ${validProjectTypes.join(", ")}`,
        });
      }
      updateObj.projectType = projectType;
    }

    // Update projectStatus if provided
    if (projectStatus !== undefined) {
      const validStatuses = ["Not Started", "In Progress", "Completed"];
      if (!validStatuses.includes(projectStatus)) {
        return res.status(400).json({
          success: false,
          message: `Project status must be one of: ${validStatuses.join(", ")}`,
        });
      }
      updateObj.projectStatus = projectStatus;
    }

    // Update activities if provided
    if (activities !== undefined) {
      if (!Array.isArray(activities)) {
        return res.status(400).json({
          success: false,
          message: "Activities must be an array",
        });
      }

      // Validate activities structure
      for (const activity of activities) {
        if (!activity.activityId || !activity.name) {
          return res.status(400).json({
            success: false,
            message: "Each activity must have activityId and name",
          });
        }

        // Validate subActivities if provided
        if (activity.subActivities && Array.isArray(activity.subActivities)) {
          for (const subActivity of activity.subActivities) {
            if (!subActivity.subactivityId) {
              return res.status(400).json({
                success: false,
                message: "Each sub-activity must have a subactivityId",
              });
            }
            
            if (!subActivity.name) {
              return res.status(400).json({
                success: false,
                message: "Each sub-activity must have a name",
              });
            }

            // Validate budget if provided
            if (subActivity.budget !== undefined && subActivity.budget !== null) {
              const budget = parseFloat(subActivity.budget);
              if (isNaN(budget) || budget < 0) {
                return res.status(400).json({
                  success: false,
                  message: "Sub-activity budget must be a non-negative number",
                });
              }
            }
          }
        }

        // Validate activity budget if provided
        if (activity.budget !== undefined && activity.budget !== null) {
          const budget = parseFloat(activity.budget);
          if (isNaN(budget) || budget < 0) {
            return res.status(400).json({
              success: false,
              message: "Activity budget must be a non-negative number",
            });
          }
        }
      }

      updateObj.activities = activities;
    }

    // Use findByIdAndUpdate with runValidators: false to avoid casting errors on encrypted fields
    await Project.findByIdAndUpdate(
      id,
      { $set: updateObj },
      { runValidators: false, new: false }
    );

    // Fetch the document again and save to trigger pre-save hooks (encryption and expense calculation)
    const updatedProject = await Project.findById(id);
    if (!updatedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update",
      });
    }

    // Mark activities as modified if they were updated
    if (activities !== undefined) {
      updatedProject.markModified('activities');
    }

    // Reset totalExpense to undefined so it gets recalculated by pre-save hook
    // This avoids validation errors on the encrypted value
    updatedProject.totalExpense = undefined;
    updatedProject.markModified('totalExpense');

    // Save to trigger pre-save hooks (expense calculation and encryption)
    await updatedProject.save();
    
    // Use the saved project for response
    const savedProject = updatedProject;

    // Check utilization and send notifications (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      // Get project as plain object for utilization check
      const projectForCheck = await Project.findById(id).lean();
      if (projectForCheck) {
        // Run in background - don't wait for it
        checkProjectItemsUtilization(projectForCheck).catch(err => {
          console.error("Error checking utilization:", err);
        });
      }
    } catch (error) {
      console.error("Error setting up utilization check:", error);
      // Don't fail the request if notification fails
    }

    // Project will be automatically decrypted by post-save hook
    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: savedProject,
    });
  } catch (error) {
    console.error("Update project error:", error);

    // Handle validation errors from mongoose
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle duplicate key error (projectId)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Project with this projectId already exists",
      });
    }

    // Handle custom validation errors from pre-save hooks
    if (error.message.includes("Financial personnel") || 
        error.message.includes("Program personnel") ||
        error.message.includes("End date")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Find project by ID, ensuring it belongs to the logged-in user
    const project = await Project.findOne({
      _id: id,
      programPersonnel: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Delete the project
    await Project.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }

};

const deleteActivity = async (req, res) => {
  try {
    const { projectId, activityId } = req.params;

    // Validate projectId format
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Validate activityId format (MongoDB ObjectId)
    if (!activityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID format",
      });
    }

    // First, verify the project exists and belongs to the logged-in user
    const project = await Project.findOne({
      _id: projectId,
      programPersonnel: req.user.id
    }).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Check if activities array exists and has items
    if (!project.activities || !Array.isArray(project.activities) || project.activities.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No activities found in this project",
      });
    }

    // Verify the activity exists
    const activityExists = project.activities.some(
      (act) => act._id && act._id.toString() === activityId
    );

    if (!activityExists) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Use findByIdAndUpdate with $pull to remove the activity
    // Use runValidators: false to avoid validation errors on encrypted fields
    const result = await Project.findByIdAndUpdate(
      projectId,
      {
        $pull: { activities: { _id: activityId } }
      },
      { runValidators: false, new: false }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update",
      });
    }

    // Fetch the remaining activities to recalculate totalExpense
    // Use lean() to avoid Mongoose casting issues with encrypted fields
    const updatedProject = await Project.findById(projectId).lean();

    if (!updatedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found after deletion",
      });
    }

    // Recalculate totalExpense from remaining activities
    // Need to decrypt expenses to calculate, then encrypt the result
    const { decrypt, encrypt } = require("../utils/encryption");
    let totalExpense = 0;

    if (updatedProject.activities && Array.isArray(updatedProject.activities)) {
      updatedProject.activities.forEach(activity => {
        // Calculate activity expense from sub-activities (same logic as pre-save hook)
        let activityExpense = 0;
        if (activity.subActivities && Array.isArray(activity.subActivities)) {
          activity.subActivities.forEach(subActivity => {
            if (subActivity.expense !== undefined && subActivity.expense !== null) {
              let subExpense = 0;
              if (typeof subActivity.expense === 'string' && subActivity.expense.includes(':')) {
                subExpense = parseFloat(decrypt(subActivity.expense)) || 0;
              } else if (typeof subActivity.expense === 'number') {
                subExpense = subActivity.expense;
              }
              activityExpense += subExpense;
            }
          });
        }
        totalExpense += activityExpense;
      });
    }

    // Update totalExpense directly using MongoDB native collection method
    // This bypasses Mongoose casting which would fail on encrypted string values
    // Encrypt the totalExpense value
    const encryptedTotalExpense = encrypt(totalExpense.toString());
    
    // Use MongoDB native collection to bypass Mongoose schema casting
    const mongoose = require("mongoose");
    await Project.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(projectId) },
      { $set: { totalExpense: encryptedTotalExpense } }
    );

    // Check utilization and send notifications (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      const projectForCheck = await Project.findById(projectId).lean();
      if (projectForCheck) {
        checkProjectItemsUtilization(projectForCheck).catch(err => {
          console.error("Error checking utilization:", err);
        });
      }
    } catch (error) {
      console.error("Error setting up utilization check:", error);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      message: "Activity deleted successfully",
    });
  } catch (error) {
    console.error("Delete activity error:", error);
    
    // Handle validation errors from mongoose
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const deleteSubActivity = async (req, res) => {
  try {
    const { projectId, activityId, subactivityId } = req.params;

    // Validate projectId format
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Validate activityId format (MongoDB ObjectId)
    if (!activityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID format",
      });
    }

    // Validate subactivityId format (MongoDB ObjectId)
    if (!subactivityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subactivity ID format",
      });
    }

    // First, verify the project exists and belongs to the logged-in user
    const project = await Project.findOne({
      _id: projectId,
      programPersonnel: req.user.id
    }).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Check if activities array exists and has items
    if (!project.activities || !Array.isArray(project.activities) || project.activities.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No activities found in this project",
      });
    }

    // Find the activity
    const activity = project.activities.find(
      (act) => act._id && act._id.toString() === activityId
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Check if subActivities array exists and has items
    if (!activity.subActivities || !Array.isArray(activity.subActivities) || activity.subActivities.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No subactivities found in this activity",
      });
    }

    // Verify the subactivity exists
    const subactivityExists = activity.subActivities.some(
      (subAct) => subAct._id && subAct._id.toString() === subactivityId
    );

    if (!subactivityExists) {
      return res.status(404).json({
        success: false,
        message: "Subactivity not found",
      });
    }

    // Use findByIdAndUpdate with $pull to remove the subactivity from the activity's subActivities array
    // Use runValidators: false to avoid validation errors on encrypted fields
    const mongoose = require("mongoose");
    const result = await Project.findByIdAndUpdate(
      projectId,
      {
        $pull: { 
          "activities.$[activity].subActivities": { _id: new mongoose.Types.ObjectId(subactivityId) }
        }
      },
      {
        arrayFilters: [{ "activity._id": new mongoose.Types.ObjectId(activityId) }],
        runValidators: false,
        new: false
      }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update",
      });
    }

    // Fetch the updated project to recalculate expenses
    // Use lean() to avoid Mongoose casting issues with encrypted fields
    const updatedProject = await Project.findById(projectId).lean();

    if (!updatedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found after deletion",
      });
    }

    // Recalculate expenses: activity expenses from sub-activities, then totalExpense from activities
    // Need to decrypt expenses to calculate, then encrypt the result
    const { decrypt, encrypt } = require("../utils/encryption");
    
    let totalExpense = 0;
    const updates = {};

    if (updatedProject.activities && Array.isArray(updatedProject.activities)) {
      updatedProject.activities.forEach((activity, activityIndex) => {
        // Calculate activity expense from sub-activities
        let activityExpense = 0;
        if (activity.subActivities && Array.isArray(activity.subActivities)) {
          activity.subActivities.forEach(subActivity => {
            if (subActivity.expense !== undefined && subActivity.expense !== null) {
              let subExpense = 0;
              if (typeof subActivity.expense === 'string' && subActivity.expense.includes(':')) {
                subExpense = parseFloat(decrypt(subActivity.expense)) || 0;
              } else if (typeof subActivity.expense === 'number') {
                subExpense = subActivity.expense;
              }
              activityExpense += subExpense;
            }
          });
        }
        
        // Encrypt the calculated activity expense
        const encryptedActivityExpense = encrypt(activityExpense.toString());
        updates[`activities.${activityIndex}.expense`] = encryptedActivityExpense;
        
        totalExpense += activityExpense;
      });
    }

    // Encrypt the totalExpense value
    const encryptedTotalExpense = encrypt(totalExpense.toString());
    updates.totalExpense = encryptedTotalExpense;

    // Update activity expenses and totalExpense using MongoDB native collection method
    // This bypasses Mongoose casting which would fail on encrypted string values
    await Project.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(projectId) },
      { $set: updates }
    );

    // Check utilization and send notifications (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      const projectForCheck = await Project.findById(projectId).lean();
      if (projectForCheck) {
        checkProjectItemsUtilization(projectForCheck).catch(err => {
          console.error("Error checking utilization:", err);
        });
      }
    } catch (error) {
      console.error("Error setting up utilization check:", error);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      message: "Subactivity deleted successfully",
    });
  } catch (error) {
    console.error("Delete subactivity error:", error);
    
    // Handle validation errors from mongoose
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }

  await logActivity({
    user: req.user,
    action: "SUBACTIVITY_DELETED",
    entityType: "subactivity",
    entityId: subactivityId,
    metadata: { projectId, activityId },
  });

};

// ==================== REALLOCATION REQUEST FUNCTIONS ====================

const createReallocationRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      requestType,
      sourceProjectId,
      destinationProjectId,
      sourceActivityId,
      destinationActivityId,
      sourceSubactivityId,
      destinationSubactivityId,
      projectId,
      amount,
      reason,
    } = req.body;

    // Validate required fields
    if (!requestType || !amount || !reason) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Please provide requestType, amount, and reason",
      });
    }

    // Validate requestType
    const validRequestTypes = ["project_to_project", "activity_to_activity", "subactivity_to_subactivity"];
    if (!validRequestTypes.includes(requestType)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `requestType must be one of: ${validRequestTypes.join(", ")}`,
      });
    }

    // Validate amount
    const reallocationAmount = parseFloat(amount);
    if (isNaN(reallocationAmount) || reallocationAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    const { decrypt } = require("../utils/encryption");
    let sourceCurrency, destinationCurrency;
    let sourceProject, destinationProject;
    let projectForActivity;

    // Handle project-to-project reallocation
    if (requestType === "project_to_project") {
      if (!sourceProjectId || !destinationProjectId) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "sourceProjectId and destinationProjectId are required for project-to-project reallocation",
        });
      }

      // Validate ObjectIds
      if (!sourceProjectId.match(/^[0-9a-fA-F]{24}$/) || !destinationProjectId.match(/^[0-9a-fA-F]{24}$/)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      // Get source project (must belong to requesting user)
      sourceProject = await Project.findOne({
        _id: sourceProjectId,
        programPersonnel: req.user.id,
      }).lean();

      if (!sourceProject) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Source project not found or you do not have access",
        });
      }

      // Get destination project
      destinationProject = await Project.findById(destinationProjectId).lean();

      if (!destinationProject) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Destination project not found",
        });
      }

      // Decrypt currencies
      sourceCurrency = sourceProject.currency && typeof sourceProject.currency === 'string' && sourceProject.currency.includes(':')
        ? decrypt(sourceProject.currency)
        : sourceProject.currency;

      destinationCurrency = destinationProject.currency && typeof destinationProject.currency === 'string' && destinationProject.currency.includes(':')
        ? decrypt(destinationProject.currency)
        : destinationProject.currency;

      // Decrypt amountDonated to check balance
      let sourceAmountDonated = 0;
      if (sourceProject.amountDonated) {
        if (typeof sourceProject.amountDonated === 'string' && sourceProject.amountDonated.includes(':')) {
          sourceAmountDonated = parseFloat(decrypt(sourceProject.amountDonated)) || 0;
        } else {
          sourceAmountDonated = parseFloat(sourceProject.amountDonated) || 0;
        }
      }

      // Check if source has sufficient balance
      if (sourceAmountDonated < reallocationAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source project has ${sourceAmountDonated} ${sourceCurrency}, but trying to reallocate ${reallocationAmount} ${sourceCurrency}`,
        });
      }
    }

    // Handle activity-to-activity reallocation
    if (requestType === "activity_to_activity") {
      if (!sourceActivityId || !destinationActivityId || !projectId) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "sourceActivityId, destinationActivityId, and projectId are required for activity-to-activity reallocation",
        });
      }

      // Validate projectId
      if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      // Get project (must belong to requesting user)
      projectForActivity = await Project.findOne({
        _id: projectId,
        programPersonnel: req.user.id,
      }).lean();

      if (!projectForActivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Project not found or you do not have access",
        });
      }

      // Decrypt currency
      sourceCurrency = projectForActivity.currency && typeof projectForActivity.currency === 'string' && projectForActivity.currency.includes(':')
        ? decrypt(projectForActivity.currency)
        : projectForActivity.currency;
      destinationCurrency = sourceCurrency; // Same project, same currency

      // Find source and destination activities
      const sourceActivity = projectForActivity.activities?.find(
        (act) => act._id?.toString() === sourceActivityId || act.activityId === sourceActivityId
      );
      const destinationActivity = projectForActivity.activities?.find(
        (act) => act._id?.toString() === destinationActivityId || act.activityId === destinationActivityId
      );

      if (!sourceActivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Source activity not found",
        });
      }

      if (!destinationActivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Destination activity not found",
        });
      }

      // Validate both activities are in the same project
      if (sourceActivity._id.toString() === destinationActivity._id.toString()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Source and destination activities cannot be the same",
        });
      }

      // Decrypt source activity budget
      let sourceBudget = 0;
      if (sourceActivity.budget !== undefined && sourceActivity.budget !== null) {
        if (typeof sourceActivity.budget === 'string' && sourceActivity.budget.includes(':')) {
          sourceBudget = parseFloat(decrypt(sourceActivity.budget)) || 0;
        } else {
          sourceBudget = parseFloat(sourceActivity.budget) || 0;
        }
      }

      // Check if source has sufficient balance
      if (sourceBudget < reallocationAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source activity has ${sourceBudget} ${sourceCurrency}, but trying to reallocate ${reallocationAmount} ${sourceCurrency}`,
        });
      }
    }

    // Handle subactivity-to-subactivity reallocation
    if (requestType === "subactivity_to_subactivity") {
      if (!sourceSubactivityId || !destinationSubactivityId || !sourceActivityId || !destinationActivityId || !projectId) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "sourceSubactivityId, destinationSubactivityId, sourceActivityId, destinationActivityId, and projectId are required for subactivity-to-subactivity reallocation",
        });
      }

      // Validate projectId
      if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      // Get project (must belong to requesting user)
      projectForActivity = await Project.findOne({
        _id: projectId,
        programPersonnel: req.user.id,
      }).lean();

      if (!projectForActivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Project not found or you do not have access",
        });
      }

      // Decrypt currency
      sourceCurrency = projectForActivity.currency && typeof projectForActivity.currency === 'string' && projectForActivity.currency.includes(':')
        ? decrypt(projectForActivity.currency)
        : projectForActivity.currency;
      destinationCurrency = sourceCurrency; // Same project, same currency

      // Find source and destination activities
      const sourceActivity = projectForActivity.activities?.find(
        (act) => act._id?.toString() === sourceActivityId || act.activityId === sourceActivityId
      );
      const destinationActivity = projectForActivity.activities?.find(
        (act) => act._id?.toString() === destinationActivityId || act.activityId === destinationActivityId
      );

      if (!sourceActivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Source activity not found",
        });
      }

      if (!destinationActivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Destination activity not found",
        });
      }

      // Validate both subactivities are in the same activity
      if (sourceActivity._id.toString() !== destinationActivity._id.toString()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Both subactivities must be in the same activity",
        });
      }

      // Find source and destination subactivities
      const sourceSubactivity = sourceActivity.subActivities?.find(
        (subAct) => subAct._id?.toString() === sourceSubactivityId || subAct.subactivityId === sourceSubactivityId
      );
      const destinationSubactivity = destinationActivity.subActivities?.find(
        (subAct) => subAct._id?.toString() === destinationSubactivityId || subAct.subactivityId === destinationSubactivityId
      );

      if (!sourceSubactivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Source subactivity not found",
        });
      }

      if (!destinationSubactivity) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Destination subactivity not found",
        });
      }

      // Validate source and destination are different
      if (sourceSubactivity._id.toString() === destinationSubactivity._id.toString()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Source and destination subactivities cannot be the same",
        });
      }

      // Decrypt source subactivity budget
      let sourceBudget = 0;
      if (sourceSubactivity.budget !== undefined && sourceSubactivity.budget !== null) {
        if (typeof sourceSubactivity.budget === 'string' && sourceSubactivity.budget.includes(':')) {
          sourceBudget = parseFloat(decrypt(sourceSubactivity.budget)) || 0;
        } else {
          sourceBudget = parseFloat(sourceSubactivity.budget) || 0;
        }
      }

      // Check if source has sufficient balance
      if (sourceBudget < reallocationAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source subactivity has ${sourceBudget} ${sourceCurrency}, but trying to reallocate ${reallocationAmount} ${sourceCurrency}`,
        });
      }
    }

    // Create reallocation request
    const requestData = {
      requestedBy: req.user.id,
      requestType,
      amount: reallocationAmount,
      sourceCurrency,
      destinationCurrency,
      reason: reason.trim(),
      status: "pending",
    };

    if (requestType === "project_to_project") {
      requestData.sourceProjectId = sourceProjectId;
      requestData.destinationProjectId = destinationProjectId;
    } else {
      requestData.projectId = projectId;
      requestData.sourceActivityId = sourceActivityId;
      requestData.destinationActivityId = destinationActivityId;
      if (requestType === "subactivity_to_subactivity") {
        requestData.sourceSubactivityId = sourceSubactivityId;
        requestData.destinationSubactivityId = destinationSubactivityId;
      }
    }

    const reallocationRequest = await ReallocationRequest.create([requestData], { session });

    await session.commitTransaction();


    res.status(201).json({
      success: true,
      message: "Reallocation request created successfully",
      data: {
        ...reallocationRequest[0].toObject(),
        requiresExchangeRate: sourceCurrency !== destinationCurrency,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Create reallocation request error:", error);

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
  } finally {
    session.endSession();
  }

};

const getAllReallocationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const query = { requestedBy: req.user.id };
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    const requests = await ReallocationRequest.find(query)
      .populate("requestedBy", "name email")
      .populate("sourceProjectId", "projectId title")
      .populate("destinationProjectId", "projectId title")
      .populate("projectId", "projectId title")
      .populate("approvedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("Get all reallocation requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getReallocationRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    const request = await ReallocationRequest.findOne({
      _id: id,
      requestedBy: req.user.id,
    })
      .populate("requestedBy", "name email")
      .populate("sourceProjectId", "projectId title")
      .populate("destinationProjectId", "projectId title")
      .populate("projectId", "projectId title")
      .populate("approvedBy", "name email");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Reallocation request not found or you do not have access",
      });
    }

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Get reallocation request by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getDashboardData = async (req, res) => {
  try {
    const { decrypt } = require("../utils/encryption");

    // Fetch Statistics for logged-in program user
    const totalProjects = await Project.countDocuments({
      programPersonnel: req.user.id,
    });
    const totalReallocations = await ReallocationRequest.countDocuments({
      requestedBy: req.user.id,
    });

    // Get all projects created by this user to calculate underspent/overspent
    const allProjects = await Project.find({
      programPersonnel: req.user.id,
    })
      .select("amountDonated totalExpense")
      .lean();

    let underspentProjects = 0;
    let overspentProjects = 0;

    allProjects.forEach((project) => {
      let amountDonated = project.amountDonated;
      let totalExpense = project.totalExpense;

      // Decrypt if encrypted
      if (amountDonated && typeof amountDonated === "string" && amountDonated.includes(":")) {
        amountDonated = parseFloat(decrypt(amountDonated)) || 0;
      }
      if (totalExpense && typeof totalExpense === "string" && totalExpense.includes(":")) {
        totalExpense = parseFloat(decrypt(totalExpense)) || 0;
      }

      // Ensure they are numbers
      amountDonated = typeof amountDonated === "number" ? amountDonated : parseFloat(amountDonated) || 0;
      totalExpense = typeof totalExpense === "number" ? totalExpense : parseFloat(totalExpense) || 0;

      if (totalExpense < amountDonated) {
        underspentProjects++;
      } else if (totalExpense > amountDonated) {
        overspentProjects++;
      }
    });

    // Reallocation Status Distribution (for this user's requests)
    const reallocationStatuses = ["pending", "approved", "rejected"];
    const reallocationStatusRaw = await ReallocationRequest.aggregate([
      {
        $match: { requestedBy: new mongoose.Types.ObjectId(req.user.id) },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const reallocationStatusDistribution = reallocationStatuses.reduce((acc, status) => {
      acc[status] =
        reallocationStatusRaw.find((item) => item._id === status)?.count || 0;
      return acc;
    }, {});

    // Project Status Distribution (for this user's projects)
    const projectStatuses = ["Not Started", "In Progress", "Completed"];
    const projectStatusRaw = await Project.aggregate([
      {
        $match: { programPersonnel: new mongoose.Types.ObjectId(req.user.id) },
      },
      {
        $group: {
          _id: "$projectStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const projectStatusDistribution = projectStatuses.reduce((acc, status) => {
      acc[status] =
        projectStatusRaw.find((item) => item._id === status)?.count || 0;
      return acc;
    }, {});

    // Fetch recent 5 projects created by this user
    const recentProjects = await Project.find({
      programPersonnel: req.user.id,
    })
      .select("projectId title projectStatus createdAt")
      .populate("financePersonnel", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Decrypt project fields
    const decryptedRecentProjects = recentProjects.map((project) => {
      const p = { ...project };
      if (p.title && typeof p.title === "string" && p.title.includes(":")) {
        p.title = decrypt(p.title);
      }
      return p;
    });

    // Fetch recent 5 reallocation requests made by this user
    const recentReallocations = await ReallocationRequest.find({
      requestedBy: req.user.id,
    })
      .select("requestType status amount sourceCurrency destinationCurrency createdAt")
      .populate("sourceProjectId", "projectId title")
      .populate("destinationProjectId", "projectId title")
      .populate("projectId", "projectId title")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Decrypt project titles in reallocation requests
    const decryptedRecentReallocations = recentReallocations.map((request) => {
      const r = { ...request };
      if (r.sourceProjectId && r.sourceProjectId.title && typeof r.sourceProjectId.title === "string" && r.sourceProjectId.title.includes(":")) {
        r.sourceProjectId.title = decrypt(r.sourceProjectId.title);
      }
      if (r.destinationProjectId && r.destinationProjectId.title && typeof r.destinationProjectId.title === "string" && r.destinationProjectId.title.includes(":")) {
        r.destinationProjectId.title = decrypt(r.destinationProjectId.title);
      }
      if (r.projectId && r.projectId.title && typeof r.projectId.title === "string" && r.projectId.title.includes(":")) {
        r.projectId.title = decrypt(r.projectId.title);
      }
      return r;
    });

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
      recentProjects: decryptedRecentProjects,
      recentReallocations: decryptedRecentReallocations,
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

module.exports = {
  createProject,
  getFinancePersonnel,
  getAllProjects,
  getProjectById,
  getActivityById,
  updateProject,
  deleteProject,
  deleteActivity,
  deleteSubActivity,
  createReallocationRequest,
  getAllReallocationRequests,
  getReallocationRequestById,
  getDashboardData,
};