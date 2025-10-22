import { createPool, Pool, RowDataPacket } from "mysql2/promise";
import env from "../config/env";

interface ColumnInfo extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

class DatabaseInspector {
  private pool: Pool;

  constructor() {
    this.pool = createPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DB,
    });
  }

  /**
   * Get all columns for a table
   */
  async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const [rows] = await this.pool.execute<ColumnInfo[]>(
      `DESCRIBE \`${tableName}\``
    );
    return rows;
  }

  /**
   * Check if a column exists in a table
   */
  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const columns = await this.getTableColumns(tableName);
    return columns.some(col => col.Field === columnName);
  }

  /**
   * Get missing columns by comparing expected vs actual
   */
  async getMissingColumns(tableName: string, expectedColumns: string[]): Promise<string[]> {
    const existingColumns = await this.getTableColumns(tableName);
    const existingColumnNames = existingColumns.map(col => col.Field);
    
    return expectedColumns.filter(col => !existingColumnNames.includes(col));
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default DatabaseInspector;