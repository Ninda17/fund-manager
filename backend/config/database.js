const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL); // no extra options needed
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Error connecting to db", err);
    process.exit(1);
  }
};

module.exports = connectDB;
