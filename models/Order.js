    const mongoose = require("mongoose");

    const orderSchema = new mongoose.Schema({
      srNo: { type: String, required: true, unique: true },
      buyer: { type: String, required: true },
      buyerPO: { type: String, required: false },
      exFactoryDate: { type: Date, required: true },
      week: { type: Number, required: false },
      completed: { type: Boolean, default: false },
      products: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          quantity: { type: Number, required: true },
          completed: { type: Boolean, default: false },
        },
      ],
    });

    const Order = mongoose.model("Order", orderSchema);

    module.exports = Order;
