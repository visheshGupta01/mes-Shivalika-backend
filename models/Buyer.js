const mongoose = require("mongoose");

const buyerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
  }
);

buyerSchema.index({ name: 1 }); // Adding an index for the name field

module.exports = mongoose.model("Buyer", buyerSchema);
