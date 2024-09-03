const mongoose = require("mongoose");

const machineCapacitySchema = new mongoose.Schema({
  processName: {
    type: String,
    required: true,
    unique: true,
  },
  maxMachines: {
    type: Number,
    required: true,
  },
});

const MachineCapacity = mongoose.model(
  "MachineCapacity",
  machineCapacitySchema
);

module.exports = MachineCapacity;
