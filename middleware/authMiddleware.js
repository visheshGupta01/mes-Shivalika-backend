const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  console.log("Token received:", token); // Log the received token

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded); // Log decoded token

    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.userType !== "Admin") {
      return res.status(403).json({ message: "Not authorized as admin" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error); // Log error
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { verifyAdmin };
