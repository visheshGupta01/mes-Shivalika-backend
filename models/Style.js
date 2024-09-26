const mongoose = require("mongoose");

const processSchema = new mongoose.Schema({
  processName: { type: String, required: true },
  order: { type: Number, required: true },
});

const styleSchema = new mongoose.Schema({
  styleName: { type: String, required: true, unique: true },
  processes: [processSchema],
});
    
const Style = mongoose.model("Style", styleSchema);

module.exports = Style;
