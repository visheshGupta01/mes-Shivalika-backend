//product.js

const express = require("express");
const multer = require("multer");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Style = require("../models/Style");
const Buyer = require("../models/Buyer");
const Production = require("../models/Production");
const { parseExcelFile } = require("../utils/excelParser");
const moment = require("moment");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

let tempProducts = []; // Temporary storage for products with new styles


// Function to trim all string fields in an object
const trimObject = (obj) => {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      obj[key] = obj[key].trim();
    }
  }
};
const calculateWeekNumber = (date) => {
  return moment(date).week();
};
// Function to add unique buyers from the imported data
const addUniqueBuyers = async (buyers) => {
  const bulkOps = buyers.map((buyerName) => ({
    updateOne: {
      filter: { name: buyerName.trim() },
      update: { $setOnInsert: { name: buyerName.trim() } },
      upsert: true,
    },
  }));
  await Buyer.bulkWrite(bulkOps);
};

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


// Add a single product
router.post("/addProduct", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Import products from Excel file and handle orders
router.post("/importExcel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const products = await parseExcelFile(req.file.buffer);
    console.log("Parsed Products:", products);

    const stylesToPrompt = new Set();
    const productsToSave = [];
    const orderUpdates = {};
    const uniqueBuyers = new Set();
    const missingProductionData = []; // Array to store missing production data
    for (const product of products) {
  trimObject(product);
      uniqueBuyers.add(product.buyer);
      const existingStyle = await Style.findOne({
        styleName: product.styleName,
      });

      if (existingStyle) {
        product.processes = await Promise.all(
          existingStyle.processes.map(async (proc) => {
            let productionPerDayPerMachine = 0;
            const existingProcess = await Production.findOne({
              processName: proc.processName.trim(),
              "sizes.size": product.size.trim(), // Check if the process has production for this size
            });
console.log(existingProcess)
            if (existingProcess) {
              const sizeObj = existingProcess.sizes.find(
                (s) => s.size === product.size.trim()
              );
              if (sizeObj) {
                console.log(sizeObj.productionPerDayPerMachine);
                productionPerDayPerMachine = sizeObj.productionPerDayPerMachine;
              }
            } else {
              // If no existing process is found, store the process name and size
              missingProductionData.push({
                processName: proc.processName.trim(),
                size: product.size.trim(),
              });
            }

            return {
              processName: proc.processName.trim(),
              entries: [],
              order: proc.order,
              completed: false,
              totalProduction: 0,
              productionPerDayPerMachine: productionPerDayPerMachine || null, // Only set if a value exists, otherwise set to null
            };
          })
        );

        // Calculate process dates
        calculateProcessDates(product);
        productsToSave.push(product);
      } else {
        stylesToPrompt.add(product.styleName);
        tempProducts.push(product); // Store the product temporarily
      }
    }

    // Log or handle the missing production data as needed
    if (missingProductionData.length > 0) {
      console.log(
        "Missing production data for the following processes and sizes:",
        missingProductionData
      );
      // You could also store this data in a database, or send a response to the client, etc.
    }

    // Add unique buyers to the database
    await addUniqueBuyers(Array.from(uniqueBuyers));

    for (const product of productsToSave) {
      const newProduct = new Product(product);
      await newProduct.save();

      if (!orderUpdates[product.srNo]) {
        orderUpdates[product.srNo] = {
          srNo: product.srNo,
          buyer: product.buyer,
          buyerPO: product.buyerPO,
          week: calculateWeekNumber(product.exFactoryDate), // Add week number
          completed: false,
          exFactoryDate: product.exFactoryDate,
          products: [],
        };
      }

      orderUpdates[product.srNo].products.push({
        productId: newProduct._id,
        quantity: product.quantity,
        status: "Pending",
      });
    }

    // Save orders
    const orderPromises = Object.values(orderUpdates).map(async (orderData) => {
      let order = await Order.findOne({ srNo: orderData.srNo });
      if (order) {
        order.completed = false
        order.products = [...order.products, ...orderData.products];
      } else {
        order = new Order(orderData);
      }
      await order.save();
    });

    await Promise.all(orderPromises);

    // Check for styles needing processes
    if (stylesToPrompt.size > 0) {
      return res.status(200).json({
        message:
          "New styles detected. Please submit processes for these styles.",
        styles: Array.from(stylesToPrompt),
      });
    }

    res
      .status(201)
      .json({ message: "Products and orders imported successfully" });
  } catch (error) {
    console.error("Error importing Excel file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add a new order or update an existing order
router.post("/addOrder", async (req, res) => {
  try {
    const { srNo, buyer, products } = req.body;

    const productIds = products.map((p) => p.productId);
    const foundProducts = await Product.find({ _id: { $in: productIds } });

    if (foundProducts.length !== products.length) {
      return res.status(400).json({ error: "Some products not found" });
    }

    let order = await Order.findOne({ srNo });

    if (order) {
      order.products = [...order.products, ...products];
      await order.save();
    } else {
      order = new Order({ srNo, buyer, products });
      await order.save();
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get orders
router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().populate("products.productId");
    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add styles and processes
router.post("/addStyleProcesses", async (req, res) => {
  try {
    const { styles} = req.body; // Expecting addLater flag in the request
    const orderUpdates = {};
    const missingProductionData = [];

      for (const style of styles) {
        const newStyle = new Style(style);
        await newStyle.save();
      }

      for (const product of tempProducts) {
        const existingStyle = await Style.findOne({
          styleName: product.styleName,
        });

        if (existingStyle) {
          product.processes = await Promise.all(
            existingStyle.processes.map(async (proc) => {
              let productionPerDayPerMachine = 0;
              const existingProcess = await Production.findOne({
                processName: proc.processName.trim(),
                "sizes.size": product.size.trim(),
              });

              if (existingProcess) {
                const sizeObj = existingProcess.sizes.find(
                  (s) => s.size === product.size.trim()
                );
                if (sizeObj) {
                  productionPerDayPerMachine = sizeObj.productionPerDayPerMachine;
                }
              } else {
                // Store missing production data
                missingProductionData.push({
                  processName: proc.processName.trim(),
                  size: product.size.trim(),
                });
              }

              return {
                processName: proc.processName.trim(),
                entries: [],
                order: proc.order,
                completed: false,
                totalProduction: 0,
                productionPerDayPerMachine: productionPerDayPerMachine || null,
              };
            })
          );

          // Calculate process dates
          calculateProcessDates(product);

          const newProduct = new Product(product);
          await newProduct.save();

          if (!orderUpdates[product.srNo]) {
            orderUpdates[product.srNo] = {
              srNo: product.srNo,
              buyer: product.buyer,
              buyerPO: product.buyerPO,
              week: calculateWeekNumber(product.exFactoryDate),
              completed: false,
              exFactoryDate: product.exFactoryDate,
              products: [],
            };
          }

          orderUpdates[product.srNo].products.push({
            productId: newProduct._id,
            quantity: product.quantity,
            status: "Pending",
          });
        }
      }

    const orderPromises = Object.values(orderUpdates).map(async (orderData) => {
      let order = await Order.findOne({ srNo: orderData.srNo });
      if (order) {
        order.completed = false;
        order.products = [...order.products, ...orderData.products];
      } else {
        order = new Order(orderData);
      }
      await order.save();
    });

    await Promise.all(orderPromises);

    // Log or handle missing production data as needed
    if (missingProductionData.length > 0) {
      console.log(
        "Missing production data for the following processes and sizes:",
        missingProductionData
      );
    }

    // Clear the temporary storage
    tempProducts = [];

    res.status(201).json({
      message: "Styles, processes, products, and orders saved successfully",
    });
  } catch (error) {
    console.error("Error in adding style processes:", error.message);
    res
      .status(400)
      .json({ error: "Failed to save style processes and products" });
  }
});


router.get("/sortedOrders", async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ exFactoryDate: 1 }) // Sort by exFactoryDate in ascending order
      .populate("products.productId");

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching sorted orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// In your Express backend
router.post("/getProductDetails", async (req, res) => {
  const { ids } = req.body;
  try {
    const products = await Product.find({ _id: { $in: ids } });
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

module.exports = router;
