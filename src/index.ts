import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app";
import { connectDB, closeDB } from "./db/client";
import env from "./config/env";
import { authService } from "./modules/auth/auth.service";

let io: Server;

async function startServer() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ MongoDB connection established");

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO server
    io = new Server(server, {
      cors: {
        origin: ["https://campaignpanel.socio-fi.com", "http://localhost:5173","http://localhost:5176"],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // Make io globally accessible (optional)
    app.set("io", io);
    console.log("✅ Socket.IO server initialized");

    io.on("connection", (socket) => {
      console.log(`⚡ Client connected: ${socket.id}`);
      socket.on("disconnect", () => console.log(`❌ Client disconnected: ${socket.id}`));
    });

    // Start HTTP + WebSocket server
    server.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
    });

    // Token cleanup job
    setInterval(async () => {
      try {
        await authService.cleanupExpiredTokens();
      } catch (error) {
        console.error("Token cleanup error:", error);
      }
    }, 60 * 60 * 1000);

    process.on("SIGTERM", async () => gracefulShutdown(server));
    process.on("SIGINT", async () => gracefulShutdown(server));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

async function gracefulShutdown(server: http.Server) {
  console.log("\n🛑 Graceful shutdown started...");
  server.close(async () => {
    await closeDB();
    console.log("✅ Shutdown complete");
    process.exit(0);
  });
}

startServer();
