const express = require("express");
const router = express.Router();
const { register, login, getUserProfile, updateUserProfile, updatePassword, requestPasswordReset, verifyOTPAndResetPassword, verifyEmail, resendVerificationEmail } = require("../controllers/authController");
const { uploadDocument: uploadDocumentController } = require("../controllers/programController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { uploadDocument: uploadDocumentMiddleware } = require("../middleware/uploadDocumentMiddleware");

// Register route
router.post("/register", register);

// Login route
router.post("/login", login);

// Get user profile (protected)
router.get("/profile", protect, getUserProfile);

// Update user profile (protected)
router.put("/profile", protect, updateUserProfile);

// Update password (protected)
router.put("/update-password", protect, updatePassword);

// Upload profile image route
router.post("/upload-image", upload.single("image"), (req, res) => {
    if(!req.file){
        return res.status(400).json({ 
            success: false,
            message: "No file uploaded"
        });
    }
    // Cloudinary returns the URL in req.file.secure_url or req.file.url
    const imageUrl = req.file.secure_url || req.file.url;
    res.status(200).json({ 
        success: true,
        imageUrl 
    });
});

// Upload document route (protected)
router.post("/upload-document", protect, (req, res, next) => {
    uploadDocumentMiddleware(req, res, (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({
                success: false,
                message: err.message || "File upload error. Please check file type and size.",
            });
        }
        next();
    });
}, uploadDocumentController);

// Forgot password routes
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", verifyOTPAndResetPassword);

// Email verification routes
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

module.exports = router;

