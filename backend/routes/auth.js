const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

/**
 * Email transporter setup (Nodemailer SMTP only)
 */
let transporter;
let emailProvider = "none";

const isHostedEnvironment =
  Boolean(process.env.RENDER) || Boolean(process.env.RENDER_EXTERNAL_URL);

const createSmtpTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 0);
  const secure = String(process.env.EMAIL_SECURE || "false").toLowerCase() === "true";

  if (host) {
    return nodemailer.createTransport({
      host,
      port: port || (secure ? 465 : 587),
      secure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_PROVIDER || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const initializeEmailService = () => {
  const candidate = createSmtpTransporter();
  emailProvider = candidate ? "smtp" : "none";

  if (!candidate) {
    logEmailSetupError();
    return;
  }

  transporter = candidate;

  transporter.verify((error) => {
    if (error) {
      console.error(
        `[CRITICAL] ${emailProvider.toUpperCase()} email verification failed:`,
        error.message,
      );
      transporter = null;
      emailProvider = "none";
      return;
    }

    console.log(`[SUCCESS] Email service ready via ${emailProvider.toUpperCase()}`);
  });
};

const logEmailSetupError = () => {
  console.error("\n[CRITICAL] Nodemailer email is not configured.");
  console.error("Set these variables in your .env or deployment environment:\n");

  console.error("SMTP mode:");
  console.error("  EMAIL_SERVICE=smtp");
  console.error("  EMAIL_USER=shoponcampus@gmail.com");
  console.error("  EMAIL_PASS=your_gmail_app_password");
  console.error("  EMAIL_PROVIDER=gmail (optional)\n");
  console.error("See EMAIL_SETUP.md for detailed instructions.\n");
};

initializeEmailService();

const frontendUrl = isHostedEnvironment
  ? process.env.FRONTEND_URL || "https://shoponcampus.vercel.app"
  : process.env.FRONTEND_URL_DEV ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";
const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 2 * 60 * 60 * 1000,
};

const getSenderEmail = () => {
  return process.env.EMAIL_USER || "shoponcampus@gmail.com";
};

const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) {
    throw new Error("Email service is unavailable. Please check provider configuration.");
  }

  await transporter.sendMail({
    from: `"ShopOnCampus" <${getSenderEmail()}>`,
    to,
    subject,
    html,
  });
};


const buildVerificationEmailHtml = (name, verifyUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="margin-bottom: 8px;">Hello ${name},</h2>
    <p style="margin: 0 0 16px;">Please verify your ShopOnCampus account to continue.</p>
    <a
      href="${verifyUrl}"
      style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;"
    >
      Verify Email
    </a>
    <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">This link expires in 24 hours.</p>
    <p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">If the button doesn't work, use this backup link:</p>
    <p style="margin: 4px 0 0; font-size: 13px;"><a href="${verifyUrl}">Open verification link</a></p>
  </div>
`;

const sendVerificationEmail = async ({ email, name, verifyUrl }) => {
  try {
    await sendEmail({
      to: email,
      subject: "Verify your ShopOnCampus account",
      html: buildVerificationEmailHtml(name, verifyUrl),
    });
    console.log(`[SUCCESS] Verification email sent to ${email} via ${emailProvider}`);
  } catch (error) {
    console.error(`[ERROR] Failed to send verification email to ${email}:`, error.message);
    console.error("[DEBUG] Error code:", error.code);
    console.error("[DEBUG] Response:", error.response);
    throw error;
  }
};

const validateEmail = (email) => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};

const validateName = (name) => {
  const nameRegex = /^[A-Za-z][A-Za-z\s.'-]{1,79}$/;
  return nameRegex.test(name);
};

const validatePassword = (password) => {
  const printableAsciiRegex = /^[\x20-\x7E]{8,128}$/;
  return printableAsciiRegex.test(password);
};

const containsEmoji = (value) => /\p{Extended_Pictographic}/u.test(value);

const buildPasswordResetEmailHtml = (name, resetUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="margin-bottom: 8px;">Hello ${name},</h2>
    <p style="margin: 0 0 16px;">We received a request to reset your ShopOnCampus password. Click the link below to proceed:</p>
    <a
      href="${resetUrl}"
      style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;"
    >
      Reset Password
    </a>
    <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">This link expires in 1 hour.</p>
    <p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">If the button doesn't work, use this backup link:</p>
    <p style="margin: 4px 0 0; font-size: 13px;"><a href="${resetUrl}">Open password reset link</a></p>
    <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">If you didn't request a password reset, please ignore this email.</p>
  </div>
`;

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const trimmedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!trimmedName || !normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (
      containsEmoji(trimmedName) ||
      containsEmoji(normalizedEmail) ||
      containsEmoji(rawPassword)
    ) {
      return res.status(400).json({
        error: "Emojis are not allowed in signup fields.",
      });
    }

    if (!validateName(trimmedName)) {
      return res.status(400).json({
        error: "Name contains unsupported characters.",
      });
    }

    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!validatePassword(rawPassword)) {
      return res.status(400).json({
        error: "Password must use standard characters and be 8-128 chars.",
      });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashed = await bcrypt.hash(rawPassword, 12);
    const user = new User({
      name: trimmedName,
      email: normalizedEmail,
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

    sendVerificationEmail({
      email: normalizedEmail,
      name: trimmedName,
      verifyUrl,
    }).catch((emailErr) => {
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
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (containsEmoji(normalizedEmail) || containsEmoji(rawPassword)) {
      return res.status(400).json({
        error: "Emojis are not allowed in login fields.",
      });
    }

    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!validatePassword(rawPassword)) {
      return res.status(400).json({
        error: "Password contains unsupported characters.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(rawPassword, user.password);
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

    res.cookie("shoponcampus_auth", token, {
      ...authCookieOptions,
    });

    res.json({
      message: "Login successful",
      token,
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("shoponcampus_auth", {
    ...authCookieOptions,
    maxAge: undefined,
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

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (containsEmoji(normalizedEmail)) {
      return res.status(400).json({ error: "Emojis are not allowed in email." });
    }

    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Security: Don't reveal if email exists
      return res.status(200).json({
        message: "If the email exists in our system, a password reset link will be sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetToken = resetTokenHash;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${frontendUrl}/pages/reset-password.html?token=${encodeURIComponent(resetToken)}`;

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Reset your ShopOnCampus password",
        html: buildPasswordResetEmailHtml(user.name, resetUrl),
      });
      console.log(`[SUCCESS] Password reset email sent to ${normalizedEmail} via ${emailProvider}`);
    } catch (emailErr) {
      console.error(`[ERROR] Failed to send password reset email to ${normalizedEmail}:`, emailErr.message);
      user.resetToken = null;
      user.resetTokenExpiry = null;
      await user.save();
      return res.status(500).json({
        error: "Failed to send password reset email. Please try again.",
      });
    }

    res.json({
      message: "If the email exists in our system, a password reset link will be sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      error: "Failed to process password reset request.",
    });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    const resetToken = String(token || "").trim();
    const rawPassword = String(password || "");

    if (!resetToken || !rawPassword) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    if (!validatePassword(rawPassword)) {
      return res.status(400).json({
        error: "Password must use standard characters and be 8-128 chars.",
      });
    }

    if (containsEmoji(rawPassword)) {
      return res.status(400).json({
        error: "Emojis are not allowed in password.",
      });
    }

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      resetToken: resetTokenHash,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: "Password reset link has expired. Please request a new one.",
      });
    }

    const isSamePassword = await bcrypt.compare(rawPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        error: "New password must be different from your current password.",
      });
    }

    const hashed = await bcrypt.hash(rawPassword, 12);
    user.password = hashed;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      error: "Failed to reset password. Please try again.",
    });
  }
});

module.exports = router;
