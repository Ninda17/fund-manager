const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const User = require("./userModel");

const ActivityLog = sequelize.define(
  "ActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      // Note: Relationships will be defined in models/index.js
  },
  userName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "User name is required",
        },
      },
  },
  userEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: {
          msg: "Please provide a valid email",
        },
        notEmpty: {
          msg: "User email is required",
        },
      },
  },
  userRole: {
      type: DataTypes.ENUM("admin", "finance", "program"),
      allowNull: false,
      validate: {
        isIn: {
          args: [["admin", "finance", "program"]],
          msg: "User role must be admin, finance, or program",
        },
      },
  },
  action: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Action is required",
        },
      },
  },
  entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Entity type is required",
        },
      },
  },
  entityId: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Entity ID is required",
        },
      },
  },
  description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
  },
  metadata: {
      type: DataTypes.JSON, // MySQL 5.7+ supports JSON type
      allowNull: true,
      defaultValue: {},
  },
  timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
  },
  },
  {
    tableName: "activity_logs",
    timestamps: true, // Sequelize automatically adds createdAt and updatedAt
    indexes: [
      {
        fields: ["userId"],
      },
      {
        fields: ["entityType", "entityId"],
      },
      {
        fields: ["timestamp"],
      },
      {
        fields: ["action"],
      },
    ],
  }
);

module.exports = ActivityLog;
