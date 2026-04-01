const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "insidelautechadmin@gmail.com",
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

const isHostedEnvironment =
  Boolean(process.env.RENDER) || Boolean(process.env.RENDER_EXTERNAL_URL);

const frontendUrl = isHostedEnvironment
  ? process.env.FRONTEND_URL || "https://insidelautech.vercel.app"
  : process.env.FRONTEND_URL_DEV ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";

const buildVerificationEmailHtml = (name, verifyUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="margin-bottom: 8px;">Hello ${name},</h2>
    <p style="margin: 0 0 16px;">Please verify your InsideLAUTECH account to continue.</p>
    <a
      href="${verifyUrl}"
      style="display: inline-block; background: #c0a062; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;"
    >
      Verify Email
    </a>
    <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">This link expires in 24 hours.</p>
    <p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">If the button doesn't work, use this backup link:</p>
    <p style="margin: 4px 0 0; font-size: 13px;"><a href="${verifyUrl}">Open verification link</a></p>
  </div>
`;

const sendVerificationEmail = async ({ email, name, verifyUrl }) => {
  await transporter.sendMail({
    from: `"InsideLAUTECH" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your InsideLAUTECH account",
    html: buildVerificationEmailHtml(name, verifyUrl),
  });
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 8;
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      verified: false,
    });
    await user.save();

    const verifyToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const verifyUrl = `${frontendUrl}/pages/verify.html?token=${encodeURIComponent(verifyToken)}`;
    res.status(201).json({
      message: "Account created. Please check your email to verify.",
    });

    sendVerificationEmail({ email, name, verifyUrl }).catch((emailErr) => {
      console.error("Email sending failed after signup:", emailErr);
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed. Please try again." });
  }
});

router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: "No verification token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      return res.status(400).json({
        error: "Invalid or expired verification link",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.verified) {
      return res.status(200).json({
        message: "Email already verified. You can log in.",
      });
    }

    user.verified = true;
    await user.save();

    res.json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({
      error: "Verification failed. Please try again.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.verified) {
      return res.status(403).json({
        error: "Email not verified",
        reason: "verification_pending",
        email: user.email,
        message: "Please verify your email before logging in.",
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.cookie("insidelautech_auth", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("insidelautech_auth", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
  });

  return res.json({ message: "Logout successful" });
});

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(200).json({
        message: "If the email exists, a verification link will be sent.",
      });
    }

    if (user.verified) {
      return res.status(200).json({
        message: "Email is already verified.",
      });
    }

    const verifyToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const verifyUrl = `${frontendUrl}/pages/verify.html?token=${encodeURIComponent(verifyToken)}`;
    try {
      await sendVerificationEmail({
        email,
        name: user.name,
        verifyUrl,
      });
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr);
      return res.status(500).json({
        error: "Failed to send verification email. Please try again.",
      });
    }

    res.json({
      message: "Verification email sent successfully",
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({
      error: "Failed to resend verification email.",
    });
  }
});

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

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user information" });
  }
});

module.exports = router;
