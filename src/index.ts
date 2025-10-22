import "dotenv/config";
import app from "./app";
import { connectDB, closeDB } from "./db/client"; // ✅ MongoDB versions
import { authService } from "./modules/auth/auth.service";
import env from "./config/env";
import seed from "./db/seed";

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("💥 UNCAUGHT EXCEPTION! Shutting down...");
  console.error(error.name, error.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown, promise: Promise<any>) => {
  console.error("💥 UNHANDLED REJECTION! Shutting down...");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  process.exit(1);
});

async function startServer() {
  try {
    // running the seeding script
    seed().catch((error) => {
      console.error("Seed script error:", error);
      process.exit(1);
    });

    // Connect to MongoDB
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ MongoDB connection established");

    // Token cleanup job
    setInterval(async () => {
      try {
        await authService.cleanupExpiredTokens();
      } catch (error) {
        console.error("Token cleanup error:", error);
      }
    }, 60 * 60 * 1000); // every 1 hour

    // Start the HTTP server
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 CORS origin: ${env.CORS_ORIGIN}`);
      console.log("📚 API Documentation:");
      console.log("  POST /api/auth/login");
      console.log("  POST /api/auth/refresh");
      console.log("  POST /api/auth/logout");
      console.log("  GET  /api/users");
      console.log("  PATCH /api/users/:id");
      console.log("  GET  /health");
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log("👋 HTTP server closed");

        try {
          await closeDB(); // ✅ close MongoDB connection
          console.log("💾 MongoDB connection closed");
        } catch (error) {
          console.error("Error closing MongoDB connection:", error);
        }

        console.log("✅ Graceful shutdown completed");
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start server
startServer();
