import "dotenv/config";
import * as argon2 from "argon2";
import mongoose from "mongoose";
import env from "../config/env";
import { UserModel } from "../models/user.model";

async function seed() {
  console.log("🌱 Starting MongoDB database seeding...");

  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.MONGO_DB_NAME,
    });
    console.log("✅ Connected to MongoDB");

    // checking the db name
    console.log("Using database:", mongoose?.connection?.db?.databaseName);

    // Check if admin user already exists
    const existingAdmin = await UserModel.findOne({ email: "admin@example.com" });
    if (existingAdmin) {
      console.log("ℹ️  Admin user already exists, skipping seed");
      await mongoose.connection.close();
      return;
    }

    // Hash the default password
    const passwordHash = await argon2.hash("Admin@123", {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });

    // Create admin user
    await UserModel.create({
      name: "Administrator",
      email: "admin@example.com",
      password_hash: passwordHash,
      role: "admin",
      is_active: true,
    });

    console.log("✅ Admin user created successfully!");
    console.log("📧 Email: admin@example.com");
    console.log("🔑 Password: Admin@123");
    console.log("⚠️  Please change the default password after first login");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

// Run seeding if executed directly
if (require.main === module) {
  seed().catch((error) => {
    console.error("Seed script error:", error);
    process.exit(1);
  });
}

export default seed;
