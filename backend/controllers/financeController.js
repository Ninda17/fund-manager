const { Project, ReallocationRequest, Activity, SubActivity, ProjectDocument, User, sequelize } = require("../models");
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

const getAllReallocationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // Finance can see requests for projects they are assigned to
    const userId = req.user.id;

    // Get projects assigned to finance user
    const projectsAssignedToFinance = await Project.findAll({
      where: { financePersonnelId: userId },
      attributes: ['id'],
    });

    const projectIds = projectsAssignedToFinance.map((p) => p.id);

    const where = {
      [Op.or]: [
        { sourceProjectId: { [Op.in]: projectIds } },
        { destinationProjectId: { [Op.in]: projectIds } },
        { projectId: { [Op.in]: projectIds } },
      ],
    };

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

    // Validate integer ID format
    const requestIdInt = parseInt(id);
    if (isNaN(requestIdInt) || requestIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    // Finance can only view requests for projects they are assigned to
    const userId = req.user.id;

    // Get projects assigned to finance user
    const projectsAssignedToFinance = await Project.findAll({
      where: { financePersonnelId: userId },
      attributes: ['id'],
    });

    const projectIds = projectsAssignedToFinance.map((p) => p.id);

    const request = await ReallocationRequest.findOne({
      where: {
        id: requestIdInt,
        [Op.or]: [
          { sourceProjectId: { [Op.in]: projectIds } },
          { destinationProjectId: { [Op.in]: projectIds } },
          { projectId: { [Op.in]: projectIds } },
        ],
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

    const requestData = request.toJSON();

    res.status(200).json({
      success: true,
      data: requestData,
    });
  } catch (error) {
    console.error("Get reallocation request by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const approveReallocationRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { exchangeRate, exchangeRateDate, exchangeRateSource } = req.body;

    // Validate integer ID format
    const requestIdInt = parseInt(id);
    if (isNaN(requestIdInt) || requestIdInt <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    // Check if evidence image was uploaded
    if (!req.file) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Evidence image is required for approval",
      });
    }

    // Get the request
    const userId = req.user.id;

    // Get projects assigned to finance user
    const projectsAssignedToFinance = await Project.findAll({
      where: { financePersonnelId: userId },
      attributes: ['id'],
      transaction,
    });

    const projectIds = projectsAssignedToFinance.map((p) => p.id);

    const request = await ReallocationRequest.findOne({
      where: {
        id: requestIdInt,
        status: "pending",
        [Op.or]: [
          { sourceProjectId: { [Op.in]: projectIds } },
          { destinationProjectId: { [Op.in]: projectIds } },
          { projectId: { [Op.in]: projectIds } },
        ],
      },
      transaction,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Pending reallocation request not found or you do not have access",
      });
    }

    // Handle currency conversion
    const currenciesDiffer = request.sourceCurrency !== request.destinationCurrency;
    let exchangeRateValue = 1;
    let convertedAmount = parseFloat(request.amount);

    if (currenciesDiffer) {
      // Exchange rate is required for different currencies
      if (!exchangeRate || isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Exchange rate is required and must be a positive number when currencies differ",
        });
      }

      exchangeRateValue = parseFloat(exchangeRate);
      convertedAmount = parseFloat(request.amount) * exchangeRateValue;
    } else if (exchangeRate) {
      // If same currency but exchange rate provided, use it (should be 1)
      exchangeRateValue = parseFloat(exchangeRate);
      convertedAmount = parseFloat(request.amount) * exchangeRateValue;
    }

    // Execute reallocation based on request type
    if (request.requestType === "project_to_project") {
      // Get source and destination projects
      const sourceProject = await Project.findByPk(request.sourceProjectId, { transaction });
      const destinationProject = await Project.findByPk(request.destinationProjectId, { transaction });

      if (!sourceProject || !destinationProject) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Source or destination project not found",
        });
      }

      // Fields are already decrypted by model hooks
      const sourceAmountDonated = parseFloat(sourceProject.amountDonated) || 0;

      // Validate sufficient balance
      if (sourceAmountDonated < parseFloat(request.amount)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source project has ${sourceAmountDonated} ${request.sourceCurrency}`,
        });
      }

      const destinationAmountDonated = parseFloat(destinationProject.amountDonated) || 0;

      // Calculate new amounts
      const newSourceAmount = sourceAmountDonated - parseFloat(request.amount);
      const newDestinationAmount = destinationAmountDonated + convertedAmount;

      // Update projects (encryption handled by model hooks)
      await sourceProject.update(
        { amountDonated: newSourceAmount.toString() },
        { transaction }
      );

      await destinationProject.update(
        { amountDonated: newDestinationAmount.toString() },
        { transaction }
      );

    } else if (request.requestType === "activity_to_activity") {
      // Get project
      const project = await Project.findByPk(request.projectId, {
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
        transaction,
      });

      if (!project) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      const projectData = project.toJSON();
      
      // Manually decrypt nested activities
      if (projectData.activities && Array.isArray(projectData.activities)) {
        projectData.activities.forEach(activity => {
          decryptActivityData(activity);
        });
      }

      // Find source and destination activities
      const sourceActivity = projectData.activities.find(
        (act) => (act.id || act._id)?.toString() === request.sourceActivityId?.toString() || act.activityId === request.sourceActivityId
      );
      const destinationActivity = projectData.activities.find(
        (act) => (act.id || act._id)?.toString() === request.destinationActivityId?.toString() || act.activityId === request.destinationActivityId
      );

      if (!sourceActivity || !destinationActivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Source or destination activity not found",
        });
      }

      // Get source activity budget (already decrypted)
      const sourceBudget = parseFloat(sourceActivity.budget) || 0;

      // Validate sufficient balance
      if (sourceBudget < parseFloat(request.amount)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source activity has ${sourceBudget} ${request.sourceCurrency}`,
        });
      }

      const destinationBudget = parseFloat(destinationActivity.budget) || 0;

      // Calculate new budgets
      const newSourceBudget = sourceBudget - parseFloat(request.amount);
      const newDestinationBudget = destinationBudget + convertedAmount;

      // Update activities (encryption handled by model hooks)
      const sourceActivityModel = await Activity.findByPk(sourceActivity.id, { transaction });
      const destinationActivityModel = await Activity.findByPk(destinationActivity.id, { transaction });

      if (sourceActivityModel) {
        await sourceActivityModel.update(
          { budget: newSourceBudget.toString() },
          { transaction }
        );
      }

      if (destinationActivityModel) {
        await destinationActivityModel.update(
          { budget: newDestinationBudget.toString() },
          { transaction }
        );
      }

      // Recalculate project totalExpense (handled by SubActivity hooks, but we need to trigger it)
      // The hooks will automatically recalculate when subactivities change
      // For now, manually recalculate totalExpense
      const updatedProject = await Project.findByPk(request.projectId, {
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
        transaction,
      });

      if (updatedProject) {
        const projectDataUpdated = updatedProject.toJSON();
        let totalExpense = 0;

        if (projectDataUpdated.activities && Array.isArray(projectDataUpdated.activities)) {
          projectDataUpdated.activities.forEach(activity => {
            decryptActivityData(activity);
            totalExpense += parseFloat(activity.expense) || 0;
          });
        }

        await updatedProject.update(
          { totalExpense: totalExpense.toString() },
          { transaction }
        );
      }

    } else if (request.requestType === "subactivity_to_subactivity") {
      // Get project
      const project = await Project.findByPk(request.projectId, {
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
        transaction,
      });

      if (!project) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      const projectData = project.toJSON();
      
      // Manually decrypt nested activities
      if (projectData.activities && Array.isArray(projectData.activities)) {
        projectData.activities.forEach(activity => {
          decryptActivityData(activity);
        });
      }

      // Find activity containing both subactivities
      const activity = projectData.activities.find(
        (act) => (act.id || act._id)?.toString() === request.sourceActivityId?.toString() || act.activityId === request.sourceActivityId
      );

      if (!activity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Activity not found",
        });
      }

      // Find source and destination subactivities
      const sourceSubactivity = activity.subActivities?.find(
        (subAct) => (subAct.id || subAct._id)?.toString() === request.sourceSubactivityId?.toString() || subAct.subactivityId === request.sourceSubactivityId
      );
      const destinationSubactivity = activity.subActivities?.find(
        (subAct) => (subAct.id || subAct._id)?.toString() === request.destinationSubactivityId?.toString() || subAct.subactivityId === request.destinationSubactivityId
      );

      if (!sourceSubactivity || !destinationSubactivity) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Source or destination subactivity not found",
        });
      }

      // Get source subactivity budget (already decrypted)
      const sourceBudget = parseFloat(sourceSubactivity.budget) || 0;

      // Validate sufficient balance
      if (sourceBudget < parseFloat(request.amount)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source subactivity has ${sourceBudget} ${request.sourceCurrency}`,
        });
      }

      const destinationBudget = parseFloat(destinationSubactivity.budget) || 0;

      // Calculate new budgets
      const newSourceBudget = sourceBudget - parseFloat(request.amount);
      const newDestinationBudget = destinationBudget + convertedAmount;

      // Update subactivities (encryption handled by model hooks)
      const sourceSubactivityModel = await SubActivity.findByPk(sourceSubactivity.id, { transaction });
      const destinationSubactivityModel = await SubActivity.findByPk(destinationSubactivity.id, { transaction });

      if (sourceSubactivityModel) {
        await sourceSubactivityModel.update(
          { budget: newSourceBudget.toString() },
          { transaction }
        );
      }

      if (destinationSubactivityModel) {
        await destinationSubactivityModel.update(
          { budget: newDestinationBudget.toString() },
          { transaction }
        );
      }

      // Expense recalculation is handled automatically by SubActivity hooks
    }

    // Update request status
    // Cloudinary returns the URL in req.file.secure_url or req.file.url
    const evidenceImageUrl = req.file.secure_url || req.file.url;
    
    await request.update({
      status: "approved",
      approvedById: req.user.id,
      approvedAt: new Date(),
      evidenceImageUrl: evidenceImageUrl,
      exchangeRate: exchangeRateValue,
      convertedAmount: convertedAmount,
      exchangeRateDate: exchangeRateDate ? new Date(exchangeRateDate) : new Date(),
      exchangeRateSource: exchangeRateSource || (currenciesDiffer ? "manual" : null),
    }, { transaction });

    await transaction.commit();

    await logActivity({
      user: req.user,
      action: "REALLOCATION_APPROVED",
      entityType: "reallocation",
      entityId: request.id,
      description: `Reallocation approved by finance`,
    });

    // Check utilization and send notifications for affected projects (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      
      // Check source project if it exists
      if (request.sourceProjectId) {
        const sourceProject = await Project.findByPk(request.sourceProjectId);
        if (sourceProject) {
          const sourceProjectData = sourceProject.toJSON();
          checkProjectItemsUtilization(sourceProjectData).catch(err => {
            console.error("Error checking source project utilization:", err);
          });
        }
      }
      
      // Check destination project if it exists
      if (request.destinationProjectId) {
        const destProject = await Project.findByPk(request.destinationProjectId);
        if (destProject) {
          const destProjectData = destProject.toJSON();
          checkProjectItemsUtilization(destProjectData).catch(err => {
            console.error("Error checking destination project utilization:", err);
          });
        }
      }
      
      // Check project for activity/subactivity reallocations
      if (request.projectId) {
        const project = await Project.findByPk(request.projectId);
        if (project) {
          const projectData = project.toJSON();
          checkProjectItemsUtilization(projectData).catch(err => {
            console.error("Error checking project utilization:", err);
          });
        }
      }
    } catch (error) {
      console.error("Error setting up utilization check after reallocation:", error);
      // Don't fail the request if notification fails
    }

    // Fetch request with populated data for response
    const updatedRequest = await ReallocationRequest.findByPk(request.id, {
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

    res.status(200).json({
      success: true,
      message: "Reallocation request approved and executed successfully",
      data: updatedRequest.toJSON(),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Approve reallocation request error:", error);

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

const rejectReallocationRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    // Validate integer ID format
    const requestIdInt = parseInt(id);
    if (isNaN(requestIdInt) || requestIdInt <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    // Get the request
    const userId = req.user.id;

    // Get projects assigned to finance user
    const projectsAssignedToFinance = await Project.findAll({
      where: { financePersonnelId: userId },
      attributes: ['id'],
      transaction,
    });

    const projectIds = projectsAssignedToFinance.map((p) => p.id);

    const request = await ReallocationRequest.findOne({
      where: {
        id: requestIdInt,
        status: "pending",
        [Op.or]: [
          { sourceProjectId: { [Op.in]: projectIds } },
          { destinationProjectId: { [Op.in]: projectIds } },
          { projectId: { [Op.in]: projectIds } },
        ],
      },
      transaction,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Pending reallocation request not found or you do not have access",
      });
    }

    // Update request status
    await request.update({
      status: "rejected",
      approvedById: req.user.id, // Using approvedById to track who rejected
      approvedAt: new Date(),
      rejectionReason: rejectionReason.trim(),
    }, { transaction });

    await transaction.commit();

    await logActivity({
      user: req.user,
      action: "REALLOCATION_REJECTED",
      entityType: "reallocation",
      entityId: request.id,
      description: `Reallocation rejected: ${rejectionReason}`,
    });

    // Fetch request with populated data for response
    const updatedRequest = await ReallocationRequest.findByPk(request.id, {
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

    res.status(200).json({
      success: true,
      message: "Reallocation request rejected successfully",
      data: updatedRequest.toJSON(),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Reject reallocation request error:", error);

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

const getAllProjects = async (req, res) => {
  try {
    // Get all projects assigned to the logged-in finance user
    const userId = req.user.id;

    const projects = await Project.findAll({
      where: { financePersonnelId: userId },
      attributes: ["id", "projectId", "title", "startDate", "endDate", "financePersonnelId", "amountDonated", "currency", "totalExpense", "projectStatus"],
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

    res.status(200).json({
      success: true,
      count: projectsData.length,
      data: projectsData,
    });
  } catch (error) {
    console.error("Get all projects error:", error);
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
    const projectIdInt = parseInt(id);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Get project by ID, ensuring it's assigned to the logged-in finance user
    const userId = req.user.id;

    const project = await Project.findOne({
      where: {
        id: projectIdInt,
        financePersonnelId: userId,
      },
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
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
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
      projectData.documents = projectData.documents
        .map(doc => (typeof doc === 'object' && doc !== null ? doc.documentUrl : doc))
        .filter(url => url); // Filter out any null/undefined URLs
    } else {
      projectData.documents = []; // Ensure it's always an array
    }

    res.status(200).json({
      success: true,
      data: projectData,
    });
  } catch (error) {
    console.error("Get project by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
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

    // Get project by ID, ensuring it's assigned to the logged-in finance user
    const userId = req.user.id;

    const project = await Project.findOne({
      where: {
        id: projectIdInt,
        financePersonnelId: userId,
      },
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

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    const projectData = project.toJSON();

    // Manually decrypt nested activities
    if (projectData.activities && Array.isArray(projectData.activities)) {
      projectData.activities.forEach(activity => {
        decryptActivityData(activity);
      });
    }

    // Find the activity - can be by integer ID or activityId string
    let activity = null;
    if (projectData.activities && Array.isArray(projectData.activities)) {
      const activityIdInt = parseInt(activityId);
      if (!isNaN(activityIdInt) && activityIdInt > 0) {
        activity = projectData.activities.find(
          (act) => act.id === activityIdInt || act.activityId === activityId
        );
      } else {
        activity = projectData.activities.find(
          (act) => act.activityId === activityId
        );
      }
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Activity is already decrypted by decryptActivityData above
    const activityData = activity;

    // Extract project info (already decrypted by hooks)
    const projectInfo = {
      id: projectData.id,
      projectId: projectData.projectId,
      title: projectData.title,
      currency: projectData.currency,
    };

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

const updateProject = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      donorName,
      amountDonated,
      currency,
      totalExpense,
      activities,
    } = req.body;

    // Validate integer ID format
    const projectIdInt = parseInt(id);
    if (isNaN(projectIdInt) || projectIdInt <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Find project by ID, ensuring it belongs to the logged-in finance user
    const userId = req.user.id;

    const existingProject = await Project.findOne({
      where: {
        id: projectIdInt,
        financePersonnelId: userId,
      },
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
      transaction,
    });

    if (!existingProject) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Build update object - only financial fields allowed
    const updateObj = {};

    // Update donorName if provided
    if (donorName !== undefined) {
      if (!donorName || !donorName.trim()) {
        await transaction.rollback();
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
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Amount donated must be a non-negative number",
        });
      }
      updateObj.amountDonated = amount.toString(); // Will be encrypted by model hooks
    }

    // Update currency if provided
    if (currency !== undefined) {
      const validCurrencies = ["USD", "EUR", "BTN"];
      if (!validCurrencies.includes(currency)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Currency must be one of: ${validCurrencies.join(", ")}`,
        });
      }
      updateObj.currency = currency;
    }

    // Update totalExpense if provided (only valid when project has no activities)
    if (totalExpense !== undefined) {
      const expense = parseFloat(totalExpense);
      if (isNaN(expense) || expense < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Total expense must be a non-negative number",
        });
      }

      const projectData = existingProject.toJSON();
      // Check if project has activities - if yes, totalExpense should be calculated, not set directly
      if (projectData.activities && Array.isArray(projectData.activities) && projectData.activities.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Total expense cannot be set directly when project has activities. It is calculated from activity expenses.",
        });
      }
      updateObj.totalExpense = expense.toString(); // Will be encrypted by model hooks
    }

    // Update project fields
    if (Object.keys(updateObj).length > 0) {
      await existingProject.update(updateObj, { transaction });
    }

    // Handle activities updates
    if (activities !== undefined) {
      if (!Array.isArray(activities)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Activities must be an array",
        });
      }

      const projectData = existingProject.toJSON();
      const existingActivities = projectData.activities || [];

      // Update each activity
      for (const activityUpdate of activities) {
        // Find matching activity by id or activityId
        const existingActivity = existingActivities.find(
          act => (act.id || act._id)?.toString() === activityUpdate.id?.toString() ||
                  (act.id || act._id)?.toString() === activityUpdate._id?.toString() ||
                  act.activityId === activityUpdate.activityId
        );

        if (!existingActivity) {
          continue; // Skip if activity not found
        }

        const activityModel = await Activity.findByPk(existingActivity.id, { transaction });
        if (!activityModel) {
          continue;
        }

        // Update activity budget if provided
        if (activityUpdate.budget !== undefined && activityUpdate.budget !== null) {
          const budget = parseFloat(activityUpdate.budget);
          if (isNaN(budget) || budget < 0) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: "Activity budget must be a non-negative number",
            });
          }
          await activityModel.update({ budget: budget.toString() }, { transaction });
        }

        // Update activity expense if provided
        if (activityUpdate.expense !== undefined && activityUpdate.expense !== null) {
          const expense = parseFloat(activityUpdate.expense);
          if (isNaN(expense) || expense < 0) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: "Activity expense must be a non-negative number",
            });
          }
          await activityModel.update({ expense: expense.toString() }, { transaction });
        }

        // Update subActivities budgets and expenses if provided
        if (activityUpdate.subActivities && Array.isArray(activityUpdate.subActivities)) {
          const existingSubActivities = existingActivity.subActivities || [];

          for (const subActivityUpdate of activityUpdate.subActivities) {
            // Find matching subactivity by id or subactivityId
            const existingSubActivity = existingSubActivities.find(
              subAct => (subAct.id || subAct._id)?.toString() === subActivityUpdate.id?.toString() ||
                         (subAct.id || subAct._id)?.toString() === subActivityUpdate._id?.toString() ||
                         subAct.subactivityId === subActivityUpdate.subactivityId
            );

            if (!existingSubActivity) {
              continue; // Skip if subactivity not found
            }

            const subActivityModel = await SubActivity.findByPk(existingSubActivity.id, { transaction });
            if (!subActivityModel) {
              continue;
            }

            // Update subactivity budget if provided
            if (subActivityUpdate.budget !== undefined && subActivityUpdate.budget !== null) {
              const budget = parseFloat(subActivityUpdate.budget);
              if (isNaN(budget) || budget < 0) {
                await transaction.rollback();
                return res.status(400).json({
                  success: false,
                  message: "Sub-activity budget must be a non-negative number",
                });
              }
              await subActivityModel.update({ budget: budget.toString() }, { transaction });
            }

            // Update subactivity expense if provided
            if (subActivityUpdate.expense !== undefined && subActivityUpdate.expense !== null) {
              const expense = parseFloat(subActivityUpdate.expense);
              if (isNaN(expense) || expense < 0) {
                await transaction.rollback();
                return res.status(400).json({
                  success: false,
                  message: "Sub-activity expense must be a non-negative number",
                });
              }
              await subActivityModel.update({ expense: expense.toString() }, { transaction });
            }
          }
        }
      }

      // Recalculate totalExpense from activities
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
        transaction,
      });

      if (updatedProject) {
        const projectDataUpdated = updatedProject.toJSON();
        let totalExpense = 0;

        if (projectDataUpdated.activities && Array.isArray(projectDataUpdated.activities)) {
          projectDataUpdated.activities.forEach(activity => {
            decryptActivityData(activity);
            totalExpense += parseFloat(activity.expense) || 0;
          });
        }

        await updatedProject.update(
          { totalExpense: totalExpense.toString() },
          { transaction }
        );
      }
    }

    await transaction.commit();

    // Fetch the updated project
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
      ],
    });

    if (!savedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update",
      });
    }

    // Check utilization and send notifications (non-blocking)
    try {
      const { checkProjectItemsUtilization } = require("../utils/utilizationReminder");
      const projectData = savedProject.toJSON();
      // Run in background - don't wait for it
      checkProjectItemsUtilization(projectData).catch(err => {
        console.error("Error checking utilization:", err);
      });
    } catch (error) {
      console.error("Error setting up utilization check:", error);
      // Don't fail the request if notification fails
    }

    // Project fields are already decrypted by model hooks
    const projectData = savedProject.toJSON();

    // Manually decrypt nested activities and subactivities (hooks may not run for nested includes)
    if (projectData.activities && Array.isArray(projectData.activities)) {
      projectData.activities.forEach(activity => {
        decryptActivityData(activity);
      });
    }

    await logActivity({
      user: req.user,
      action: "PROJECT_EDITED",
      entityType: "project",
      entityId: savedProject.id,
      description: "Project financial data updated",
    });

    res.status(200).json({
      success: true,
      message: "Project financial information updated successfully",
      data: projectData,
    });
  } catch (error) {
    await transaction.rollback();
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

    // Handle custom error messages
    if (error.message.includes("budget") || error.message.includes("expense")) {
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

const getDashboardData = async (req, res) => {
  try {
    // Get finance user ID
    const userId = req.user.id;

    // Fetch Statistics for projects assigned to this finance user
    const totalProjects = await Project.count({
      where: { financePersonnelId: userId },
    });

    // Get project IDs assigned to this finance user
    const projectsAssignedToFinance = await Project.findAll({
      where: { financePersonnelId: userId },
      attributes: ['id'],
    });
    const projectIds = projectsAssignedToFinance.map((p) => p.id);

    // Count reallocation requests for projects assigned to this finance user
    const totalReallocations = await ReallocationRequest.count({
      where: {
        [Op.or]: [
          { sourceProjectId: { [Op.in]: projectIds } },
          { destinationProjectId: { [Op.in]: projectIds } },
          { projectId: { [Op.in]: projectIds } },
        ],
      },
    });

    // Get all projects assigned to this user to calculate underspent/overspent
    const allProjects = await Project.findAll({
      where: { financePersonnelId: userId },
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

    // Reallocation Status Distribution (for requests related to this user's projects)
    const reallocationStatuses = ["pending", "approved", "rejected"];
    const reallocationStatusDistribution = {};

    for (const status of reallocationStatuses) {
      const count = await ReallocationRequest.count({
        where: {
          status,
          [Op.or]: [
            { sourceProjectId: { [Op.in]: projectIds } },
            { destinationProjectId: { [Op.in]: projectIds } },
            { projectId: { [Op.in]: projectIds } },
          ],
        },
      });
      reallocationStatusDistribution[status] = count;
    }

    // Project Status Distribution (for projects assigned to this finance user)
    const projectStatuses = ["Not Started", "In Progress", "Completed"];
    const projectStatusDistribution = {};

    for (const status of projectStatuses) {
      const count = await Project.count({
        where: {
          financePersonnelId: userId,
          projectStatus: status,
        },
      });
      projectStatusDistribution[status] = count;
    }

    // Fetch recent 5 projects assigned to this finance user
    const recentProjects = await Project.findAll({
      where: { financePersonnelId: userId },
      attributes: ["id", "projectId", "title", "projectStatus", "createdAt"],
      include: [
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

    // Fetch recent 5 reallocation requests for projects assigned to this finance user
    const recentReallocations = await ReallocationRequest.findAll({
      where: {
        [Op.or]: [
          { sourceProjectId: { [Op.in]: projectIds } },
          { destinationProjectId: { [Op.in]: projectIds } },
          { projectId: { [Op.in]: projectIds } },
        ],
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

module.exports = {
  getAllReallocationRequests,
  getReallocationRequestById,
  approveReallocationRequest,
  rejectReallocationRequest,
  getAllProjects,
  getProjectById,
  getActivityById,
  updateProject,
  getDashboardData,
};
