const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const jwt = require("jsonwebtoken");

const generateDeliveryCode = () => {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
};

// Auth middleware
function auth(req, res, next) {
  const header = req.headers["authorization"];
  const bearerToken = header && header.startsWith("Bearer ")
    ? header.split(" ")[1]
    : null;
  const cookieToken = req.cookies?.shoponcampus_auth;
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: "No authorization token" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// Create order (protected)
router.post("/", auth, async (req, res) => {
  try {
    const { products, paymentRef } = req.body;

    // Input validation
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        error: "Order must contain at least one product",
      });
    }

    // Validate and sanitize product snapshots from cart
    const sanitizedProducts = [];
    let total = 0;

    for (const item of products) {
      const quantity = Number(item.quantity);
      const price = Number(item.price);

      if (!item.name || !Number.isFinite(quantity) || !Number.isFinite(price)) {
        return res.status(400).json({
          error: "Each product must include name, price, and quantity",
        });
      }

      if (quantity < 1) {
        return res.status(400).json({ error: "Invalid product quantity" });
      }

      if (price < 0) {
        return res.status(400).json({ error: "Invalid product price" });
      }

      const subtotal = price * quantity;
      total += subtotal;

      sanitizedProducts.push({
        productId: String(item.id || item.product || ""),
        name: String(item.name || "").trim(),
        category: String(item.category || "").trim(),
        image: String(item.image || "").trim(),
        quantity,
        price,
      });
    }

    // Limit order total for fraud prevention
    if (total > 1000000) {
      return res.status(400).json({
        error: "Order total exceeds maximum allowed",
      });
    }

    const order = new Order({
      user: req.user.id,
      products: sanitizedProducts,
      total,
      paymentRef: String(paymentRef || "").trim(),
      deliveryCode: generateDeliveryCode(),
    });

    await order.save();
    res.status(201).json(order);
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Get all orders for user (protected)
router.get("/", auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get single order (protected - user can only view own orders)
router.get("/:id", auth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id, // Ensure user can only access own orders
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    console.error("Error fetching order:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

module.exports = router;
