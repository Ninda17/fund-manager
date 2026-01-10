const { Project, User, ReallocationRequest, Activity, SubActivity, ProjectDocument } = require("../models");
const { Op } = require("sequelize");
const logActivity = require("../utils/logActivity");
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
  
  // Decrypt activity fields
  if (activity.name) {
    activity.name = decryptField(activity.name);
  }
  if (activity.description) {
    activity.description = decryptField(activity.description);
  }
  if (activity.budget) {
    activity.budget = decryptField(activity.budget, 'number');
  }
  if (activity.expense) {
    activity.expense = decryptField(activity.expense, 'number');
  }
  
  // Decrypt subactivities if present
  if (activity.subActivities && Array.isArray(activity.subActivities)) {
    activity.subActivities.forEach(subActivity => {
      if (subActivity.name) {
        subActivity.name = decryptField(subActivity.name);
      }
      if (subActivity.budget) {
        subActivity.budget = decryptField(subActivity.budget, 'number');
      }
      if (subActivity.expense) {
        subActivity.expense = decryptField(subActivity.expense, 'number');
      }
    });
  }
  
  return activity;
};

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
      documents,
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
    const existingProject = await Project.findOne({ where: { projectId } });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "Project with this projectId already exists",
      });
    }

    // Validate financePersonnel is a valid integer ID
    const financePersonnelId = parseInt(financePersonnel);
    if (isNaN(financePersonnelId) || financePersonnelId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid financePersonnel ID format",
      });
    }

    // Verify financePersonnel exists and has role "finance"
    const financeUser = await User.findByPk(financePersonnelId);
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
    const validProjectTypes = ["Social Development Program", "Economic Development Program", "Environmental and Climate Change Program", "Research Advocacy and Network Program"];
    const selectedProjectType = projectType || "Social Development Program";
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
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        
        // Filter out empty activities (activities with no data)
        if (!activity.activityId && !activity.name && (!activity.budget || activity.budget === 0)) {
          continue; // Skip empty activities
        }
        
        // If activity has any data, it must have activityId and name
        if (!activity.activityId || !activity.name || !activity.activityId.trim() || !activity.name.trim()) {
          return res.status(400).json({
            success: false,
            message: `Activity ${i + 1} must have both activityId and name`,
          });
        }

        // Validate subActivities if provided
        if (activity.subActivities && Array.isArray(activity.subActivities)) {
          for (let j = 0; j < activity.subActivities.length; j++) {
            const subActivity = activity.subActivities[j];
            
            // Filter out empty subactivities
            if (!subActivity.subactivityId && !subActivity.name && (!subActivity.budget || subActivity.budget === 0)) {
              continue; // Skip empty subactivities
            }
            
            // If subactivity has any data, it must have subactivityId and name
            if (!subActivity.subactivityId || !subActivity.name || !subActivity.subactivityId.trim() || !subActivity.name.trim()) {
              return res.status(400).json({
                success: false,
                message: `Sub-activity ${j + 1} in Activity ${i + 1} must have both subactivityId and name`,
              });
            }

            // Validate budget if provided
            if (subActivity.budget !== undefined && subActivity.budget !== null) {
              const budget = parseFloat(subActivity.budget);
              if (isNaN(budget) || budget < 0) {
                return res.status(400).json({
                  success: false,
                  message: `Sub-activity ${j + 1} in Activity ${i + 1} budget must be a non-negative number`,
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
              message: `Activity ${i + 1} budget must be a non-negative number`,
            });
          }
        }
      }
    }

    // Create project
    // Note: amountDonated, startDate, and endDate will be encrypted by beforeCreate hook
    // programPersonnelId is set from the authenticated user
    // Convert Date objects to ISO strings for encryption (stored as TEXT)
    const project = await Project.create({
      programPersonnelId: req.user.id, // Set from authenticated user
      projectId,
      title,
      description: description || "",
      startDate: start.toISOString(), // Convert Date to ISO string for encryption
      endDate: end.toISOString(), // Convert Date to ISO string for encryption
      financePersonnelId: financePersonnelId,
      donorName,
      amountDonated: amount.toString(), // Will be encrypted by beforeCreate hook
      currency: selectedCurrency,
      projectType: selectedProjectType,
    });

    // Create activities and subactivities separately (not nested arrays)
    if (activities && Array.isArray(activities)) {
      for (const activityData of activities) {
        // Filter out empty activities
        if (!activityData.activityId && !activityData.name && (!activityData.budget || activityData.budget === 0)) {
          continue;
        }

        // Only create activity if it has required fields (activityId and name)
        if (!activityData.activityId || !activityData.name) {
          continue; // Skip activities without required fields
        }

        const activity = await Activity.create({
          projectId: project.id,
          activityId: activityData.activityId.trim(),
          name: activityData.name.trim(),
          description: activityData.description ? activityData.description.trim() : null,
          budget: activityData.budget ? activityData.budget.toString() : "0",
          projectStatus: activityData.projectStatus || project.projectStatus || "Not Started",
        });

        // Create subactivities
        if (activityData.subActivities && Array.isArray(activityData.subActivities)) {
          for (const subActivityData of activityData.subActivities) {
            // Filter out empty subactivities
            if (!subActivityData.subactivityId && !subActivityData.name && (!subActivityData.budget || subActivityData.budget === 0)) {
              continue;
            }

            // Only create subactivity if it has required fields
            if (!subActivityData.subactivityId || !subActivityData.name) {
              continue; // Skip subactivities without required fields
            }

            await SubActivity.create({
              activityId: activity.id,
              subactivityId: subActivityData.subactivityId.trim(),
              name: subActivityData.name.trim(),
              budget: subActivityData.budget ? subActivityData.budget.toString() : "0",
              expense: subActivityData.expense ? subActivityData.expense.toString() : "0",
            });
          }
        }
      }
    }

    // Create project documents separately
    if (documents && Array.isArray(documents)) {
      for (const documentUrl of documents) {
        if (documentUrl && documentUrl.trim()) {
          await ProjectDocument.create({
            projectId: project.id,
            documentUrl: documentUrl.trim(),
          });
        }
      }
    }

    await logActivity({
      user: req.user,
      action: "PROJECT_CREATED",
      entityType: "project",
      entityId: project.id,
    });

    // Fetch project with all relationships for response
    const projectWithRelations = await Project.findByPk(project.id, {
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

    // Project fields are already decrypted by model hooks
    const projectData = projectWithRelations.toJSON();
    
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

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: projectData,
    });
  } catch (error) {
    console.error("Create project error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      errors: error.errors,
      stack: error.stack,
    });

    // Handle validation errors from Sequelize
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors ? error.errors.map((err) => err.message) : [error.message];
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle duplicate key error (projectId)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Project with this projectId already exists",
      });
    }

    // Handle database errors
    if (error.name === "SequelizeDatabaseError") {
      return res.status(400).json({
        success: false,
        message: error.message || "Database error occurred",
      });
    }

    // Handle custom validation errors from pre-save hooks
    if (error.message && (
        error.message.includes("Financial personnel") || 
        error.message.includes("Program personnel") ||
        error.message.includes("End date") ||
        error.message.includes("budget") ||
        error.message.includes("expense")
      )) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getFinancePersonnel = async (req, res) => {
  try {
    // Get all finance users who are verified and approved
    const financeUsers = await User.findAll({
      where: {
        role: "finance",
        isEmailVerified: true,
        isApproved: "approved"
      },
      attributes: { exclude: ['password'] },
      order: [['name', 'ASC']],
    });

    res.status(200).json({
      success: true,
      count: financeUsers.length,
      data: financeUsers,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getAllProjects = async (req, res) => {
  try {
    // Get all projects created by the logged-in user (programPersonnelId)
    const projects = await Project.findAll({
      where: {
        programPersonnelId: req.user.id
      },
      attributes: ["id", "projectId", "title", "startDate", "endDate", "financePersonnelId", "amountDonated", "currency", "totalExpense", "projectStatus", "createdAt"],
      include: [
        {
          model: User,
          as: "financePersonnel",
          attributes: ["name", "email"],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Projects are already decrypted by model hooks
    const projectsData = projects.map((project) => project.toJSON());

    res.status(200).json({
      success: true,
      count: projectsData.length,
      data: projectsData,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id format - integer ID
    const projectIdInt = parseInt(id);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Get project by ID, ensuring it belongs to the logged-in user
    const project = await Project.findOne({
      where: {
        id: projectIdInt,
        programPersonnelId: req.user.id
      },
      attributes: {
        include: ["financePersonnelId", "programPersonnelId"], // Explicitly include foreign keys
      },
      include: [
        {
          model: User,
          as: "financePersonnel",
          attributes: ["id", "name", "email"], // Include id for frontend compatibility
        },
        {
          model: User,
          as: "programPersonnel",
          attributes: ["id", "name", "email"], // Include id for frontend compatibility
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
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
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
        // If doc is an object with documentUrl property, extract it
        if (doc && typeof doc === 'object' && doc.documentUrl) {
          return doc.documentUrl;
        }
        // If doc is already a string, return as-is
        if (typeof doc === 'string') {
          return doc;
        }
        // Fallback: try to get documentUrl if it exists
        return doc?.documentUrl || doc;
      }).filter(url => url); // Remove any null/undefined values
    } else if (!projectData.documents) {
      // Ensure documents is always an array
      projectData.documents = [];
    }

    res.status(200).json({
      success: true,
      data: projectData,
    });
  } catch (error) {
    console.error("Get project by ID error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


const getActivityById = async (req, res) => {
  try {
    const { projectId, activityId } = req.params;

    // Validate projectId format - integer ID
    const projectIdInt = parseInt(projectId);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Verify project belongs to the logged-in user
    const project = await Project.findOne({
      where: {
        id: projectIdInt,
        programPersonnelId: req.user.id
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Find activity - can be by ID (integer) or activityId (string)
    let activity = null;
    
    // Strategy 1: Search by integer ID
    const activityIdInt = parseInt(activityId);
    if (!isNaN(activityIdInt) && activityIdInt > 0) {
      activity = await Activity.findOne({
        where: {
          id: activityIdInt,
          projectId: projectIdInt,
        },
        include: [
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
        where: {
          activityId: activityId,
          projectId: projectIdInt,
        },
        include: [
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
    
    // Get project basic info for context
    const projectInfo = {
      id: project.id,
      projectId: project.projectId,
      title: project.title,
      currency: project.currency, // Already decrypted by hooks
    };

    res.status(200).json({
      success: true,
      data: {
        activity: activityData,
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

    // Validate id format - integer ID
    const projectIdInt = parseInt(id);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Find project by ID, ensuring it belongs to the logged-in user
    const existingProject = await Project.findOne({
      where: {
        id: projectIdInt,
        programPersonnelId: req.user.id
      },
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // If projectId is being updated, check for duplicates (excluding current project)
    if (projectId && projectId !== existingProject.projectId) {
      const duplicateProject = await Project.findOne({ 
        where: {
          projectId,
          id: { [Op.ne]: projectIdInt } // Exclude current project
        }
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
      updateObj.startDate = start.toISOString(); // Convert Date to ISO string for encryption
    }

    if (endDate !== undefined) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid endDate format",
        });
      }
      updateObj.endDate = end.toISOString(); // Convert Date to ISO string for encryption
    }

    // Validate date range if both dates are provided
    // Get dates for validation (need to handle both new dates and existing encrypted dates)
    let finalStartDate, finalEndDate;
    if (updateObj.startDate) {
      finalStartDate = new Date(updateObj.startDate);
    } else {
      // Existing date is already decrypted by hooks, so it's a Date object
      finalStartDate = existingProject.startDate instanceof Date 
        ? existingProject.startDate 
        : new Date(existingProject.startDate);
    }
    
    if (updateObj.endDate) {
      finalEndDate = new Date(updateObj.endDate);
    } else {
      // Existing date is already decrypted by hooks, so it's a Date object
      finalEndDate = existingProject.endDate instanceof Date 
        ? existingProject.endDate 
        : new Date(existingProject.endDate);
    }
    
    if (finalStartDate && finalEndDate) {
      if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }
      
      if (finalEndDate < finalStartDate) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    // Update financePersonnel if provided
    if (financePersonnel !== undefined) {
      const financePersonnelIdInt = parseInt(financePersonnel);
      if (isNaN(financePersonnelIdInt) || financePersonnelIdInt <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid financePersonnel ID format",
        });
      }

      // Verify financePersonnel exists and has role "finance"
      const financeUser = await User.findByPk(financePersonnelIdInt);
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

      updateObj.financePersonnelId = financePersonnelIdInt;
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
      const validProjectTypes = ["Social Development Program", "Economic Development Program", "Environmental and Climate Change Program", "Research Advocacy and Network Program"];
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

    // Update project fields
    await existingProject.update(updateObj);

    // Update documents if provided (delete existing and create new)
    if (req.body.documents !== undefined) {
      if (!Array.isArray(req.body.documents)) {
        return res.status(400).json({
          success: false,
          message: "Documents must be an array",
        });
      }

      // Delete existing documents
      await ProjectDocument.destroy({
        where: { projectId: projectIdInt }
      });

      // Create new documents
      if (req.body.documents.length > 0) {
        for (const documentUrl of req.body.documents) {
          if (documentUrl && typeof documentUrl === 'string' && documentUrl.trim()) {
            await ProjectDocument.create({
              projectId: projectIdInt,
              documentUrl: documentUrl.trim(),
            });
          }
        }
      }
    }

    // Update activities if provided (delete existing and create new)
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

      // Delete existing activities (CASCADE will delete subactivities)
      await Activity.destroy({
        where: { projectId: projectIdInt }
      });

      // Create new activities and subactivities
      for (const activityData of activities) {
        // Filter out empty activities
        if (!activityData.activityId && !activityData.name && (!activityData.budget || activityData.budget === 0)) {
          continue;
        }

        const activity = await Activity.create({
          projectId: projectIdInt,
          activityId: activityData.activityId,
          name: activityData.name || "",
          description: activityData.description || "",
          budget: activityData.budget ? activityData.budget.toString() : "0",
          projectStatus: activityData.projectStatus || existingProject.projectStatus,
        });

        // Create subactivities
        if (activityData.subActivities && Array.isArray(activityData.subActivities)) {
          for (const subActivityData of activityData.subActivities) {
            // Filter out empty subactivities
            if (!subActivityData.subactivityId && !subActivityData.name && (!subActivityData.budget || subActivityData.budget === 0)) {
              continue;
            }

            await SubActivity.create({
              activityId: activity.id,
              subactivityId: subActivityData.subactivityId,
              name: subActivityData.name || "",
              budget: subActivityData.budget ? subActivityData.budget.toString() : "0",
              expense: subActivityData.expense ? subActivityData.expense.toString() : "0",
            });
          }
        }
      }
    }

    // Fetch the updated project with all relationships
    const savedProject = await Project.findByPk(projectIdInt, {
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

    // Check utilization and send notifications (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      // Get project with activities for utilization check
      const projectForCheck = await Project.findByPk(projectIdInt, {
        include: [
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
        ],
      });
      if (projectForCheck) {
        // Run in background - don't wait for it
        checkProjectItemsUtilization(projectForCheck.toJSON()).catch(err => {
          console.error("Error checking utilization:", err);
        });
      }
    } catch (error) {
      console.error("Error setting up utilization check:", error);
      // Don't fail the request if notification fails
    }

    await logActivity({
      user: req.user,
      action: "PROJECT_UPDATED",
      entityType: "project",
      entityId: projectIdInt,
    });

    // Project fields are already decrypted by model hooks
    const savedProjectData = savedProject.toJSON();
    
    // Manually decrypt nested activities and subactivities (hooks may not run for nested includes)
    if (savedProjectData.activities && Array.isArray(savedProjectData.activities)) {
      savedProjectData.activities.forEach(activity => {
        decryptActivityData(activity);
      });
    }
    
    // Transform documents array: Sequelize returns objects, but frontend expects array of URL strings
    if (savedProjectData.documents && Array.isArray(savedProjectData.documents)) {
      savedProjectData.documents = savedProjectData.documents.map(doc => {
        if (doc && typeof doc === 'object' && doc.documentUrl) {
          return doc.documentUrl;
        }
        if (typeof doc === 'string') {
          return doc;
        }
        return doc?.documentUrl || doc;
      }).filter(url => url);
    } else if (!savedProjectData.documents) {
      savedProjectData.documents = [];
    }

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: savedProjectData,
    });
  } catch (error) {
    console.error("Update project error:", error);

    // Handle validation errors from Sequelize
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    // Handle duplicate key error (projectId)
    if (error.name === "SequelizeUniqueConstraintError") {
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

    // Validate id format - integer ID
    const projectIdInt = parseInt(id);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Find project by ID, ensuring it belongs to the logged-in user
    const project = await Project.findOne({
      where: {
        id: projectIdInt,
        programPersonnelId: req.user.id
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Delete the project (CASCADE will delete activities, subactivities, and documents)
    await project.destroy();

    await logActivity({
      user: req.user,
      action: "PROJECT_DELETED",
      entityType: "project",
      entityId: projectIdInt,
    });

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

    // Validate projectId format - integer ID
    const projectIdInt = parseInt(projectId);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // First, verify the project exists and belongs to the logged-in user
    const project = await Project.findOne({
      where: {
        id: projectIdInt,
        programPersonnelId: req.user.id
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Find activity - can be by ID (integer) or activityId (string)
    let activity = null;
    const activityIdInt = parseInt(activityId);
    if (!isNaN(activityIdInt) && activityIdInt > 0) {
      activity = await Activity.findOne({
        where: {
          id: activityIdInt,
          projectId: projectIdInt,
        },
      });
    }
    
    if (!activity) {
      activity = await Activity.findOne({
        where: {
          activityId: activityId,
          projectId: projectIdInt,
        },
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Delete the activity (CASCADE will delete subactivities)
    await activity.destroy();

    // Recalculate project totalExpense from remaining activities
    // This is handled by the project model hooks, but we need to trigger a save
    const updatedProject = await Project.findByPk(projectIdInt, {
      include: [
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
      ],
    });

    if (updatedProject) {
      // Trigger recalculation by saving (hooks will recalculate totalExpense)
      await updatedProject.save();
    }

    // Check utilization and send notifications (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      if (updatedProject) {
        checkProjectItemsUtilization(updatedProject.toJSON()).catch(err => {
          console.error("Error checking utilization:", err);
        });
      }
    } catch (error) {
      console.error("Error setting up utilization check:", error);
      // Don't fail the request if notification fails
    }

    await logActivity({
      user: req.user,
      action: "ACTIVITY_DELETED",
      entityType: "activity",
      entityId: activity.id || activityId,
      metadata: { projectId: projectIdInt },
    });

    res.status(200).json({
      success: true,
      message: "Activity deleted successfully",
    });
  } catch (error) {
    console.error("Delete activity error:", error);
    
    // Handle validation errors from Sequelize
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err) => err.message);
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

    // Validate projectId format - integer ID
    const projectIdInt = parseInt(projectId);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // First, verify the project exists and belongs to the logged-in user
    const project = await Project.findOne({
      where: {
        id: projectIdInt,
        programPersonnelId: req.user.id
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Find activity - can be by ID (integer) or activityId (string)
    let activity = null;
    const activityIdInt = parseInt(activityId);
    if (!isNaN(activityIdInt) && activityIdInt > 0) {
      activity = await Activity.findOne({
        where: {
          id: activityIdInt,
          projectId: projectIdInt,
        },
      });
    }
    
    if (!activity) {
      activity = await Activity.findOne({
        where: {
          activityId: activityId,
          projectId: projectIdInt,
        },
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Find subactivity - can be by ID (integer) or subactivityId (string)
    let subactivity = null;
    const subactivityIdInt = parseInt(subactivityId);
    if (!isNaN(subactivityIdInt) && subactivityIdInt > 0) {
      subactivity = await SubActivity.findOne({
        where: {
          id: subactivityIdInt,
          activityId: activity.id,
        },
      });
    }
    
    if (!subactivity) {
      subactivity = await SubActivity.findOne({
        where: {
          subactivityId: subactivityId,
          activityId: activity.id,
        },
      });
    }

    if (!subactivity) {
      return res.status(404).json({
        success: false,
        message: "Subactivity not found",
      });
    }

    // Delete the subactivity
    await subactivity.destroy();

    // Recalculate activity expense and project totalExpense
    // This is handled by hooks, but we need to trigger saves
    const updatedActivity = await Activity.findByPk(activity.id, {
      include: [
        {
          model: SubActivity,
          as: "subActivities",
        },
      ],
    });

    if (updatedActivity) {
      // Trigger recalculation by saving (hooks will recalculate activity expense)
      await updatedActivity.save();
    }

    // Recalculate project totalExpense
    const updatedProject = await Project.findByPk(projectIdInt, {
      include: [
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
      ],
    });

    if (updatedProject) {
      // Trigger recalculation by saving (hooks will recalculate totalExpense)
      await updatedProject.save();
    }

    // Check utilization and send notifications (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      if (updatedProject) {
        checkProjectItemsUtilization(updatedProject.toJSON()).catch(err => {
          console.error("Error checking utilization:", err);
        });
      }
    } catch (error) {
      console.error("Error setting up utilization check:", error);
      // Don't fail the request if notification fails
    }

    await logActivity({
      user: req.user,
      action: "SUBACTIVITY_DELETED",
      entityType: "subactivity",
      entityId: subactivity.id || subactivityId,
      metadata: { projectId: projectIdInt, activityId: activity.id },
    });

    res.status(200).json({
      success: true,
      message: "Subactivity deleted successfully",
    });
  } catch (error) {
    console.error("Delete subactivity error:", error);
    
    // Handle validation errors from Sequelize
    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map((err) => err.message);
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
  const { sequelize } = require("../models");
  const transaction = await sequelize.transaction();

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
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Please provide requestType, amount, and reason",
      });
    }

    // Validate requestType
    const validRequestTypes = ["project_to_project", "activity_to_activity", "subactivity_to_subactivity"];
    if (!validRequestTypes.includes(requestType)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `requestType must be one of: ${validRequestTypes.join(", ")}`,
      });
    }

    // Validate amount
    const reallocationAmount = parseFloat(amount);
    if (isNaN(reallocationAmount) || reallocationAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    // Fields are already decrypted by model hooks
    let sourceCurrency, destinationCurrency;
    let sourceProject, destinationProject;
    let projectForActivity;

    // Handle project-to-project reallocation
    if (requestType === "project_to_project") {
      if (!sourceProjectId || !destinationProjectId) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "sourceProjectId and destinationProjectId are required for project-to-project reallocation",
        });
      }

      // Validate integer IDs
      const sourceProjectIdInt = parseInt(sourceProjectId);
      const destinationProjectIdInt = parseInt(destinationProjectId);
      if (isNaN(sourceProjectIdInt) || sourceProjectIdInt <= 0 || isNaN(destinationProjectIdInt) || destinationProjectIdInt <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      // Get source project (must belong to requesting user)
      sourceProject = await Project.findOne({
        where: {
          id: sourceProjectIdInt,
          programPersonnelId: req.user.id,
        },
        transaction,
      });

      if (!sourceProject) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Source project not found or you do not have access",
        });
      }

      // Get destination project
      destinationProject = await Project.findByPk(destinationProjectIdInt, { transaction });

      if (!destinationProject) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Destination project not found",
        });
      }

      // Fields are already decrypted by model hooks
      sourceCurrency = sourceProject.currency;
      destinationCurrency = destinationProject.currency;

      // Get amountDonated (already decrypted by hooks)
      const sourceAmountDonated = parseFloat(sourceProject.amountDonated) || 0;

      // Check if source has sufficient balance
      if (sourceAmountDonated < reallocationAmount) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source project has ${sourceAmountDonated} ${sourceCurrency}, but trying to reallocate ${reallocationAmount} ${sourceCurrency}`,
        });
      }
    }

    // Handle activity-to-activity reallocation
    if (requestType === "activity_to_activity") {
      if (!sourceActivityId || !destinationActivityId || !projectId) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "sourceActivityId, destinationActivityId, and projectId are required for activity-to-activity reallocation",
        });
      }

      // Validate projectId - integer ID
      const projectIdInt = parseInt(projectId);
      if (isNaN(projectIdInt) || projectIdInt <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      // Get project (must belong to requesting user)
      projectForActivity = await Project.findOne({
        where: {
          id: projectIdInt,
          programPersonnelId: req.user.id,
        },
        transaction,
      });

      if (!projectForActivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project not found or you do not have access",
        });
      }

      // Currency is already decrypted by hooks
      sourceCurrency = projectForActivity.currency;
      destinationCurrency = sourceCurrency; // Same project, same currency

      // Find source and destination activities from Activity table
      let sourceActivity = null;
      let destinationActivity = null;
      
      const sourceActivityIdInt = parseInt(sourceActivityId);
      if (!isNaN(sourceActivityIdInt) && sourceActivityIdInt > 0) {
        sourceActivity = await Activity.findOne({
          where: {
            id: sourceActivityIdInt,
            projectId: projectIdInt,
          },
          transaction,
        });
      }
      if (!sourceActivity) {
        sourceActivity = await Activity.findOne({
          where: {
            activityId: sourceActivityId,
            projectId: projectIdInt,
          },
          transaction,
        });
      }

      const destinationActivityIdInt = parseInt(destinationActivityId);
      if (!isNaN(destinationActivityIdInt) && destinationActivityIdInt > 0) {
        destinationActivity = await Activity.findOne({
          where: {
            id: destinationActivityIdInt,
            projectId: projectIdInt,
          },
          transaction,
        });
      }
      if (!destinationActivity) {
        destinationActivity = await Activity.findOne({
          where: {
            activityId: destinationActivityId,
            projectId: projectIdInt,
          },
          transaction,
        });
      }

      if (!sourceActivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Source activity not found",
        });
      }

      if (!destinationActivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Destination activity not found",
        });
      }

      // Validate both activities are different
      if (sourceActivity.id === destinationActivity.id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Source and destination activities cannot be the same",
        });
      }

      // Get source activity budget (already decrypted by hooks)
      const sourceBudget = parseFloat(sourceActivity.budget) || 0;

      // Check if source has sufficient balance
      if (sourceBudget < reallocationAmount) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source activity has ${sourceBudget} ${sourceCurrency}, but trying to reallocate ${reallocationAmount} ${sourceCurrency}`,
        });
      }
    }

    // Handle subactivity-to-subactivity reallocation
    if (requestType === "subactivity_to_subactivity") {
      if (!sourceSubactivityId || !destinationSubactivityId || !sourceActivityId || !destinationActivityId || !projectId) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "sourceSubactivityId, destinationSubactivityId, sourceActivityId, destinationActivityId, and projectId are required for subactivity-to-subactivity reallocation",
        });
      }

      // Validate projectId - integer ID
      const projectIdInt = parseInt(projectId);
      if (isNaN(projectIdInt) || projectIdInt <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      // Get project (must belong to requesting user)
      projectForActivity = await Project.findOne({
        where: {
          id: projectIdInt,
          programPersonnelId: req.user.id,
        },
        transaction,
      });

      if (!projectForActivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project not found or you do not have access",
        });
      }

      // Currency is already decrypted by hooks
      sourceCurrency = projectForActivity.currency;
      destinationCurrency = sourceCurrency; // Same project, same currency

      // Find source and destination activities from Activity table
      let sourceActivity = null;
      let destinationActivity = null;
      
      const sourceActivityIdInt = parseInt(sourceActivityId);
      if (!isNaN(sourceActivityIdInt) && sourceActivityIdInt > 0) {
        sourceActivity = await Activity.findOne({
          where: {
            id: sourceActivityIdInt,
            projectId: projectIdInt,
          },
          transaction,
        });
      }
      if (!sourceActivity) {
        sourceActivity = await Activity.findOne({
          where: {
            activityId: sourceActivityId,
            projectId: projectIdInt,
          },
          transaction,
        });
      }

      const destinationActivityIdInt = parseInt(destinationActivityId);
      if (!isNaN(destinationActivityIdInt) && destinationActivityIdInt > 0) {
        destinationActivity = await Activity.findOne({
          where: {
            id: destinationActivityIdInt,
            projectId: projectIdInt,
          },
          transaction,
        });
      }
      if (!destinationActivity) {
        destinationActivity = await Activity.findOne({
          where: {
            activityId: destinationActivityId,
            projectId: projectIdInt,
          },
          transaction,
        });
      }

      if (!sourceActivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Source activity not found",
        });
      }

      if (!destinationActivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Destination activity not found",
        });
      }

      // Validate both subactivities are in the same activity
      if (sourceActivity.id !== destinationActivity.id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Both subactivities must be in the same activity",
        });
      }

      // Find source and destination subactivities from SubActivity table
      let sourceSubactivity = null;
      let destinationSubactivity = null;
      
      const sourceSubactivityIdInt = parseInt(sourceSubactivityId);
      if (!isNaN(sourceSubactivityIdInt) && sourceSubactivityIdInt > 0) {
        sourceSubactivity = await SubActivity.findOne({
          where: {
            id: sourceSubactivityIdInt,
            activityId: sourceActivity.id,
          },
          transaction,
        });
      }
      if (!sourceSubactivity) {
        sourceSubactivity = await SubActivity.findOne({
          where: {
            subactivityId: sourceSubactivityId,
            activityId: sourceActivity.id,
          },
          transaction,
        });
      }

      const destinationSubactivityIdInt = parseInt(destinationSubactivityId);
      if (!isNaN(destinationSubactivityIdInt) && destinationSubactivityIdInt > 0) {
        destinationSubactivity = await SubActivity.findOne({
          where: {
            id: destinationSubactivityIdInt,
            activityId: destinationActivity.id,
          },
          transaction,
        });
      }
      if (!destinationSubactivity) {
        destinationSubactivity = await SubActivity.findOne({
          where: {
            subactivityId: destinationSubactivityId,
            activityId: destinationActivity.id,
          },
          transaction,
        });
      }

      if (!sourceSubactivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Source subactivity not found",
        });
      }

      if (!destinationSubactivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Destination subactivity not found",
        });
      }

      // Validate source and destination are different
      if (sourceSubactivity.id === destinationSubactivity.id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Source and destination subactivities cannot be the same",
        });
      }

      // Get source subactivity budget (already decrypted by hooks)
      const sourceBudget = parseFloat(sourceSubactivity.budget) || 0;

      // Check if source has sufficient balance
      if (sourceBudget < reallocationAmount) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source subactivity has ${sourceBudget} ${sourceCurrency}, but trying to reallocate ${reallocationAmount} ${sourceCurrency}`,
        });
      }
    }

    // Create reallocation request
    const requestData = {
      requestedById: req.user.id,
      requestType,
      amount: reallocationAmount,
      sourceCurrency,
      destinationCurrency,
      reason: reason.trim(),
      status: "pending",
    };

    if (requestType === "project_to_project") {
      requestData.sourceProjectId = parseInt(sourceProjectId);
      requestData.destinationProjectId = parseInt(destinationProjectId);
    } else {
      requestData.projectId = parseInt(projectId);
      requestData.sourceActivityId = sourceActivityId; // Can be string or integer
      requestData.destinationActivityId = destinationActivityId; // Can be string or integer
      if (requestType === "subactivity_to_subactivity") {
        requestData.sourceSubactivityId = sourceSubactivityId; // Can be string or integer
        requestData.destinationSubactivityId = destinationSubactivityId; // Can be string or integer
      }
    }

    const reallocationRequest = await ReallocationRequest.create(requestData, { transaction });

    await transaction.commit();

    await logActivity({
      user: req.user,
      action: "REALLOCATION_CREATED",
      entityType: "reallocation",
      entityId: reallocationRequest.id,
    });

    res.status(201).json({
      success: true,
      message: "Reallocation request created successfully",
      data: {
        ...reallocationRequest.toJSON(),
        requiresExchangeRate: sourceCurrency !== destinationCurrency,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Create reallocation request error:", error);

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

const getAllReallocationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const where = { requestedById: req.user.id };
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }

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

    // Validate id format - integer ID
    const requestIdInt = parseInt(id);
    if (isNaN(requestIdInt) || requestIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    const request = await ReallocationRequest.findOne({
      where: {
        id: requestIdInt,
        requestedById: req.user.id,
      },
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
        message: "Reallocation request not found or you do not have access",
      });
    }

    res.status(200).json({
      success: true,
      data: request.toJSON(),
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
    // Fetch Statistics for logged-in program user
    const totalProjects = await Project.count({
      where: {
        programPersonnelId: req.user.id,
      },
    });
    const totalReallocations = await ReallocationRequest.count({
      where: {
        requestedById: req.user.id,
      },
    });

    // Get all projects created by this user to calculate underspent/overspent
    const allProjects = await Project.findAll({
      where: {
        programPersonnelId: req.user.id,
      },
      attributes: ["amountDonated", "totalExpense"],
    });

    let underspentProjects = 0;
    let overspentProjects = 0;

    allProjects.forEach((project) => {
      // Fields are already decrypted by model hooks
      const amountDonated = parseFloat(project.amountDonated) || 0;
      const totalExpense = parseFloat(project.totalExpense) || 0;

      if (totalExpense < amountDonated) {
        underspentProjects++;
      } else if (totalExpense > amountDonated) {
        overspentProjects++;
      }
    });

    // Reallocation Status Distribution (for this user's requests)
    const reallocationStatuses = ["pending", "approved", "rejected"];
    const reallocationStatusDistribution = {};
    
    for (const status of reallocationStatuses) {
      const count = await ReallocationRequest.count({
        where: {
          requestedById: req.user.id,
          status,
        },
      });
      reallocationStatusDistribution[status] = count;
    }

    // Project Status Distribution (for this user's projects)
    const projectStatuses = ["Not Started", "In Progress", "Completed"];
    const projectStatusDistribution = {};
    
    for (const status of projectStatuses) {
      const count = await Project.count({
        where: {
          programPersonnelId: req.user.id,
          projectStatus: status,
        },
      });
      projectStatusDistribution[status] = count;
    }

    // Fetch recent 5 projects created by this user
    const recentProjects = await Project.findAll({
      where: {
        programPersonnelId: req.user.id,
      },
      attributes: ["id", "projectId", "title", "projectStatus", "createdAt"],
      include: [
        {
          model: User,
          as: "financePersonnel",
          attributes: ["name", "email"],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    // Projects are already decrypted by model hooks
    const recentProjectsData = recentProjects.map((project) => project.toJSON());

    // Fetch recent 5 reallocation requests made by this user
    const recentReallocations = await ReallocationRequest.findAll({
      where: {
        requestedById: req.user.id,
      },
      attributes: ["id", "requestType", "status", "amount", "sourceCurrency", "destinationCurrency", "createdAt"],
      include: [
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
      ],
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    // Reallocation requests are already decrypted by model hooks
    const recentReallocationsData = recentReallocations.map((request) => request.toJSON());

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
      recentReallocations: recentReallocationsData,
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

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a document",
      });
    }

    const { uploadToCloudinary } = require("../middleware/uploadDocumentMiddleware");
    
    // Upload to Cloudinary
    const documentUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    
    if (!documentUrl) {
      console.error("No document URL returned from Cloudinary");
      return res.status(500).json({
        success: false,
        message: "Failed to get document URL from storage",
      });
    }
    
    res.status(200).json({
      success: true,
      documentUrl: documentUrl,
      message: "Document uploaded successfully",
    });
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload document. Please try again.",
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
  uploadDocument,
};