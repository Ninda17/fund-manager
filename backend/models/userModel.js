const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Name is required",
        },
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: "Please provide a valid email",
        },
        notEmpty: {
          msg: "Email is required",
        },
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [6, Infinity],
          msg: "Password must be at least 6 characters long",
        },
        notEmpty: {
          msg: "Password is required",
        },
      },
    },
    profileImageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    role: {
      type: DataTypes.ENUM("admin", "finance", "program"),
      allowNull: false,
      defaultValue: "program",
      validate: {
        isIn: {
          args: [["admin", "finance", "program"]],
          msg: "Role must be admin, finance, or program",
        },
      },
    },
    isApproved: {
      type: DataTypes.ENUM("approved", "pending", "rejected"),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [["approved", "pending", "rejected"]],
          msg: "isApproved must be approved, pending, or rejected",
        },
      },
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    emailVerificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    deleteAfter: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      // Note: TTL index functionality will be handled by cleanup job (Step 7)
    },
  },
  {
    tableName: "users",
    timestamps: true, // Sequelize automatically adds createdAt and updatedAt
    indexes: [
      {
        fields: ["email"],
        unique: true,
      },
      {
        fields: ["deleteAfter"],
      },
      {
        fields: ["role"],
      },
    ],
  }
);

// ✅ Ensure only one admin exists (Sequelize hook)
User.beforeCreate(async (user) => {
  if (user.role === "admin") {
    const existingAdmin = await User.findOne({ where: { role: "admin" } });
    if (existingAdmin) {
      throw new Error("Only one admin account is allowed");
    }
    // Auto-approve admin
    user.isApproved = "approved";
    user.isEmailVerified = true;
    user.deleteAfter = null; // Never delete admin accounts
  }
});

// Also check on update (in case someone tries to change role to admin)
User.beforeUpdate(async (user) => {
  if (user.role === "admin" && user.changed("role")) {
    const existingAdmin = await User.findOne({
      where: { role: "admin" },
    });
    if (existingAdmin && existingAdmin.id !== user.id) {
      throw new Error("Only one admin account is allowed");
    }
    // Auto-approve admin
    user.isApproved = "approved";
    user.isEmailVerified = true;
    user.deleteAfter = null;
  }
});

module.exports = User;
