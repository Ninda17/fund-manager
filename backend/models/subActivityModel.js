const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { encrypt, decrypt } = require("../utils/encryption");
const Activity = require("./activityModel");

const SubActivity = sequelize.define(
  "SubActivity",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    activityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Activity,
        key: "id",
      },
      // Note: Relationships will be defined in models/index.js
    },
    subactivityId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
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
    },
  },
  {
    tableName: "sub_activities",
    timestamps: true,
    indexes: [
      {
        fields: ["activityId"],
      },
      {
        fields: ["subactivityId"],
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
SubActivity.beforeValidate((subActivity) => {
  // Validate budget (before encryption)
  if (subActivity.budget !== undefined && subActivity.budget !== null && subActivity.budget !== '') {
    if (typeof subActivity.budget === 'string' && subActivity.budget.includes(':')) {
      // Already encrypted, skip validation
      return;
    }
    
    const budget = typeof subActivity.budget === 'number' ? subActivity.budget : parseFloat(subActivity.budget);
    
    if (isNaN(budget) || budget < 0) {
      throw new Error("Sub-activity budget cannot be negative");
    }
  }
  
  // Validate expense (before encryption)
  if (subActivity.expense !== undefined && subActivity.expense !== null && subActivity.expense !== '') {
    if (typeof subActivity.expense === 'string' && subActivity.expense.includes(':')) {
      // Already encrypted, skip validation
      return;
    }
    
    const expense = typeof subActivity.expense === 'number' ? subActivity.expense : parseFloat(subActivity.expense);
    
    if (isNaN(expense) || expense < 0) {
      throw new Error("Sub-activity expense cannot be negative");
    }
  }
});

// Encrypt sensitive fields before saving
SubActivity.beforeCreate(async (subActivity) => {
  // Encrypt name
  if (subActivity.name) {
    subActivity.name = encryptField(subActivity.name);
  }
  
  // Encrypt budget (store as string)
  if (subActivity.budget !== undefined && subActivity.budget !== null && subActivity.budget !== '') {
    subActivity.budget = encryptField(subActivity.budget, true);
  } else {
    subActivity.budget = encryptField(0, true); // Default to 0
  }
  
  // Encrypt expense (store as string)
  if (subActivity.expense !== undefined && subActivity.expense !== null && subActivity.expense !== '') {
    subActivity.expense = encryptField(subActivity.expense, true);
  } else {
    subActivity.expense = encryptField(0, true); // Default to 0
  }
});

// Also encrypt on update
SubActivity.beforeUpdate(async (subActivity) => {
  // Only encrypt if field was changed and not already encrypted
  if (subActivity.changed('name') && subActivity.name && !subActivity.name.includes(':')) {
    subActivity.name = encryptField(subActivity.name);
  }
  
  if (subActivity.changed('budget') && subActivity.budget && typeof subActivity.budget !== 'string') {
    subActivity.budget = encryptField(subActivity.budget, true);
  }
  
  if (subActivity.changed('expense') && subActivity.expense && typeof subActivity.expense !== 'string') {
    subActivity.expense = encryptField(subActivity.expense, true);
  }
});

// Decrypt sensitive fields after retrieving
SubActivity.afterFind((subActivities) => {
  if (!subActivities) return;
  
  const decryptSubActivity = (subActivity) => {
    if (!subActivity) return;
    
    // Decrypt name
    if (subActivity.name) {
      subActivity.name = decryptField(subActivity.name);
    }
    
    // Decrypt budget
    if (subActivity.budget) {
      subActivity.budget = decryptField(subActivity.budget, 'number');
    }
    
    // Decrypt expense
    if (subActivity.expense) {
      subActivity.expense = decryptField(subActivity.expense, 'number');
    }
    
    return subActivity;
  };
  
  if (Array.isArray(subActivities)) {
    subActivities.forEach(decryptSubActivity);
  } else {
    decryptSubActivity(subActivities);
  }
});

// Also decrypt after create/update
SubActivity.afterCreate((subActivity) => {
  // Decrypt fields
  if (subActivity.name) subActivity.name = decryptField(subActivity.name);
  if (subActivity.budget) subActivity.budget = decryptField(subActivity.budget, 'number');
  if (subActivity.expense) subActivity.expense = decryptField(subActivity.expense, 'number');
});

// Combined afterUpdate hook: decrypt fields AND update Activity expense
SubActivity.afterUpdate(async (subActivity, options) => {
  // First, decrypt fields
  if (subActivity.name) subActivity.name = decryptField(subActivity.name);
  if (subActivity.budget) subActivity.budget = decryptField(subActivity.budget, 'number');
  if (subActivity.expense) subActivity.expense = decryptField(subActivity.expense, 'number');
  
  // Get activityId - try multiple ways to access it
  let activityId = subActivity.activityId || subActivity.getDataValue?.('activityId');
  
  // If activityId is not available, reload the instance to get it
  if (!activityId && subActivity.id) {
    try {
      const { sequelize } = require("../config/database");
      const [rows] = await sequelize.query(
        `SELECT activityId FROM sub_activities WHERE id = :id`,
        {
          replacements: { id: subActivity.id },
          type: sequelize.QueryTypes.SELECT,
          transaction: options?.transaction,
        }
      );
      if (rows && rows.length > 0 && rows[0].activityId) {
        activityId = rows[0].activityId;
      }
    } catch (err) {
      console.error('Error fetching activityId in SubActivity afterUpdate hook:', err);
    }
  }
  
  if (activityId) {
    try {
      await updateActivityExpense(activityId, options?.transaction);
    } catch (error) {
      console.error('Error updating Activity expense in SubActivity afterUpdate hook:', error);
      // Don't throw - let the update succeed even if expense recalculation fails
      // This prevents blocking the SubActivity update
    }
  }
});

// Auto-calculate Activity expense from sub-activities when sub-activity changes
SubActivity.afterCreate(async (subActivity, options) => {
  // Decrypt fields
  if (subActivity.name) subActivity.name = decryptField(subActivity.name);
  if (subActivity.budget) subActivity.budget = decryptField(subActivity.budget, 'number');
  if (subActivity.expense) subActivity.expense = decryptField(subActivity.expense, 'number');
  
  // Update Activity expense
  if (subActivity.activityId) {
    try {
      await updateActivityExpense(subActivity.activityId, options?.transaction);
    } catch (error) {
      console.error('Error in SubActivity afterCreate hook:', error);
      throw error; // Re-throw for create to ensure data consistency
    }
  }
});

SubActivity.afterDestroy(async (subActivity, options) => {
  await updateActivityExpense(subActivity.activityId, options?.transaction);
});

// Helper function to update Activity expense from sub-activities
const updateActivityExpense = async (activityId, transaction = null) => {
  try {
    if (!activityId) {
      return;
    }

    // Use sequelize.query to avoid circular dependency
    const { sequelize } = require("../config/database");
    const { decrypt, encrypt } = require("../utils/encryption");
    
    // First, get the projectId for this activity
    // QueryTypes.SELECT returns results array directly
    let activityRows = await sequelize.query(
      `SELECT projectId FROM activities WHERE id = :activityId`,
      {
        replacements: { activityId },
        type: sequelize.QueryTypes.SELECT,
        transaction,
      }
    );
    
    // Handle case where query returns empty array (transaction isolation or activity doesn't exist)
    if (!activityRows || !Array.isArray(activityRows) || activityRows.length === 0) {
      // Try again without transaction (Activity should already exist)
      activityRows = await sequelize.query(
        `SELECT projectId FROM activities WHERE id = :activityId`,
        {
          replacements: { activityId },
          type: sequelize.QueryTypes.SELECT,
        }
      );
      
      if (!activityRows || !Array.isArray(activityRows) || activityRows.length === 0) {
        return;
      }
    }
    
    const projectId = activityRows[0]?.projectId;
    if (!projectId) {
      return;
    }
    
    // Get all sub-activities for this activity (within transaction if provided)
    const subActivities = await sequelize.query(
      `SELECT expense FROM sub_activities WHERE activityId = :activityId`,
      {
        replacements: { activityId },
        type: sequelize.QueryTypes.SELECT,
        transaction, // Include transaction if provided
      }
    );
    
    // Decrypt and sum expenses
    let totalExpense = 0;
    if (Array.isArray(subActivities)) {
      subActivities.forEach((sa) => {
        if (sa.expense) {
          const decrypted = typeof sa.expense === 'string' && sa.expense.includes(':')
            ? parseFloat(decrypt(sa.expense)) || 0
            : (typeof sa.expense === 'number' ? sa.expense : parseFloat(sa.expense) || 0);
          totalExpense += decrypted;
        }
      });
    }
    
    // Update Activity expense directly via query to avoid hooks (within transaction if provided)
    const encryptedExpense = encrypt(totalExpense.toString());
    await sequelize.query(
      `UPDATE activities SET expense = :expense WHERE id = :activityId`,
      {
        replacements: { expense: encryptedExpense, activityId },
        type: sequelize.QueryTypes.UPDATE,
        transaction, // Include transaction if provided
      }
    );
    
    // Now update Project totalExpense by summing all activity expenses
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
  } catch (error) {
    console.error('Error updating activity expense:', error);
    // Re-throw error to ensure transaction rollback if needed
    throw error;
  }
};

module.exports = SubActivity;

