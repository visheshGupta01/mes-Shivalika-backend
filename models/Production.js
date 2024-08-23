const mongoose = require("mongoose");

const productionSchema = new mongoose.Schema({
  processName: { type: String, required: true },
  sizes: [
    {
      size: { type: String },
      productionPerDayPerMachine: { type: Number, required: true },
    },
  ],
});

const Production = mongoose.model("Production", productionSchema);

module.exports = Production;
