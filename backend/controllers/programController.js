const Project = require("../models/projectModel");
const User = require("../models/userModel");

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
    .select("projectId title startDate endDate financePersonnel amountDonated currency")
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

module.exports = {
  createProject,
  getFinancePersonnel,
  getAllProjects,
  getProjectById,
};

