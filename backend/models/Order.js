const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
        productId: { type: String, default: "" },
        name: { type: String, required: true, trim: true },
        category: { type: String, default: "", trim: true },
        image: { type: String, default: "", trim: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    total: { type: Number, required: true },
    paymentRef: { type: String, default: "", trim: true },
    deliveryCode: { type: String, required: true },
    status: { type: String, default: "pending" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
