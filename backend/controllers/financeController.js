const Project = require("../models/projectModel");
const ReallocationRequest = require("../models/reallocationRequestModel");
const mongoose = require("mongoose");
const path = require("path");

const getAllReallocationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // Finance can see requests for projects they are assigned to
    const projectsAssignedToFinance = await Project.find({
      financePersonnel: req.user.id,
    }).select("_id");

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
    const projectsAssignedToFinance = await Project.find({
      financePersonnel: req.user.id,
    }).select("_id");

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
    const projectsAssignedToFinance = await Project.find({
      financePersonnel: req.user.id,
    }).select("_id").lean();

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
    const projectsAssignedToFinance = await Project.find({
      financePersonnel: req.user.id,
    }).select("_id").lean();

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

module.exports = {
  getAllReallocationRequests,
  getReallocationRequestById,
  approveReallocationRequest,
  rejectReallocationRequest,
};

