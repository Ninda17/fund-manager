const ActivityLog = require("../models/activityLogModel");

const logActivity = async ({
  user,
  action,
  entityType,
  entityId,
  metadata = {},
}) => {
  try {
    await ActivityLog.create({
      user: user.id,
      role: user.role,
      email: user.email,
      action,
      entityType,
      entityId,
      metadata,
    });
  } catch (err) {
    console.error("Activity log failed:", err.message);
  }
};

module.exports = logActivity;
