const jwt = require("jsonwebtoken")
const User = require("../models/userModel")

//middleware to protect routes
const protect = async (req, res, next) => {
    try {
        let token = req.headers.authorization;

        if (token && token.startsWith("Bearer")) {
            token = token.split(" ")[1]; //extract token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Sequelize: findByPk instead of findById, attributes exclude instead of select
            req.user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });
            if (!req.user) {
                return res.status(401).json({message: "User not found"});
            }
            next();
        } else {
            res.status(401).json({message: "Not authorized"})
        }

    } catch (error) {
        res.status(401).json({message: "Token failed", error: error.message})
    }
}

// middleware for admin only access
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role == 'admin') {
        next()
    } else {
        res.status(403).json({message: "access denied .. admin only"})
    }
}

// Middleware to check if user has program role
const financeOnly = (req, res, next) => {
  if (req.user && req.user.role === "finance") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Finance role only.",
    });
  }
};

// Middleware to check if user has program role
const programOnly = (req, res, next) => {
  if (req.user && req.user.role === "program") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Program role only.",
    });
  }
};


module.exports={
    protect, 
    adminOnly,
    financeOnly,
    programOnly
}

