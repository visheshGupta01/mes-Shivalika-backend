//Product.js

const mongoose = require("mongoose");

const processSchema = new mongoose.Schema({
  processName: { type: String, required: true },
  entries: [
    {
      date: { type: Date, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  order: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  startDate: { type: Date },
  endDate: { type: Date },
  totalProduction: { type: Number },
  productionPerDayPerMachine: { type: Number, required: false }, // New field
});

const productSchema = new mongoose.Schema({
  image: { type: String, required: false },
  srNo: { type: String, required: false },
  buyer: { type: String, required: false },
  buyerPO: { type: String, required: false },
  color: { type: String, required: false },
  exFactoryDate: { type: Date, required: false },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // Add this field
  styleName: { type: String, required: false },
  size: { type: String, required: false },
  quantity: { type: Number, required: false },
  completed: { type: Boolean, default: false },
  processes: [processSchema],
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
