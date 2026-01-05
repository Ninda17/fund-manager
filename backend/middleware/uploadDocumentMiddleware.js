const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage for documents
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-word.document.macroEnabled.12",
    "application/pdf"
  ];
  
  const allowedExtensions = [".doc", ".docx", ".pdf"];
  const fileExtension = file.originalname.substring(file.originalname.lastIndexOf(".")).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error("Only .doc, .docx, and .pdf files are allowed"), false);
  }
};

const uploadDocumentMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

const uploadDocument = uploadDocumentMulter.single("document");

// Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: "fundmanager/documents",
      resource_type: "raw",
      public_id: `${Date.now()}-${originalname.replace(/\.[^/.]+$/, "")}`,
    };

    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url || result.url);
        }
      }
    ).end(buffer);
  });
};

module.exports = { uploadDocument, uploadToCloudinary };

