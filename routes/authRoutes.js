const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");

const router = express.Router();

// Batasi percobaan login: max 10x per 15 menit per IP, cegah brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Terlalu banyak percobaan login. Coba lagi nanti." },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/login", loginLimiter, authController.login);
router.get("/logout", authController.logout);
router.post("/admin/login", loginLimiter, authController.adminLogin);
router.get("/admin/logout", authController.adminLogout);

module.exports = router;