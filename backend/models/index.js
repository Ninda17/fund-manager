const { sequelize } = require("../config/database");

// Import all models (this loads them into Sequelize)
const User = require("./userModel");
const OTP = require("./otpModel");
const Project = require("./projectModel");
const Activity = require("./activityModel");
const SubActivity = require("./subActivityModel");
const ProjectDocument = require("./projectDocumentModel");
const ActivityLog = require("./activityLogModel");
const ReallocationRequest = require("./reallocationRequestModel");

// ============================================
// Define Relationships (Associations)
// ============================================

// User Relationships
// User hasMany Projects (as programPersonnel)
User.hasMany(Project, {
  foreignKey: "programPersonnelId",
  as: "programProjects", // Alias for program personnel projects
  onDelete: "RESTRICT", // Prevent deletion if user has projects
});

// User hasMany Projects (as financePersonnel)
User.hasMany(Project, {
  foreignKey: "financePersonnelId",
  as: "financeProjects", // Alias for finance personnel projects
  onDelete: "RESTRICT", // Prevent deletion if user has projects
});

// Project Relationships
// Project belongsTo User (programPersonnel)
Project.belongsTo(User, {
  foreignKey: "programPersonnelId",
  as: "programPersonnel", // Alias matches the field name
});

// Project belongsTo User (financePersonnel)
Project.belongsTo(User, {
  foreignKey: "financePersonnelId",
  as: "financePersonnel", // Alias matches the field name
});

// Project hasMany Activities
Project.hasMany(Activity, {
  foreignKey: "projectId",
  as: "activities",
  onDelete: "CASCADE", // Delete activities when project is deleted
});

// Project hasMany ProjectDocuments
Project.hasMany(ProjectDocument, {
  foreignKey: "projectId",
  as: "documents",
  onDelete: "CASCADE", // Delete documents when project is deleted
});

// Activity Relationships
// Activity belongsTo Project
Activity.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// Activity hasMany SubActivities
Activity.hasMany(SubActivity, {
  foreignKey: "activityId",
  as: "subActivities",
  onDelete: "CASCADE", // Delete sub-activities when activity is deleted
});

// SubActivity Relationships
// SubActivity belongsTo Activity
SubActivity.belongsTo(Activity, {
  foreignKey: "activityId",
  as: "activity",
});

// ProjectDocument Relationships
// ProjectDocument belongsTo Project
ProjectDocument.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// ActivityLog Relationships
// ActivityLog belongsTo User
ActivityLog.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// User hasMany ActivityLogs
User.hasMany(ActivityLog, {
  foreignKey: "userId",
  as: "activityLogs",
  onDelete: "CASCADE", // Delete logs when user is deleted (optional, you might want RESTRICT)
});

// ReallocationRequest Relationships
// ReallocationRequest belongsTo User (requestedBy)
ReallocationRequest.belongsTo(User, {
  foreignKey: "requestedById",
  as: "requestedBy",
});

// ReallocationRequest belongsTo User (approvedBy) - optional
ReallocationRequest.belongsTo(User, {
  foreignKey: "approvedById",
  as: "approvedBy",
});

// ReallocationRequest belongsTo Project (sourceProject) - optional
ReallocationRequest.belongsTo(Project, {
  foreignKey: "sourceProjectId",
  as: "sourceProject",
});

// ReallocationRequest belongsTo Project (destinationProject) - optional
ReallocationRequest.belongsTo(Project, {
  foreignKey: "destinationProjectId",
  as: "destinationProject",
});

// ReallocationRequest belongsTo Project (project - for activity reallocations) - optional
ReallocationRequest.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

// User hasMany ReallocationRequests (as requester)
User.hasMany(ReallocationRequest, {
  foreignKey: "requestedById",
  as: "reallocationRequests",
  onDelete: "CASCADE", // Delete requests when user is deleted
});

// User hasMany ReallocationRequests (as approver) - optional
User.hasMany(ReallocationRequest, {
  foreignKey: "approvedById",
  as: "approvedReallocationRequests",
  onDelete: "SET NULL", // Set to null if approver is deleted
});

// Project hasMany ReallocationRequests (as source)
Project.hasMany(ReallocationRequest, {
  foreignKey: "sourceProjectId",
  as: "sourceReallocationRequests",
  onDelete: "CASCADE", // Delete requests when source project is deleted
});

// Project hasMany ReallocationRequests (as destination)
Project.hasMany(ReallocationRequest, {
  foreignKey: "destinationProjectId",
  as: "destinationReallocationRequests",
  onDelete: "CASCADE", // Delete requests when destination project is deleted
});

// Project hasMany ReallocationRequests (for activity reallocations)
Project.hasMany(ReallocationRequest, {
  foreignKey: "projectId",
  as: "reallocationRequests",
  onDelete: "CASCADE", // Delete requests when project is deleted
});

// Sync database function (creates tables)
const syncDB = async () => {
  try {
    // Sync all models (create tables if they don't exist)
    await sequelize.sync({ alter: false }); // alter: false = safe, won't modify existing tables
    console.log("✅ Database tables synced successfully");
  } catch (err) {
    console.error("❌ Error syncing database:", err.message);
    throw err;
  }
};

module.exports = {
  sequelize,
  User,
  OTP,
  Project,
  Activity,
  SubActivity,
  ProjectDocument,
  ActivityLog,
  ReallocationRequest,
  syncDB,
};

