const multer = require("multer");
const cloudinary = require("cloudinary");
const cloudinaryStorage = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage for multer (factory function)
const storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: "fundmanager", // Optional: folder in Cloudinary
  allowedFormats: ["jpeg", "jpg", "png", "gif", "webp"],
  transformation: [
    {
      width: 1000,
      height: 1000,
      crop: "limit", // Limit dimensions without cropping
      quality: "auto", // Auto optimize quality
    },
  ],
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only .jpeg .png .jpg .gif .webp are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = upload;
