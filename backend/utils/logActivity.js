// utils/logActivity.js - FINAL PRODUCTION VERSION
const { ActivityLog } = require("../models");

const logActivity = async ({
  user,
  action,
  entityType,
  entityId,
  description = "",
  metadata = {},
}) => {
  try {
    // Prepare data for log
    const logData = {
      userId: user.id || user._id, // Sequelize uses 'id', Mongoose uses '_id'
      userName: user.name || "Unknown User",
      userEmail: user.email || "unknown@example.com",
      userRole: user.role || "unknown",
      action: action,
      entityType: entityType,
      entityId: entityId ? entityId.toString() : "unknown",
      description: description,
      metadata: metadata,
      timestamp: new Date(),
    };

    // Create the log
    const activityLog = await ActivityLog.create(logData);

    return activityLog;
  } catch (error) {
    console.error("Failed to create activity log:", error.message);
    // Don't throw - logging shouldn't break main functionality
    return null;
  }
};

module.exports = logActivity;
