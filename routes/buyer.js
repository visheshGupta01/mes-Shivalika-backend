const express = require("express");
const router = express.Router();
const Buyer = require("../models/Buyer");

// Get all buyers
router.get("/getBuyers", async (req, res) => {
  try {
    const buyers = await Buyer.find();
    res.status(200).json(buyers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new buyer
router.post("/addBuyer", async (req, res) => {
  const { name } = req.body;
  try {
    const existingBuyer = await Buyer.findOne({ name });
    if (existingBuyer) {
      return res.status(400).json({ message: "Buyer already exists" });
    }
    const newBuyer = new Buyer({ name });
    await newBuyer.save();
    res.status(201).json(newBuyer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
