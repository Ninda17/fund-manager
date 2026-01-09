const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const User = require("./userModel");
const Project = require("./projectModel");

const ReallocationRequest = sequelize.define(
  "ReallocationRequest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    requestedById: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    requestType: {
      type: DataTypes.ENUM(
        "project_to_project",
        "activity_to_activity",
        "subactivity_to_subactivity"
      ),
      allowNull: false,
      validate: {
        isIn: {
          args: [
            [
              "project_to_project",
              "activity_to_activity",
              "subactivity_to_subactivity",
            ],
          ],
          msg: "Request type must be project_to_project, activity_to_activity, or subactivity_to_subactivity",
        },
      },
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [["pending", "approved", "rejected"]],
          msg: "Status must be pending, approved, or rejected",
        },
      },
    },
    // Project-to-project fields
    sourceProjectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Project,
        key: "id",
      },
    },
    destinationProjectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Project,
        key: "id",
      },
    },
    // Activity reallocation fields
    sourceActivityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    destinationActivityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Subactivity reallocation fields
    sourceSubactivityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    destinationSubactivityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Project ID for activity/subactivity reallocations (to find the project)
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Project,
        key: "id",
      },
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0.01],
          msg: "Amount must be greater than 0",
        },
        notEmpty: {
          msg: "Amount is required",
        },
      },
    },
    sourceCurrency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Source currency is required",
        },
      },
    },
    destinationCurrency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Destination currency is required",
        },
      },
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      defaultValue: null,
      validate: {
        min: {
          args: [0],
          msg: "Exchange rate must be positive",
        },
      },
    },
    convertedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: null,
    },
    exchangeRateDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    exchangeRateSource: {
      type: DataTypes.ENUM("manual", "api", "bank"),
      allowNull: true,
      defaultValue: null,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Reason is required",
        },
      },
    },
    approvedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: {
        model: User,
        key: "id",
      },
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    evidenceImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "reallocation_requests",
    timestamps: true,
    indexes: [
      {
        fields: ["requestedById", "status"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["sourceProjectId"],
      },
      {
        fields: ["destinationProjectId"],
      },
      {
        fields: ["projectId"],
      },
    ],
  }
);

// Conditional validation hooks
ReallocationRequest.beforeValidate((request) => {
  // Validate project-to-project fields
  if (request.requestType === "project_to_project") {
    if (!request.sourceProjectId) {
      throw new Error(
        "Source project ID is required for project-to-project reallocation"
      );
    }
    if (!request.destinationProjectId) {
      throw new Error(
        "Destination project ID is required for project-to-project reallocation"
      );
    }
  }

  // Validate activity/subactivity reallocation fields
  if (
    request.requestType === "activity_to_activity" ||
    request.requestType === "subactivity_to_subactivity"
  ) {
    if (!request.sourceActivityId) {
      throw new Error(
        "Source activity ID is required for activity/subactivity reallocation"
      );
    }
    if (!request.destinationActivityId) {
      throw new Error(
        "Destination activity ID is required for activity/subactivity reallocation"
      );
    }
    if (!request.projectId) {
      throw new Error(
        "Project ID is required for activity/subactivity reallocation"
      );
    }
  }

  // Validate subactivity reallocation fields
  if (request.requestType === "subactivity_to_subactivity") {
    if (!request.sourceSubactivityId) {
      throw new Error(
        "Source subactivity ID is required for subactivity-to-subactivity reallocation"
      );
    }
    if (!request.destinationSubactivityId) {
      throw new Error(
        "Destination subactivity ID is required for subactivity-to-subactivity reallocation"
      );
    }
  }
});

module.exports = ReallocationRequest;
