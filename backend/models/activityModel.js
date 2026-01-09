const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { encrypt, decrypt } = require("../utils/encryption");
const Project = require("./projectModel");

const Activity = sequelize.define(
  "Activity",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Project,
        key: "id",
      },
      // Note: Relationships will be defined in models/index.js
    },
    activityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: true,
      // Will be encrypted in hooks
    },
    description: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: true,
      // Will be encrypted in hooks
    },
    budget: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: true,
      defaultValue: "0",
      // Will be encrypted in hooks (stored as encrypted string, decrypted to number when retrieved)
    },
    expense: {
      type: DataTypes.TEXT, // Store as TEXT since encrypted values are strings
      allowNull: true,
      defaultValue: "0",
      // Will be encrypted in hooks (stored as encrypted string, decrypted to number when retrieved)
      // Note: Expense is calculated from sub-activities in hooks
    },
    projectStatus: {
      type: DataTypes.ENUM("Not Started", "In Progress", "Completed"),
      allowNull: false,
      defaultValue: "Not Started",
    },
    // Note: subActivities[] will be in separate SubActivity table
  },
  {
    tableName: "activities",
    timestamps: true,
    indexes: [
      {
        fields: ["projectId"],
      },
      {
        fields: ["activityId"],
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
      throw new Error(`Invalid number value`);
    }
    stringValue = numValue.toString();
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
    }
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedValue; // Return as-is if decryption fails
  }
};

// Validate numeric fields before encryption
Activity.beforeValidate((activity) => {
  // Validate budget (before encryption)
  if (activity.budget !== undefined && activity.budget !== null && activity.budget !== '') {
    if (typeof activity.budget === 'string' && activity.budget.includes(':')) {
      // Already encrypted, skip validation
      return;
    }
    
    const budget = typeof activity.budget === 'number' ? activity.budget : parseFloat(activity.budget);
    
    if (isNaN(budget) || budget < 0) {
      throw new Error("Activity budget cannot be negative");
    }
  }
  
  // Validate expense (before encryption)
  if (activity.expense !== undefined && activity.expense !== null && activity.expense !== '') {
    if (typeof activity.expense === 'string' && activity.expense.includes(':')) {
      // Already encrypted, skip validation
      return;
    }
    
    const expense = typeof activity.expense === 'number' ? activity.expense : parseFloat(activity.expense);
    
    if (isNaN(expense) || expense < 0) {
      throw new Error("Activity expense cannot be negative");
    }
  }
});

// Encrypt sensitive fields before saving
Activity.beforeCreate(async (activity) => {
  // Encrypt name
  if (activity.name) {
    activity.name = encryptField(activity.name);
  }
  
  // Encrypt description
  if (activity.description) {
    activity.description = encryptField(activity.description);
  }
  
  // Encrypt budget (store as string)
  if (activity.budget !== undefined && activity.budget !== null && activity.budget !== '') {
    activity.budget = encryptField(activity.budget, true);
  } else {
    activity.budget = encryptField(0, true); // Default to 0
  }
  
  // Encrypt expense (store as string)
  if (activity.expense !== undefined && activity.expense !== null && activity.expense !== '') {
    activity.expense = encryptField(activity.expense, true);
  } else {
    activity.expense = encryptField(0, true); // Default to 0
  }
});

// Also encrypt on update
Activity.beforeUpdate(async (activity) => {
  // Only encrypt if field was changed and not already encrypted
  if (activity.changed('name') && activity.name && !activity.name.includes(':')) {
    activity.name = encryptField(activity.name);
  }
  
  if (activity.changed('description') && activity.description && !activity.description.includes(':')) {
    activity.description = encryptField(activity.description);
  }
  
  if (activity.changed('budget') && activity.budget && typeof activity.budget !== 'string') {
    activity.budget = encryptField(activity.budget, true);
  }
  
  if (activity.changed('expense') && activity.expense && typeof activity.expense !== 'string') {
    activity.expense = encryptField(activity.expense, true);
  }
});

// Decrypt sensitive fields after retrieving
Activity.afterFind((activities) => {
  if (!activities) return;
  
  const decryptActivity = (activity) => {
    if (!activity) return;
    
    // Decrypt name
    if (activity.name) {
      activity.name = decryptField(activity.name);
    }
    
    // Decrypt description
    if (activity.description) {
      activity.description = decryptField(activity.description);
    }
    
    // Decrypt budget
    if (activity.budget) {
      activity.budget = decryptField(activity.budget, 'number');
    }
    
    // Decrypt expense
    if (activity.expense) {
      activity.expense = decryptField(activity.expense, 'number');
    }
    
    return activity;
  };
  
  if (Array.isArray(activities)) {
    activities.forEach(decryptActivity);
  } else {
    decryptActivity(activities);
  }
});

// Also decrypt after create/update
Activity.afterCreate((activity) => {
  // Decrypt fields
  if (activity.name) activity.name = decryptField(activity.name);
  if (activity.description) activity.description = decryptField(activity.description);
  if (activity.budget) activity.budget = decryptField(activity.budget, 'number');
  if (activity.expense) activity.expense = decryptField(activity.expense, 'number');
});

Activity.afterUpdate((activity) => {
  // Decrypt fields
  if (activity.name) activity.name = decryptField(activity.name);
  if (activity.description) activity.description = decryptField(activity.description);
  if (activity.budget) activity.budget = decryptField(activity.budget, 'number');
  if (activity.expense) activity.expense = decryptField(activity.expense, 'number');
});

// Auto-update Project totalExpense when Activity expense changes
Activity.afterUpdate(async (activity, options) => {
  // Only update Project totalExpense if expense changed
  if (activity.changed('expense') && activity.projectId) {
    await updateProjectExpense(activity.projectId, options?.transaction);
  }
});

Activity.afterCreate(async (activity, options) => {
  // Update Project totalExpense when new activity is created
  if (activity.projectId) {
    await updateProjectExpense(activity.projectId, options?.transaction);
  }
});

Activity.afterDestroy(async (activity, options) => {
  // Update Project totalExpense when activity is deleted
  if (activity.projectId) {
    await updateProjectExpense(activity.projectId, options?.transaction);
  }
});

// Helper function to update Project totalExpense from activities
const updateProjectExpense = async (projectId, transaction = null) => {
  try {
    if (!projectId) {
      return;
    }

    // Use sequelize.query to avoid circular dependency
    const { sequelize } = require("../config/database");
    const { decrypt, encrypt } = require("../utils/encryption");
    
    // Get all activities for this project
    const [allActivities] = await sequelize.query(
      `SELECT expense FROM activities WHERE projectId = :projectId`,
      {
        replacements: { projectId },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );
    
    // Decrypt and sum all activity expenses
    let projectTotalExpense = 0;
    if (Array.isArray(allActivities)) {
      allActivities.forEach((act) => {
        if (act.expense) {
          const decrypted = typeof act.expense === 'string' && act.expense.includes(':')
            ? parseFloat(decrypt(act.expense)) || 0
            : (typeof act.expense === 'number' ? act.expense : parseFloat(act.expense) || 0);
          projectTotalExpense += decrypted;
        }
      });
    }
    
    // Update Project totalExpense
    const encryptedProjectExpense = encrypt(projectTotalExpense.toString());
    await sequelize.query(
      `UPDATE projects SET totalExpense = :totalExpense WHERE id = :projectId`,
      {
        replacements: { totalExpense: encryptedProjectExpense, projectId },
        type: sequelize.QueryTypes.UPDATE,
        transaction,
      }
    );
    
    // Log for debugging (remove in production if too verbose)
  } catch (error) {
    console.error('Error updating project totalExpense:', error);
    // Re-throw error to ensure transaction rollback if needed
    throw error;
  }
};

// Export the helper function so it can be used by SubActivity model
Activity.updateProjectExpense = updateProjectExpense;

// Note: Auto-calculation of expense from sub-activities will be handled in SubActivity model hooks
// SubActivity hooks will call updateActivityExpense which also updates Project totalExpense

module.exports = Activity;

