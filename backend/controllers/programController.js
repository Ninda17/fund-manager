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

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      startDate,
      endDate,
      financePersonnel,
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

    // Import encryption utilities
    const { encrypt, decrypt } = require("../utils/encryption");

    // Build update object - only non-financial fields allowed
    const updateObj = {};

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
      // Description can be empty, but if provided, encrypt it
      updateObj.description = description.trim() ? encrypt(description.trim()) : "";
    }

    // Update startDate if provided
    if (startDate !== undefined) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate format",
        });
      }
      // Encrypt the date
      updateObj.startDate = encrypt(start.toISOString());
    }

    // Update endDate if provided
    if (endDate !== undefined) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid endDate format",
        });
      }
      // Encrypt the date
      updateObj.endDate = encrypt(end.toISOString());
    }

    // Validate that endDate is after startDate if both are being updated
    if (updateObj.startDate && updateObj.endDate) {
      const start = new Date(decrypt(updateObj.startDate));
      const end = new Date(decrypt(updateObj.endDate));
      if (end < start) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    } else if (updateObj.startDate && existingProject.endDate) {
      // If only startDate is being updated, check against existing endDate
      const start = new Date(decrypt(updateObj.startDate));
      const rawEndDate = existingProject.endDate;
      const end = typeof rawEndDate === 'string' && rawEndDate.includes(':')
        ? new Date(decrypt(rawEndDate))
        : new Date(rawEndDate);
      if (end < start) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    } else if (updateObj.endDate && existingProject.startDate) {
      // If only endDate is being updated, check against existing startDate
      const rawStartDate = existingProject.startDate;
      const start = typeof rawStartDate === 'string' && rawStartDate.includes(':')
        ? new Date(decrypt(rawStartDate))
        : new Date(rawStartDate);
      const end = new Date(decrypt(updateObj.endDate));
      if (end < start) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    // Update financePersonnel if provided
    if (financePersonnel !== undefined) {
      // Validate financePersonnel is a valid ObjectId
      if (!financePersonnel.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: "Invalid financePersonnel ID format",
        });
      }

      // Verify financePersonnel exists and has role "finance"
      const User = require("../models/userModel");
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

      if (!financeUser.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Finance personnel must have a verified email address",
        });
      }

      if (financeUser.isApproved !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Finance personnel must be approved",
        });
      }

      updateObj.financePersonnel = financePersonnel;
    }

    // Update projectType if provided
    if (projectType !== undefined) {
      const validProjectTypes = ["Education", "Welfare", "Youth", "other"];
      if (!validProjectTypes.includes(projectType)) {
        return res.status(400).json({
          success: false,
          message: `Project type must be one of: ${validProjectTypes.join(", ")}`,
        });
      }
      // Encrypt projectType
      updateObj.projectType = encrypt(projectType);
    }

    // Update projectStatus if provided
    if (projectStatus !== undefined) {
      const validProjectStatuses = ["Not Started", "In Progress", "Completed"];
      if (!validProjectStatuses.includes(projectStatus)) {
        return res.status(400).json({
          success: false,
          message: `Project status must be one of: ${validProjectStatuses.join(", ")}`,
        });
      }
      updateObj.projectStatus = projectStatus;
    }

    // Handle activities updates separately using MongoDB native collection methods
    // This avoids Mongoose casting issues with encrypted fields
    const activityUpdates = {};
    
    if (activities !== undefined) {
      if (!Array.isArray(activities)) {
        return res.status(400).json({
          success: false,
          message: "Activities must be an array",
        });
      }

      // Get existing activities to preserve financial fields
      const existingActivities = existingProject.activities || [];
      
      // Build updates for activities using MongoDB native collection method
      existingActivities.forEach((existingActivity, activityIndex) => {
        // Find matching activity from request by activityId or _id
        const activityUpdate = activities.find(
          act => (act._id && act._id.toString() === existingActivity._id?.toString()) ||
                  act.activityId === existingActivity.activityId
        );

        if (!activityUpdate) {
          // No update for this activity
          return;
        }

        // Update activity name if provided
        if (activityUpdate.name !== undefined && activityUpdate.name !== null) {
          if (!activityUpdate.name.trim()) {
            throw new Error("Activity name cannot be empty");
          }
          activityUpdates[`activities.${activityIndex}.name`] = encrypt(activityUpdate.name.trim());
        }

        // Update activity description if provided
        if (activityUpdate.description !== undefined) {
          // Description can be empty
          activityUpdates[`activities.${activityIndex}.description`] = activityUpdate.description.trim() 
            ? encrypt(activityUpdate.description.trim())
            : "";
        }

        // Update activityId if provided
        if (activityUpdate.activityId !== undefined && activityUpdate.activityId !== null) {
          activityUpdates[`activities.${activityIndex}.activityId`] = activityUpdate.activityId;
        }

        // Update activity projectStatus if provided
        if (activityUpdate.projectStatus !== undefined) {
          const validStatuses = ["Not Started", "In Progress", "Completed"];
          if (!validStatuses.includes(activityUpdate.projectStatus)) {
            throw new Error(`Activity status must be one of: ${validStatuses.join(", ")}`);
          }
          activityUpdates[`activities.${activityIndex}.projectStatus`] = activityUpdate.projectStatus;
        }

        // Update subActivities non-financial fields if provided
        if (activityUpdate.subActivities && Array.isArray(activityUpdate.subActivities)) {
          const existingSubActivities = existingActivity.subActivities || [];
          
          existingSubActivities.forEach((existingSubActivity, subIndex) => {
            // Find matching subactivity from request by _id or subactivityId
            const subActivityUpdate = activityUpdate.subActivities.find(
              subAct => (subAct._id && subAct._id.toString() === existingSubActivity._id?.toString()) ||
                         subAct.subactivityId === existingSubActivity.subactivityId
            );

            if (!subActivityUpdate) {
              // No update for this subactivity
              return;
            }

            // Update subactivity name if provided
            if (subActivityUpdate.name !== undefined && subActivityUpdate.name !== null) {
              if (!subActivityUpdate.name.trim()) {
                throw new Error("Sub-activity name cannot be empty");
              }
              activityUpdates[`activities.${activityIndex}.subActivities.${subIndex}.name`] = encrypt(subActivityUpdate.name.trim());
            }

            // Update subactivityId if provided
            if (subActivityUpdate.subactivityId !== undefined && subActivityUpdate.subactivityId !== null) {
              activityUpdates[`activities.${activityIndex}.subActivities.${subIndex}.subactivityId`] = subActivityUpdate.subactivityId;
            }
          });
        }
      });
    }

    // Use MongoDB native collection method to update top-level fields
    if (Object.keys(updateObj).length > 0) {
      await Project.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: updateObj }
      );
    }

    // Use MongoDB native collection method to update activities
    if (Object.keys(activityUpdates).length > 0) {
      await Project.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: activityUpdates }
      );
    }

    // Fetch the updated project using lean to avoid casting issues
    const savedProject = await Project.findById(id)
      .populate("financePersonnel", "name email")
      .populate("programPersonnel", "name email")
      .lean();

    if (!savedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update",
      });
    }

    // Decrypt fields for response
    const decrypted = { ...savedProject };
    
    // Decrypt description
    if (decrypted.description && typeof decrypted.description === 'string' && decrypted.description !== '' && decrypted.description.includes(':')) {
      decrypted.description = decrypt(decrypted.description);
    }
    
    // Decrypt startDate
    if (decrypted.startDate && typeof decrypted.startDate === 'string' && decrypted.startDate.includes(':')) {
      decrypted.startDate = new Date(decrypt(decrypted.startDate));
    }
    
    // Decrypt endDate
    if (decrypted.endDate && typeof decrypted.endDate === 'string' && decrypted.endDate.includes(':')) {
      decrypted.endDate = new Date(decrypt(decrypted.endDate));
    }
    
    // Decrypt projectType
    if (decrypted.projectType && typeof decrypted.projectType === 'string' && decrypted.projectType.includes(':')) {
      decrypted.projectType = decrypt(decrypted.projectType);
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
        
        // Decrypt activity budget (for display, but not editable)
        if (decryptedActivity.budget && typeof decryptedActivity.budget === 'string' && decryptedActivity.budget.includes(':')) {
          decryptedActivity.budget = parseFloat(decrypt(decryptedActivity.budget)) || 0;
        }
        
        // Decrypt activity expense (for display, but not editable)
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
            
            // Decrypt sub activity budget (for display, but not editable)
            if (decryptedSubActivity.budget && typeof decryptedSubActivity.budget === 'string' && decryptedSubActivity.budget.includes(':')) {
              decryptedSubActivity.budget = parseFloat(decrypt(decryptedSubActivity.budget)) || 0;
            }
            
            // Decrypt sub activity expense (for display, but not editable)
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
      message: "Project updated successfully",
      data: decrypted,
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

    // Handle custom error messages
    if (error.message.includes("name") || error.message.includes("status") || error.message.includes("date")) {
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

module.exports = {
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
};

