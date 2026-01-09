const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const OTP = sequelize.define(
  "OTP",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: {
          msg: "Please provide a valid email",
        },
        notEmpty: {
          msg: "Email is required",
        },
      },
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "OTP is required",
        },
      },
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      // Note: TTL index functionality will be handled by cleanup job (Step 7)
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "otps",
    timestamps: true, // Sequelize automatically adds createdAt and updatedAt
    indexes: [
      {
        fields: ["email"],
      },
      {
        fields: ["expiresAt"],
      },
      {
        fields: ["isUsed"],
      },
    ],
  }
);

module.exports = OTP;


