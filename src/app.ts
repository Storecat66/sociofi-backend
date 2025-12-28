import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { generalLimiter } from "./middleware/rateLimit";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import exportRoutes from "./modules/export_user_data/export_user_data.route";
import participantsRoutes from "./modules/participants/participants.route";
import env from "./config/env";
import promotionsRoutes from "./modules/promotions/promotions.route";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

const app = express();

// Configure trust proxy so rate-limit (and other middleware) can correctly read
// the X-Forwarded-For header when the app is behind a proxy/load balancer.
// Value is configurable via the TRUST_PROXY env var (default 1).
app.set("trust proxy", Number(env.TRUST_PROXY) || 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
   origin: ["https://campaignpanel.socio-fi.com", "http://localhost:5173","http://localhost:5176"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["set-cookie"],
  })
);

// Body parsing middleware
// Increased limit for export operations that may contain large datasets
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cookie parser
app.use(cookieParser());

// Rate limiting
app.use(generalLimiter);

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "webhook is ready to test",
  });
});

// Health check endpoint
app.get("/health", (_req, res) => {
  console.log("Health check requested");
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.post("/webhook/participations", (req, res) => {
  const event = req.body;
  console.log("📩 Received Easypromos webhook:", event);

  // Get the Socket.IO instance
  const io = req.app.get("io");

  // Emit to all connected clients
  io.emit("new_participant", event);

  // Send acknowledgment to Easypromos
  res.status(200).json({
    success: true,
    message: "Easypromos webhook received successfully",
  });
});


// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/participants", participantsRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/dashboard", dashboardRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
