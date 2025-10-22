// import { createPool, Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
// import env from '../config/env';

// // Create MySQL connection pool
// export const pool: Pool = createPool({
//   host: env.MYSQL_HOST,
//   port: env.MYSQL_PORT,
//   user: env.MYSQL_USER,
//   password: env.MYSQL_PASSWORD,
//   database: env.MYSQL_DB,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
//   timezone: 'Z',
// });

// // Database helper functions
// export const db = {
//   // Execute a query with parameters
//   async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
//     const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
//     return rows as T[];
//   },

//   // Execute an insert/update/delete query
//   async execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
//     const [result] = await pool.execute<ResultSetHeader>(sql, params);
//     return result;
//   },

//   // Get a single row
//   async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
//     const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
//     return (rows[0] as T) || null;
//   },

//   // Transaction helper
//   async transaction<T>(callback: (connection: any) => Promise<T>): Promise<T> {
//     const connection = await pool.getConnection();
//     await connection.beginTransaction();
    
//     try {
//       const result = await callback(connection);
//       await connection.commit();
//       return result;
//     } catch (error) {
//       await connection.rollback();
//       throw error;
//     } finally {
//       connection.release();
//     }
//   }
// };

// // Health check function
// export const checkDatabaseConnection = async (): Promise<boolean> => {
//   try {
//     await db.query('SELECT 1 as test LIMIT 1');
//     return true;
//   } catch (error) {
//     console.error('Database connection failed:', error);
//     return false;
//   }
// };

// // Graceful shutdown
// export const closeDatabaseConnection = async (): Promise<void> => {
//   try {
//     await pool.end();
//   } catch (error) {
//     console.error('Error closing database connection:', error);
//   }
// };

import mongoose from "mongoose";
import env from "../config/env";

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.MONGO_DB_NAME,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

export const closeDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  } catch (error) {
    console.error("❌ Error closing MongoDB connection:", error);
  }
};
