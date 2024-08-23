const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Production = require("../models/Production");
const Order = require("../models/Order");

// Get all products
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
      res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update production entry for a specific product
router.put("/:id/process/:processId", async (req, res) => {
  try {
    const { id, processId } = req.params;
    const { date, quantity } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const process = product.processes.id(processId);
    if (!process) {
      return res.status(404).json({ message: "Process not found" });
    }

    const entryIndex = process.entries.findIndex(
      (entry) => entry.date.toISOString() === new Date(date).toISOString()
    );

    if (entryIndex !== -1) {
      process.entries[entryIndex].quantity = quantity;
    } else {
      process.entries.push({ date: new Date(date), quantity });
    }

    // Recalculate total production
    process.totalProduction = process.entries.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    );

    // Update the 'completed' status based on total production vs quantity required
    if (process.totalProduction >= product.quantity) {
      process.completed = true;
    } else {
      process.completed = false;
    }

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post("/addProduction", async (req, res) => {
  const { processName, productionData } = req.body;

  try {
    // Find the existing process document
    let production = await Production.findOne({ processName });

    if (!production) {
      // If the process doesn't exist, create a new one
      production = new Production({ processName, sizes: [] });
    }

    for (const [size, value] of Object.entries(productionData)) {

      // Find the index of the size in the sizes array
      const sizeIndex = production.sizes.findIndex((s) => s.size === size);

      if (sizeIndex !== -1) {
        // If the size exists, update it
        production.sizes[sizeIndex].productionPerDayPerMachine = value;
      } else {
        // If the size does not exist, add a new entry
        production.sizes.push({
          size,
          productionPerDayPerMachine: value,
        });
      }
    }

    await production.save();
    res.status(200).json({ message: "Production data saved successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/updateProductionPerDayPerMachine", async (req, res) => {
  const { filteredProductsBySizes, processName, productionPerDayPerMachine } = req.body;
 try {
    for (const productData of filteredProductsBySizes) {
      const product = await Product.findById(productData._id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const process = product.processes.find(
        (p) => p.processName === processName
      );

      if (!process) return res.status(404).json({ message: "Process not found" });

      process.productionPerDayPerMachine = productionPerDayPerMachine;

      await product.save();
    }

    res.status(200).json({ message: "Production per day per machine updated successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update production per day per machine",
      error,
    });
  }
});

router.post("/updateProcessStatus", async (req, res) => {
  const { productId} = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Check if all processes are completed
    const allCompleted = product.processes.every(
      (p) => p.completed === true
    );

    if (allCompleted) {
      product.completed = true; // Update product status
      const order = await Order.findOne({ "products.productId": productId });

      if (!order) {
        console.error("No order found containing the product");
        return;
      }
      console.log("Order: ", order);
      order.products = order.products.map((product) =>
        product.productId.equals(productId)
          ? { ...product, completed: true }
          : product
      );

      // Save the updated order
      await order.save();
      console.log(
        `Updated product status to "Completed" in order ${order._id}`
      );

    }
    else {
      product.completed = false;
    }

    await product.save();

    res
      .status(200)
      .json({ message: "Process and product status updated successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update process and product status",
      error,
    });
  }
});


router.post("/updateOrderStatus", async (req, res) => {
  const { productId } = req.body;
  console.log("Running Order Update")
  console.log("productId: ", productId)
  try {
    // Find the order that contains the product
    const order = await Order.findOne({ "products.productId": productId });

    if (!order) {
      console.error("No order found containing the product");
      return;
    }
console.log("Order: ", order)
    // Check if all products in the order are completed
    const allCompleted = order.products.every(
      (product) => product.completed === true
    );

    if (allCompleted) {
      // Set the order's status to "Completed"
      order.completed = true;
      await order.save();
      console.log(`Order ${order._id} is now marked as completed`);
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to update process and product status",
      error,
    });
  }
});


module.exports = router;
