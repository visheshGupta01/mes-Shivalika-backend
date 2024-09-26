const express = require("express");
const router = express.Router();
const Style = require("../models/Style");
const Production = require("../models/Production");
const Product = require("../models/Product"); // Assuming Product schema is defined
const moment = require("moment");


const calculateProcessDates = (product, importDate) => {
  if (!product.exFactoryDate) {
    throw new Error(
      `Ex-Factory Date is missing for product with Sr No: ${product.srNo}`
    );
  }

  const processes = product.processes.sort((a, b) => b.order - a.order); // Start from last process
  let currentEndDate = moment(product.exFactoryDate);

  // Assign end dates starting from the ex-factory date and move backward
  processes.forEach((process) => {
    process.endDate = currentEndDate.toDate();

    // Move to the previous process, subtracting 5 days between them
    currentEndDate = currentEndDate.clone().subtract(5, "days");
  });

  // Assign start dates beginning from the import date and move forward
  let currentStartDate = moment(importDate);
  processes.reverse().forEach((process) => {
    process.startDate = currentStartDate.toDate();

    // Move to the next process, adding 5 days between them
    currentStartDate = currentStartDate.clone().add(5, "days");
  });

  // Sort processes back to their original order
  product.processes = processes.sort((a, b) => a.order - b.order);
};
// Submit processes for a style and update all products with that style
router.post("/submitProcesses", async (req, res) => {
  try {
    const { styleName, processes } = req.body;

    if (!styleName || !processes || processes.length === 0) {
      return res.status(400).json({ error: "Style name or processes missing" });
    }

    // Step 1: Check if style exists
    let existingStyle = await Style.findOne({ styleName });
    if (!existingStyle) {
      console.log(styleName);

      // Create new style if it doesn't exist
      existingStyle = new Style({
        styleName,
        processes: [],
      });
    }

    // Step 2: Update the processes in the Style collection
    existingStyle.processes = processes.map((proc, index) => ({
      processName: proc.processName.trim(),
      order: index + 1, // Assign order based on the sequence in the array
    }));

    // Save the updated or newly created style
    await existingStyle.save();

    // Step 3: Find all products with the given styleName
    const productsToUpdate = await Product.find({ styleName });
    if (productsToUpdate.length === 0) {
      return res
        .status(404)
        .json({ error: `No products found for style ${styleName}` });
    }

    const missingProductionData = [];

    // Step 4: Update each product with the new processes and check for productionPerDayPerMachine
    for (let product of productsToUpdate) {
      product.processes = await Promise.all(
        processes.map(async (proc) => {
          let productionPerDayPerMachine = 0;

          // Check if production data is available for the process and product size
          const existingProduction = await Production.findOne({
            processName: proc.processName.trim(),
            "sizes.size": product.size.trim(),
          });

          if (existingProduction) {
            const sizeObj = existingProduction.sizes.find(
              (s) => s.size === product.size.trim()
            );
            if (sizeObj) {
              productionPerDayPerMachine = sizeObj.productionPerDayPerMachine;
            }
          } else {
            // If no existing production data is found, log the missing info
            missingProductionData.push({
              processName: proc.processName.trim(),
              size: product.size.trim(),
            });
          }

          return {
            processName: proc.processName.trim(),
            entries: [],
            order: proc.order, // Order from the process data
            completed: false,
            totalProduction: 0,
            productionPerDayPerMachine: productionPerDayPerMachine || null, // Assign productionPerDayPerMachine if found
          };
        })
      );
        calculateProcessDates(product);

      // Save the updated product
      await product.save();
    }

    // Step 5: Return response
    if (missingProductionData.length > 0) {
      console.log(
        "Missing production data for processes and sizes:",
        missingProductionData
      );
      return res.status(200).json({
        message:
          "Processes submitted successfully, but some production data is missing.",
        missingProductionData,
      });
    }

    res.status(200).json({
      message:
        "Processes submitted, styles updated, and products updated successfully",
    });
  } catch (error) {
    console.error("Error submitting processes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET styles
router.get("/styles", async (req, res) => {
  try {
    console.log("Thiswascalled");
    const styles = await Style.find();
    res.json(styles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET productions
router.get("/productions", async (req, res) => {
  try {
    const productions = await Production.find();
    res.json(productions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
