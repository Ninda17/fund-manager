const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { encrypt, decrypt } = require("../utils/encryption");
const User = require("./userModel");

const Project = sequelize.define(
  "Project",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    programPersonnelId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      // Note: Relationships will be defined in models/index.js
    },
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
      validate: {
        notEmpty: {
          msg: "Project ID is required",
        },
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Title is required",
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      // Will be encrypted in hooks (stored as encrypted string)
    },
    startDate: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: false,
      // Will be encrypted in hooks (stored as encrypted string, decrypted to Date when retrieved)
    },
    endDate: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: false,
      // Will be encrypted in hooks (stored as encrypted string, decrypted to Date when retrieved)
    },
    financePersonnelId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    donorName: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: false,
      // Will be encrypted in hooks (stored as encrypted string)
    },
    amountDonated: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: false,
      // Will be encrypted in hooks (stored as encrypted string, decrypted to number when retrieved)
      // Validation happens before encryption
    },
    currency: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: false,
      defaultValue: "USD",
      // Will be encrypted in hooks (stored as encrypted string)
    },
    projectType: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: false,
      defaultValue: "Social Development Program",
      // Will be encrypted in hooks (stored as encrypted string)
    },
    totalExpense: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: false,
      defaultValue: "0",
      // Will be encrypted in hooks (stored as encrypted string, decrypted to number when retrieved)
      // Validation happens before encryption
    },
    projectStatus: {
      type: DataTypes.ENUM("Not Started", "In Progress", "Completed"),
      allowNull: false,
      defaultValue: "Not Started",
    },
    // Note: activities[] will be in separate Activity table
    // Note: documents[] will be in separate ProjectDocument table
  },
  {
    tableName: "projects",
    timestamps: true,
    indexes: [
      {
        fields: ["projectId"],
        unique: true,
      },
      {
        fields: ["programPersonnelId"],
      },
      {
        fields: ["financePersonnelId"],
      },
      {
        fields: ["projectStatus"],
      },
    ],
  }
);

// Helper function to encrypt field if not already encrypted
const encryptField = (value, isNumber = false) => {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  
  // Check if already encrypted (contains ':')
  if (typeof value === 'string' && value.includes(':')) {
    return value;
  }
  
  // Convert to string for encryption
  let stringValue;
  if (isNumber) {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      throw new Error(`Invalid ${isNumber ? 'number' : 'value'}`);
    }
    stringValue = numValue.toString();
  } else if (value instanceof Date) {
    stringValue = value.toISOString();
  } else {
    stringValue = value.toString();
  }
  
  return encrypt(stringValue);
};

// Helper function to decrypt field
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
    } else if (returnType === 'date') {
      return new Date(decrypted);
    }
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedValue; // Return as-is if decryption fails
  }
};

// Validate numeric fields before encryption
Project.beforeValidate((project) => {
  // Validate amountDonated (before encryption)
  // If already encrypted (contains ':'), skip validation (it's already valid)
  if (project.amountDonated !== undefined && project.amountDonated !== null) {
    if (typeof project.amountDonated === 'string' && project.amountDonated.includes(':')) {
      // Already encrypted, skip validation
      return;
    }
    
    const amount = typeof project.amountDonated === 'number' ? project.amountDonated : parseFloat(project.amountDonated);
    
    if (isNaN(amount) || amount < 0) {
      throw new Error("Amount donated must be a non-negative number");
    }
  }
  
  // Validate totalExpense (before encryption)
  // If already encrypted (contains ':'), skip validation (it's already valid)
  if (project.totalExpense !== undefined && project.totalExpense !== null) {
    if (typeof project.totalExpense === 'string' && project.totalExpense.includes(':')) {
      // Already encrypted, skip validation
      return;
    }
    
    const expense = typeof project.totalExpense === 'number' ? project.totalExpense : parseFloat(project.totalExpense);
    
    if (isNaN(expense) || expense < 0) {
      throw new Error("Total expense must be a non-negative number");
    }
  }
});

// Validate that financialPersonnel is a user with role "finance", email verified, and approved
Project.beforeValidate(async (project) => {
  if (project.financePersonnelId) {
    const user = await User.findByPk(project.financePersonnelId);
    
    if (!user) {
      throw new Error("Financial personnel user not found");
    }
    
    if (user.role !== "finance") {
      throw new Error("Financial personnel must be a user with role 'finance'");
    }
    
    if (!user.isEmailVerified) {
      throw new Error("Financial personnel must have a verified email address");
    }
    
    if (user.isApproved !== "approved") {
      throw new Error("Financial personnel must be approved");
    }
  }
});

// Validate that programPersonnel is a user with role "program"
Project.beforeValidate(async (project) => {
  if (project.programPersonnelId) {
    const user = await User.findByPk(project.programPersonnelId);
    
    if (!user) {
      throw new Error("Program personnel user not found");
    }
    
    if (user.role !== "program") {
      throw new Error("Program personnel must be a user with role 'program'");
    }
  }
});

// Validate that endDate is after startDate
Project.beforeValidate((project) => {
  if (project.startDate && project.endDate) {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    
    if (end < start) {
      throw new Error("End date must be after start date");
    }
  }
});

// Encrypt sensitive fields before saving
Project.beforeCreate(async (project) => {
  // Encrypt donorName
  if (project.donorName) {
    project.donorName = encryptField(project.donorName);
  }
  
  // Encrypt description
  if (project.description) {
    project.description = encryptField(project.description);
  }
  
  // Encrypt amountDonated (store as string)
  if (project.amountDonated !== undefined && project.amountDonated !== null) {
    project.amountDonated = encryptField(project.amountDonated, true);
  }
  
  // Encrypt startDate (store as string)
  if (project.startDate) {
    project.startDate = encryptField(project.startDate);
  }
  
  // Encrypt endDate (store as string)
  if (project.endDate) {
    project.endDate = encryptField(project.endDate);
  }
  
  // Encrypt currency
  if (project.currency) {
    project.currency = encryptField(project.currency);
  }
  
  // Encrypt projectType
  if (project.projectType) {
    project.projectType = encryptField(project.projectType);
  }
  
  // Encrypt totalExpense (store as string)
  if (project.totalExpense !== undefined && project.totalExpense !== null) {
    project.totalExpense = encryptField(project.totalExpense, true);
  }
});

// Also encrypt on update
Project.beforeUpdate(async (project) => {
  // Only encrypt if field was changed and not already encrypted
  if (project.changed('donorName') && project.donorName && !project.donorName.includes(':')) {
    project.donorName = encryptField(project.donorName);
  }
  
  if (project.changed('description') && project.description && !project.description.includes(':')) {
    project.description = encryptField(project.description);
  }
  
  if (project.changed('amountDonated') && project.amountDonated && typeof project.amountDonated !== 'string') {
    project.amountDonated = encryptField(project.amountDonated, true);
  }
  
  if (project.changed('startDate') && project.startDate && !(typeof project.startDate === 'string' && project.startDate.includes(':'))) {
    project.startDate = encryptField(project.startDate);
  }
  
  if (project.changed('endDate') && project.endDate && !(typeof project.endDate === 'string' && project.endDate.includes(':'))) {
    project.endDate = encryptField(project.endDate);
  }
  
  if (project.changed('currency') && project.currency && !project.currency.includes(':')) {
    project.currency = encryptField(project.currency);
  }
  
  if (project.changed('projectType') && project.projectType && !project.projectType.includes(':')) {
    project.projectType = encryptField(project.projectType);
  }
  
  if (project.changed('totalExpense') && project.totalExpense && typeof project.totalExpense !== 'string') {
    project.totalExpense = encryptField(project.totalExpense, true);
  }
});

// Decrypt sensitive fields after retrieving
Project.afterFind((projects) => {
  if (!projects) return;
  
  const decryptProject = (project) => {
    if (!project) return;
    
    // Decrypt donorName
    if (project.donorName) {
      project.donorName = decryptField(project.donorName);
    }
    
    // Decrypt description
    if (project.description) {
      project.description = decryptField(project.description);
    }
    
    // Decrypt amountDonated
    if (project.amountDonated) {
      project.amountDonated = decryptField(project.amountDonated, 'number');
    }
    
    // Decrypt startDate
    if (project.startDate) {
      project.startDate = decryptField(project.startDate, 'date');
    }
    
    // Decrypt endDate
    if (project.endDate) {
      project.endDate = decryptField(project.endDate, 'date');
    }
    
    // Decrypt currency
    if (project.currency) {
      project.currency = decryptField(project.currency);
    }
    
    // Decrypt projectType
    if (project.projectType) {
      project.projectType = decryptField(project.projectType);
    }
    
    // Decrypt totalExpense
    if (project.totalExpense) {
      project.totalExpense = decryptField(project.totalExpense, 'number');
    }
    
    return project;
  };
  
  if (Array.isArray(projects)) {
    projects.forEach(decryptProject);
  } else {
    decryptProject(projects);
  }
});

// Also decrypt after create/update
Project.afterCreate((project) => {
  // Decrypt fields
  if (project.donorName) project.donorName = decryptField(project.donorName);
  if (project.description) project.description = decryptField(project.description);
  if (project.amountDonated) project.amountDonated = decryptField(project.amountDonated, 'number');
  if (project.startDate) project.startDate = decryptField(project.startDate, 'date');
  if (project.endDate) project.endDate = decryptField(project.endDate, 'date');
  if (project.currency) project.currency = decryptField(project.currency);
  if (project.projectType) project.projectType = decryptField(project.projectType);
  if (project.totalExpense) project.totalExpense = decryptField(project.totalExpense, 'number');
});

Project.afterUpdate((project) => {
  // Decrypt fields
  if (project.donorName) project.donorName = decryptField(project.donorName);
  if (project.description) project.description = decryptField(project.description);
  if (project.amountDonated) project.amountDonated = decryptField(project.amountDonated, 'number');
  if (project.startDate) project.startDate = decryptField(project.startDate, 'date');
  if (project.endDate) project.endDate = decryptField(project.endDate, 'date');
  if (project.currency) project.currency = decryptField(project.currency);
  if (project.projectType) project.projectType = decryptField(project.projectType);
  if (project.totalExpense) project.totalExpense = decryptField(project.totalExpense, 'number');
});

// Note: Auto-calculation of expenses from activities will be handled in Activity/SubActivity models
// or via service layer when we create those models

module.exports = Project;
