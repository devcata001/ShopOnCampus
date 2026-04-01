const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const header = req.headers["authorization"];
  const bearerToken = header && header.startsWith("Bearer ")
    ? header.split(" ")[1]
    : null;
  const cookieToken = req.cookies?.insidelautech_auth;
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

router.get("/", async (req, res) => {
  try {
    const products = await Product.find().select("-__v");
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    const product = await Product.findById(req.params.id).select("-__v");
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, description, price, category } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        error: "Product name and price are required",
      });
    }

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ error: "Invalid price" });
    }

    const product = new Product({
      name: name.trim(),
      description: description?.trim() || "",
      price,
      category: category?.trim() || "uncategorized",
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    const { name, description, price, category } = req.body;

    if (price !== undefined) {
      if (typeof price !== "number" || price < 0) {
        return res.status(400).json({ error: "Invalid price" });
      }
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (price !== undefined) updates.price = price;
    if (category) updates.category = category.trim();

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

module.exports = router;
