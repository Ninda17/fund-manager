const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    profileImageUrl: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ["admin", "finance", "program"],
      default: "program",
    },
    isApproved: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ✅ Ensure only one admin exists
userSchema.pre("save", async function (next) {
  if (this.role === "admin") {
    const existingAdmin = await mongoose.model("User").findOne({ role: "admin" });
    if (existingAdmin && existingAdmin._id.toString() !== this._id.toString()) {
      const err = new Error("Only one admin account is allowed");
      return next(err);
    }
    this.isApproved = "approved"; // Auto-approve admin
  }
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
