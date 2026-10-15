const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const errorHandler = require("./middleware/errorHandler");
// Import models to initialize associations
require("./models");
// Import routes
const authRoutes = require("./routes/auth.routes");
const phongRoutes = require("./routes/phong.routes");
const hopDongRoutes = require("./routes/hopDong.routes");
const datCocRoutes = require("./routes/datCoc.routes");
const khoanPhaiThuRoutes = require("./routes/khoanPhaiThu.routes");
const managementRoutes = require("./routes/management.routes");
const tenantRoutes = require("./routes/tenant.routes");
const meterReadingRoutes = require("./routes/meterReading.routes");
const mvpRoutes = require("./routes/mvp.routes");
const { installApiResponse } = require("./utils/apiResponse");
const app = express();

// Middleware
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(installApiResponse);

// Health check
app.get("/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});
app.get("/ready", async (req, res) => {
  try {
    await require("./config/database").authenticate();
    res.json({ success: true, checks: { database: "up" } });
  } catch (error) {
    res.status(503).json({ success: false, checks: { database: "down" } });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/phong", phongRoutes);
app.use("/api/hop-dong", hopDongRoutes);
app.use("/api/dat-coc", datCocRoutes);
app.use("/api/khoan-phai-thu", khoanPhaiThuRoutes);
app.use("/api/management", managementRoutes);
// Short resource aliases kept for API consumers and documentation.
app.use("/api", managementRoutes);
app.use("/api", tenantRoutes);
app.use("/api/v1", meterReadingRoutes);
app.use("/api/v1", mvpRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Không tìm thấy endpoint này",
  });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
