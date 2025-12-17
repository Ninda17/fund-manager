const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "finance", "program"],
      required: true,
    },
    email: String,

    action: {
      type: String,
      required: true,
    },

    entityType: {
      type: String, // project, activity, subactivity, reallocation
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    metadata: Object, // optional extra info
  },
  { timestamps: true } // ✅ gives date & time automatically
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
