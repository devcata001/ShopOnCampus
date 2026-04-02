const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

function auth(req, res, next) {
    const header = req.headers["authorization"];
    const bearerToken =
        header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
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

const sanitizeCartItems = (items) => {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map((item) => {
            const productId = String(item.id || item.productId || "").trim();
            const name = String(item.name || "").trim();
            const quantity = Number(item.quantity);
            const price = Number(item.price);

            if (!productId || !name || !Number.isFinite(quantity) || !Number.isFinite(price)) {
                return null;
            }

            if (quantity < 1 || price < 0) {
                return null;
            }

            return {
                productId,
                name,
                price,
                quantity,
                category: String(item.category || "").trim(),
                image: String(item.image || "").trim(),
                description: String(item.description || "").trim(),
            };
        })
        .filter(Boolean);
};

router.get("/", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("cart");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const items = (user.cart || []).map((item) => ({
            id: item.productId,
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: item.category,
            image: item.image,
            description: item.description,
        }));

        res.json({ items });
    } catch (err) {
        console.error("Error fetching cart:", err);
        res.status(500).json({ error: "Failed to fetch cart" });
    }
});

router.put("/", auth, async (req, res) => {
    try {
        const sanitizedItems = sanitizeCartItems(req.body?.items);

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.cart = sanitizedItems;
        await user.save();

        res.json({ message: "Cart updated", items: sanitizedItems });
    } catch (err) {
        console.error("Error updating cart:", err);
        res.status(500).json({ error: "Failed to update cart" });
    }
});

module.exports = router;
