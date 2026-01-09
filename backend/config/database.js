const { Sequelize } = require("sequelize");

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME || "fund_manager",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "root",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false, // Log SQL queries in development
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Test database connection
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL database connected successfully");
  } catch (err) {
    console.error("❌ Error connecting to MySQL database:", err.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
