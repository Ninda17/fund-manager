const Project = require("../models/projectModel");
const ReallocationRequest = require("../models/reallocationRequestModel");
const mongoose = require("mongoose");
const path = require("path");

console
// Helper function to build financePersonnel query that handles both ObjectId and string formats
const buildFinancePersonnelQuery = (userId) => {
  const userIdString = userId.toString();
  return {
    $or: [
      { financePersonnel: new mongoose.Types.ObjectId(userIdString) },
      { financePersonnel: userIdString },
      {
        $expr: {
          $or: [
            { $eq: [{ $toString: "$financePersonnel" }, userIdString] },
            { $eq: ["$financePersonnel", userIdString] }
          ]
        }
      }
    ]
  };
};

const getAllReallocationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // Finance can see requests for projects they are assigned to
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    const projectsAssignedToFinance = await Project.find(financePersonnelQuery).select("_id");

    const projectIds = projectsAssignedToFinance.map((p) => p._id);

    const query = {
      $or: [
        { sourceProjectId: { $in: projectIds } },
        { destinationProjectId: { $in: projectIds } },
        { projectId: { $in: projectIds } },
      ],
    };

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

    // Finance can only view requests for projects they are assigned to
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    const projectsAssignedToFinance = await Project.find(financePersonnelQuery).select("_id");

    const projectIds = projectsAssignedToFinance.map((p) => p._id);

    const request = await ReallocationRequest.findOne({
      _id: id,
      $or: [
        { sourceProjectId: { $in: projectIds } },
        { destinationProjectId: { $in: projectIds } },
        { projectId: { $in: projectIds } },
      ],
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

const approveReallocationRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { exchangeRate, exchangeRateDate, exchangeRateSource } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    // Check if evidence image was uploaded
    if (!req.file) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Evidence image is required for approval",
      });
    }

    // Get the request
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    const projectsAssignedToFinance = await Project.find(financePersonnelQuery).select("_id").lean();

    const projectIds = projectsAssignedToFinance.map((p) => p._id.toString());

    const request = await ReallocationRequest.findOne({
      _id: id,
      status: "pending",
      $or: [
        { sourceProjectId: { $in: projectIds } },
        { destinationProjectId: { $in: projectIds } },
        { projectId: { $in: projectIds } },
      ],
    }).session(session);

    if (!request) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Pending reallocation request not found or you do not have access",
      });
    }

    // Handle currency conversion
    const currenciesDiffer = request.sourceCurrency !== request.destinationCurrency;
    let exchangeRateValue = 1;
    let convertedAmount = request.amount;

    if (currenciesDiffer) {
      // Exchange rate is required for different currencies
      if (!exchangeRate || isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Exchange rate is required and must be a positive number when currencies differ",
        });
      }

      exchangeRateValue = parseFloat(exchangeRate);
      convertedAmount = request.amount * exchangeRateValue;
    } else if (exchangeRate) {
      // If same currency but exchange rate provided, use it (should be 1)
      exchangeRateValue = parseFloat(exchangeRate);
      convertedAmount = request.amount * exchangeRateValue;
    }

    const { decrypt, encrypt } = require("../utils/encryption");

    // Execute reallocation based on request type
    if (request.requestType === "project_to_project") {
      // Get source and destination projects (use lean to get raw values)
      const sourceProject = await Project.findById(request.sourceProjectId).lean().session(session);
      const destinationProject = await Project.findById(request.destinationProjectId).lean().session(session);

      if (!sourceProject || !destinationProject) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Source or destination project not found",
        });
      }

      // Decrypt source amountDonated - access raw value
      let sourceAmountDonated = 0;
      const rawSourceAmount = sourceProject.amountDonated;
      if (rawSourceAmount !== undefined && rawSourceAmount !== null) {
        if (typeof rawSourceAmount === 'string' && rawSourceAmount.includes(':')) {
          sourceAmountDonated = parseFloat(decrypt(rawSourceAmount)) || 0;
        } else if (typeof rawSourceAmount === 'number') {
          sourceAmountDonated = rawSourceAmount;
        } else {
          sourceAmountDonated = parseFloat(rawSourceAmount) || 0;
        }
      }

      // Validate sufficient balance
      if (sourceAmountDonated < request.amount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source project has ${sourceAmountDonated} ${request.sourceCurrency}`,
        });
      }

      // Decrypt destination amountDonated - access raw value
      let destinationAmountDonated = 0;
      const rawDestinationAmount = destinationProject.amountDonated;
      if (rawDestinationAmount !== undefined && rawDestinationAmount !== null) {
        if (typeof rawDestinationAmount === 'string' && rawDestinationAmount.includes(':')) {
          destinationAmountDonated = parseFloat(decrypt(rawDestinationAmount)) || 0;
        } else if (typeof rawDestinationAmount === 'number') {
          destinationAmountDonated = rawDestinationAmount;
        } else {
          destinationAmountDonated = parseFloat(rawDestinationAmount) || 0;
        }
      }

      // Calculate new amounts
      const newSourceAmount = sourceAmountDonated - request.amount;
      const newDestinationAmount = destinationAmountDonated + convertedAmount;

      // Update source project using MongoDB native update to handle encryption
      await Project.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(request.sourceProjectId) },
        { $set: { amountDonated: encrypt(newSourceAmount.toString()) } },
        { session }
      );

      // Update destination project using MongoDB native update to handle encryption
      await Project.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(request.destinationProjectId) },
        { $set: { amountDonated: encrypt(newDestinationAmount.toString()) } },
        { session }
      );

    } else if (request.requestType === "activity_to_activity") {
      // Get project (use lean to get raw values)
      const project = await Project.findById(request.projectId).lean().session(session);

      if (!project) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Find source and destination activities
      const sourceActivityIndex = project.activities.findIndex(
        (act) => act._id?.toString() === request.sourceActivityId || act.activityId === request.sourceActivityId
      );
      const destinationActivityIndex = project.activities.findIndex(
        (act) => act._id?.toString() === request.destinationActivityId || act.activityId === request.destinationActivityId
      );

      if (sourceActivityIndex === -1 || destinationActivityIndex === -1) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Source or destination activity not found",
        });
      }

      // Decrypt source activity budget - access raw value
      let sourceBudget = 0;
      const sourceActivity = project.activities[sourceActivityIndex];
      const rawSourceBudget = sourceActivity.budget;
      if (rawSourceBudget !== undefined && rawSourceBudget !== null) {
        if (typeof rawSourceBudget === 'string' && rawSourceBudget.includes(':')) {
          sourceBudget = parseFloat(decrypt(rawSourceBudget)) || 0;
        } else if (typeof rawSourceBudget === 'number') {
          sourceBudget = rawSourceBudget;
        } else {
          sourceBudget = parseFloat(rawSourceBudget) || 0;
        }
      }

      // Validate sufficient balance
      if (sourceBudget < request.amount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source activity has ${sourceBudget} ${request.sourceCurrency}`,
        });
      }

      // Decrypt destination activity budget - access raw value
      let destinationBudget = 0;
      const destinationActivity = project.activities[destinationActivityIndex];
      const rawDestinationBudget = destinationActivity.budget;
      if (rawDestinationBudget !== undefined && rawDestinationBudget !== null) {
        if (typeof rawDestinationBudget === 'string' && rawDestinationBudget.includes(':')) {
          destinationBudget = parseFloat(decrypt(rawDestinationBudget)) || 0;
        } else if (typeof rawDestinationBudget === 'number') {
          destinationBudget = rawDestinationBudget;
        } else {
          destinationBudget = parseFloat(rawDestinationBudget) || 0;
        }
      }

      // Calculate new budgets
      const newSourceBudget = sourceBudget - request.amount;
      const newDestinationBudget = destinationBudget + convertedAmount;

      // Update activities using MongoDB native update to handle encryption
      await Project.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(request.projectId) },
        {
          $set: {
            [`activities.${sourceActivityIndex}.budget`]: encrypt(newSourceBudget.toString()),
            [`activities.${destinationActivityIndex}.budget`]: encrypt(newDestinationBudget.toString()),
          },
        },
        { session }
      );

      // Manually recalculate expenses (following pattern from deleteActivity/deleteSubActivity)
      // Reload project with lean to get updated values
      const updatedProject = await Project.findById(request.projectId).lean().session(session);
      if (updatedProject && updatedProject.activities && Array.isArray(updatedProject.activities)) {
        let totalExpense = 0;
        const updates = {};

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

        // Encrypt the totalExpense value
        const encryptedTotalExpense = encrypt(totalExpense.toString());
        updates.totalExpense = encryptedTotalExpense;

        // Update activity expenses and totalExpense using MongoDB native collection method
        await Project.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(request.projectId) },
          { $set: updates },
          { session }
        );
      }

    } else if (request.requestType === "subactivity_to_subactivity") {
      // Get project (use lean to get raw values)
      const project = await Project.findById(request.projectId).lean().session(session);

      if (!project) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Find activity containing both subactivities
      const activityIndex = project.activities.findIndex(
        (act) => act._id?.toString() === request.sourceActivityId || act.activityId === request.sourceActivityId
      );

      if (activityIndex === -1) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Activity not found",
        });
      }

      const activity = project.activities[activityIndex];

      // Find source and destination subactivities
      const sourceSubactivityIndex = activity.subActivities?.findIndex(
        (subAct) => subAct._id?.toString() === request.sourceSubactivityId || subAct.subactivityId === request.sourceSubactivityId
      );
      const destinationSubactivityIndex = activity.subActivities?.findIndex(
        (subAct) => subAct._id?.toString() === request.destinationSubactivityId || subAct.subactivityId === request.destinationSubactivityId
      );

      if (sourceSubactivityIndex === -1 || destinationSubactivityIndex === -1) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Source or destination subactivity not found",
        });
      }

      // Decrypt source subactivity budget - access raw value
      let sourceBudget = 0;
      const sourceSubactivity = activity.subActivities[sourceSubactivityIndex];
      const rawSourceBudget = sourceSubactivity.budget;
      if (rawSourceBudget !== undefined && rawSourceBudget !== null) {
        if (typeof rawSourceBudget === 'string' && rawSourceBudget.includes(':')) {
          sourceBudget = parseFloat(decrypt(rawSourceBudget)) || 0;
        } else if (typeof rawSourceBudget === 'number') {
          sourceBudget = rawSourceBudget;
        } else {
          sourceBudget = parseFloat(rawSourceBudget) || 0;
        }
      }

      // Validate sufficient balance
      if (sourceBudget < request.amount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Source subactivity has ${sourceBudget} ${request.sourceCurrency}`,
        });
      }

      // Decrypt destination subactivity budget - access raw value
      let destinationBudget = 0;
      const destinationSubactivity = activity.subActivities[destinationSubactivityIndex];
      const rawDestinationBudget = destinationSubactivity.budget;
      if (rawDestinationBudget !== undefined && rawDestinationBudget !== null) {
        if (typeof rawDestinationBudget === 'string' && rawDestinationBudget.includes(':')) {
          destinationBudget = parseFloat(decrypt(rawDestinationBudget)) || 0;
        } else if (typeof rawDestinationBudget === 'number') {
          destinationBudget = rawDestinationBudget;
        } else {
          destinationBudget = parseFloat(rawDestinationBudget) || 0;
        }
      }

      // Calculate new budgets
      const newSourceBudget = sourceBudget - request.amount;
      const newDestinationBudget = destinationBudget + convertedAmount;

      // Update subactivities using MongoDB native update
      await Project.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(request.projectId) },
        {
          $set: {
            [`activities.${activityIndex}.subActivities.${sourceSubactivityIndex}.budget`]: encrypt(newSourceBudget.toString()),
            [`activities.${activityIndex}.subActivities.${destinationSubactivityIndex}.budget`]: encrypt(newDestinationBudget.toString()),
          },
        },
        { session }
      );

      // Manually recalculate expenses (following pattern from deleteActivity/deleteSubActivity)
      // Reload project with lean to get updated values
      const updatedProject = await Project.findById(request.projectId).lean().session(session);
      if (updatedProject && updatedProject.activities && Array.isArray(updatedProject.activities)) {
        let totalExpense = 0;
        const updates = {};

        updatedProject.activities.forEach((activity, actIndex) => {
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
          updates[`activities.${actIndex}.expense`] = encryptedActivityExpense;
          
          totalExpense += activityExpense;
        });

        // Encrypt the totalExpense value
        const encryptedTotalExpense = encrypt(totalExpense.toString());
        updates.totalExpense = encryptedTotalExpense;

        // Update activity expenses and totalExpense using MongoDB native collection method
        await Project.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(request.projectId) },
          { $set: updates },
          { session }
        );
      }
    }

    // Update request status
    const evidenceImageUrl = `/uploads/${req.file.filename}`;
    request.status = "approved";
    request.approvedBy = req.user.id;
    request.approvedAt = new Date();
    request.evidenceImageUrl = evidenceImageUrl;
    request.exchangeRate = exchangeRateValue;
    request.convertedAmount = convertedAmount;
    request.exchangeRateDate = exchangeRateDate ? new Date(exchangeRateDate) : new Date();
    request.exchangeRateSource = exchangeRateSource || (currenciesDiffer ? "manual" : null);

    await request.save({ session });

    await session.commitTransaction();


    // Populate before sending response
    await request.populate("requestedBy", "name email");
    await request.populate("sourceProjectId", "projectId title");
    await request.populate("destinationProjectId", "projectId title");
    await request.populate("projectId", "projectId title");
    await request.populate("approvedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Reallocation request approved and executed successfully",
      data: request,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Approve reallocation request error:", error);

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

const rejectReallocationRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format",
      });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    // Get the request
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    const projectsAssignedToFinance = await Project.find(financePersonnelQuery).select("_id").lean();

    const projectIds = projectsAssignedToFinance.map((p) => p._id.toString());

    const request = await ReallocationRequest.findOne({
      _id: id,
      status: "pending",
      $or: [
        { sourceProjectId: { $in: projectIds } },
        { destinationProjectId: { $in: projectIds } },
        { projectId: { $in: projectIds } },
      ],
    }).session(session);

    if (!request) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Pending reallocation request not found or you do not have access",
      });
    }

    // Update request status
    request.status = "rejected";
    request.approvedBy = req.user.id; // Using approvedBy to track who rejected
    request.approvedAt = new Date();
    request.rejectionReason = rejectionReason.trim();

    await request.save({ session });

    await session.commitTransaction();


    // Populate before sending response
    await request.populate("requestedBy", "name email");
    await request.populate("sourceProjectId", "projectId title");
    await request.populate("destinationProjectId", "projectId title");
    await request.populate("projectId", "projectId title");
    await request.populate("approvedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Reallocation request rejected successfully",
      data: request,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Reject reallocation request error:", error);

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

const getAllProjects = async (req, res) => {
  try {
    // Get all projects assigned to the logged-in finance user
    // Use lean() to get plain objects, then decrypt manually
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    // console.log("Finance user ID:", userId.toString());
    
    const projects = await Project.find(financePersonnelQuery)
    .select("projectId title startDate endDate financePersonnel amountDonated currency totalExpense projectStatus")
    .populate("financePersonnel", "name email")
    .populate("programPersonnel", "name email")
    .lean()
    .sort({ createdAt: -1 });
    
    // console.log("Found projects:", projects.length);

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

    // Validate id format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Get project by ID, ensuring it's assigned to the logged-in finance user
    // Use lean() to get plain objects, then decrypt manually
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    const project = await Project.findOne({
      _id: id,
      ...financePersonnelQuery
    })
    .populate("financePersonnel", "name email")
    .populate("programPersonnel", "name email")
    .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
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

    // Validate projectId format
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // activityId can be MongoDB ObjectId or activityId string, so no strict validation needed

    // Get project by ID, ensuring it's assigned to the logged-in finance user
    // Use lean() to get plain objects, then decrypt manually
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    const project = await Project.findOne({
      _id: projectId,
      ...financePersonnelQuery
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
      donorName,
      amountDonated,
      currency,
      totalExpense,
      activities,
    } = req.body;

    // Validate id format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Find project by ID, ensuring it belongs to the logged-in finance user
    // Use lean() to get plain object and avoid Mongoose document validation issues
    const userId = req.user._id || req.user.id;
    const financePersonnelQuery = buildFinancePersonnelQuery(userId);
    
    const existingProject = await Project.findOne({
      _id: id,
      ...financePersonnelQuery
    }).lean();

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
    }

    // Import encryption utilities
    const { encrypt, decrypt } = require("../utils/encryption");

    // Build update object - only financial fields allowed
    const updateObj = {};

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
      updateObj.amountDonated = amount.toString(); // Will be encrypted below
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

    // Update totalExpense if provided (only valid when project has no activities)
    if (totalExpense !== undefined) {
      const expense = parseFloat(totalExpense);
      if (isNaN(expense) || expense < 0) {
        return res.status(400).json({
          success: false,
          message: "Total expense must be a non-negative number",
        });
      }
      // Check if project has activities - if yes, totalExpense should be calculated, not set directly
      if (existingProject.activities && Array.isArray(existingProject.activities) && existingProject.activities.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Total expense cannot be set directly when project has activities. It is calculated from activity expenses.",
        });
      }
      updateObj.totalExpense = expense.toString(); // Will be encrypted below
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

      // Get existing activities to preserve non-financial fields
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

        // Only update budget if provided
        if (activityUpdate.budget !== undefined && activityUpdate.budget !== null) {
          const budget = parseFloat(activityUpdate.budget);
          if (isNaN(budget) || budget < 0) {
            throw new Error("Activity budget must be a non-negative number");
          }
          activityUpdates[`activities.${activityIndex}.budget`] = encrypt(budget.toString());
        }

        // Only update expense if provided
        if (activityUpdate.expense !== undefined && activityUpdate.expense !== null) {
          const expense = parseFloat(activityUpdate.expense);
          if (isNaN(expense) || expense < 0) {
            throw new Error("Activity expense must be a non-negative number");
          }
          activityUpdates[`activities.${activityIndex}.expense`] = encrypt(expense.toString());
        }

        // Update subActivities budgets and expenses if provided
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

            // Only update budget if provided
            if (subActivityUpdate.budget !== undefined && subActivityUpdate.budget !== null) {
              const budget = parseFloat(subActivityUpdate.budget);
              if (isNaN(budget) || budget < 0) {
                throw new Error("Sub-activity budget must be a non-negative number");
              }
              activityUpdates[`activities.${activityIndex}.subActivities.${subIndex}.budget`] = encrypt(budget.toString());
            }

            // Only update expense if provided
            if (subActivityUpdate.expense !== undefined && subActivityUpdate.expense !== null) {
              const expense = parseFloat(subActivityUpdate.expense);
              if (isNaN(expense) || expense < 0) {
                throw new Error("Sub-activity expense must be a non-negative number");
              }
              activityUpdates[`activities.${activityIndex}.subActivities.${subIndex}.expense`] = encrypt(expense.toString());
            }
          });
        }
      });
    }

    // Use MongoDB native collection method to update top-level fields
    if (Object.keys(updateObj).length > 0) {
      // Encrypt amountDonated if it's being updated
      if (updateObj.amountDonated) {
        updateObj.amountDonated = encrypt(updateObj.amountDonated);
      }
      
      // Encrypt totalExpense if it's being updated
      if (updateObj.totalExpense) {
        updateObj.totalExpense = encrypt(updateObj.totalExpense);
      }
      
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

    // Recalculate expenses based on the hierarchy
    // Logic:
    // 1. If activity has subactivities: calculate expense from subactivity expenses
    // 2. If activity has no subactivities: use activity.expense directly
    // 3. If project has activities: calculate totalExpense from activity expenses
    // 4. If project has no activities: use totalExpense directly
    const updatedProject = await Project.findById(id).lean();
    if (!updatedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update",
      });
    }

    const expenseRecalcUpdates = {};

    if (updatedProject.activities && Array.isArray(updatedProject.activities) && updatedProject.activities.length > 0) {
      // Project has activities: calculate totalExpense from activity expenses
      let totalExpense = 0;

      updatedProject.activities.forEach((activity, activityIndex) => {
        let activityExpense = 0;
        
        // If activity has subactivities: calculate expense from subactivity expenses
        if (activity.subActivities && Array.isArray(activity.subActivities) && activity.subActivities.length > 0) {
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
          // Encrypt and update the calculated activity expense
          const encryptedActivityExpense = encrypt(activityExpense.toString());
          expenseRecalcUpdates[`activities.${activityIndex}.expense`] = encryptedActivityExpense;
        } else {
          // If activity has no subactivities: use activity.expense directly
          // Decrypt to get the actual value for totalExpense calculation
          if (activity.expense !== undefined && activity.expense !== null) {
            if (typeof activity.expense === 'string' && activity.expense.includes(':')) {
              activityExpense = parseFloat(decrypt(activity.expense)) || 0;
            } else if (typeof activity.expense === 'number') {
              activityExpense = activity.expense;
            }
          }
        }
        
        totalExpense += activityExpense;
      });

      // Calculate total expense from activity expenses
      const encryptedTotalExpense = encrypt(totalExpense.toString());
      expenseRecalcUpdates.totalExpense = encryptedTotalExpense;
    } else {
      // If project has no activities: use totalExpense directly (don't recalculate)
      // Only update if totalExpense was explicitly provided in the request
      // (This would need to be added to the API if needed)
    }

    // Update recalculated expenses using MongoDB native collection method
    if (Object.keys(expenseRecalcUpdates).length > 0) {
      await Project.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: expenseRecalcUpdates }
      );
    }

    // Fetch the updated project using lean to avoid casting issues
    const savedProject = await Project.findById(id).lean();
    if (!savedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update",
      });
    }

    // Decrypt fields for response
    const decrypted = { ...savedProject };
    
    // Decrypt donorName
    if (decrypted.donorName && typeof decrypted.donorName === 'string' && decrypted.donorName.includes(':')) {
      decrypted.donorName = decrypt(decrypted.donorName);
    }
    
    // Decrypt amountDonated
    if (decrypted.amountDonated && typeof decrypted.amountDonated === 'string' && decrypted.amountDonated.includes(':')) {
      decrypted.amountDonated = parseFloat(decrypt(decrypted.amountDonated)) || 0;
    }
    
    // Decrypt currency
    if (decrypted.currency && typeof decrypted.currency === 'string' && decrypted.currency.includes(':')) {
      decrypted.currency = decrypt(decrypted.currency);
    }
    
    // Decrypt activities
    if (decrypted.activities && Array.isArray(decrypted.activities)) {
      decrypted.activities = decrypted.activities.map(activity => {
        const decryptedActivity = { ...activity };
        
        if (decryptedActivity.budget && typeof decryptedActivity.budget === 'string' && decryptedActivity.budget.includes(':')) {
          decryptedActivity.budget = parseFloat(decrypt(decryptedActivity.budget)) || 0;
        }
        
        if (decryptedActivity.expense && typeof decryptedActivity.expense === 'string' && decryptedActivity.expense.includes(':')) {
          decryptedActivity.expense = parseFloat(decrypt(decryptedActivity.expense)) || 0;
        }
        
        if (decryptedActivity.subActivities && Array.isArray(decryptedActivity.subActivities)) {
          decryptedActivity.subActivities = decryptedActivity.subActivities.map(subActivity => {
            const decryptedSubActivity = { ...subActivity };
            
            if (decryptedSubActivity.budget && typeof decryptedSubActivity.budget === 'string' && decryptedSubActivity.budget.includes(':')) {
              decryptedSubActivity.budget = parseFloat(decrypt(decryptedSubActivity.budget)) || 0;
            }
            
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
      message: "Project financial information updated successfully",
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

module.exports = {
  getAllReallocationRequests,
  getReallocationRequestById,
  approveReallocationRequest,
  rejectReallocationRequest,
  getAllProjects,
  getProjectById,
  getActivityById,
  updateProject,
};

