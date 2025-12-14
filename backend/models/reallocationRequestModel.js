const mongoose = require("mongoose");

const reallocationRequestSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestType: {
      type: String,
      required: true,
      enum: ["project_to_project", "activity_to_activity", "subactivity_to_subactivity"],
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // Project-to-project fields
    sourceProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: function () {
        return this.requestType === "project_to_project";
      },
    },
    destinationProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: function () {
        return this.requestType === "project_to_project";
      },
    },
    // Activity reallocation fields
    sourceActivityId: {
      type: String,
      required: function () {
        return this.requestType === "activity_to_activity" || this.requestType === "subactivity_to_subactivity";
      },
    },
    destinationActivityId: {
      type: String,
      required: function () {
        return this.requestType === "activity_to_activity" || this.requestType === "subactivity_to_subactivity";
      },
    },
    // Subactivity reallocation fields
    sourceSubactivityId: {
      type: String,
      required: function () {
        return this.requestType === "subactivity_to_subactivity";
      },
    },
    destinationSubactivityId: {
      type: String,
      required: function () {
        return this.requestType === "subactivity_to_subactivity";
      },
    },
    // Project ID for activity/subactivity reallocations (to find the project)
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: function () {
        return this.requestType === "activity_to_activity" || this.requestType === "subactivity_to_subactivity";
      },
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    sourceCurrency: {
      type: String,
      required: true,
    },
    destinationCurrency: {
      type: String,
      required: true,
    },
    exchangeRate: {
      type: Number,
      default: null,
      min: [0, "Exchange rate must be positive"],
    },
    convertedAmount: {
      type: Number,
      default: null,
    },
    exchangeRateDate: {
      type: Date,
      default: null,
    },
    exchangeRateSource: {
      type: String,
      enum: ["manual", "api", "bank", null],
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    evidenceImageUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for better query performance
reallocationRequestSchema.index({ requestedBy: 1, status: 1 });
reallocationRequestSchema.index({ status: 1 });
reallocationRequestSchema.index({ sourceProjectId: 1 });
reallocationRequestSchema.index({ destinationProjectId: 1 });

module.exports = mongoose.model("ReallocationRequest", reallocationRequestSchema);

