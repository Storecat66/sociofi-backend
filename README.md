# Store Cataloguer Backend

A production-ready backend API for admin dashboard built with Node.js, Express, TypeScript, and MySQL.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with access/refresh token rotation
- **Role-Based Access Control (RBAC)**: Admin, Manager, Viewer roles
- **Security**: Helmet, rate limiting, CORS, argon2id password hashing
- **Database**: MySQL with mysql2 driver for direct SQL queries
- **Validation**: Zod for request/response validation
- **Pagination**: Efficient keyset pagination for user listings
- **Audit Logging**: Track all user modifications
- **TypeScript**: Full type safety throughout the application

## 🛠️ Tech Stack

- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **Database**: MySQL with mysql2 driver
- **Database Driver**: mysql2 with connection pooling
- **Validation**: Zod
- **Authentication**: JWT with argon2id password hashing
- **Security**: Helmet, express-rate-limit, CORS, cookie-parser

## 📁 Project Structure

```
src/
 ├─ index.ts                 # Application entry point
 ├─ app.ts                  # Express app configuration
 ├─ config/env.ts           # Environment configuration
 ├─ utils/
 │   ├─ jwt.ts              # JWT utilities
 │   └─ http.ts             # HTTP utilities and error classes
 ├─ middleware/
 │   ├─ auth.ts             # Authentication middleware
 │   ├─ error.ts            # Error handling middleware
 │   └─ rateLimit.ts        # Rate limiting configurations
 ├─ db/
 │   ├─ client.ts           # Database connection
 │   ├─ schema.ts           # Type definitions
 │   ├─ migrate.ts          # Database migrations
 │   └─ seed.ts             # Database seeding
 ├─ modules/
 │   ├─ auth/               # Authentication module
 │   │   ├─ auth.routes.ts
 │   │   ├─ auth.controller.ts
 │   │   └─ auth.service.ts
 │   └─ users/              # User management module
 │       ├─ user.routes.ts
 │       ├─ user.controller.ts
 │       ├─ user.service.ts
 │       └─ user.model.ts
 └─ types.d.ts              # Global type definitions
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v18+)
- MySQL (v8.0+)
- npm or yarn

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd store_catalogouer_backend
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=8080
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=yourpassword
   MYSQL_DB=admin_db
   JWT_ACCESS_SECRET=your_32_character_secret_key_here
   JWT_REFRESH_SECRET=your_32_character_refresh_secret_here
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Database setup**:
   ```bash
   # Run database migrations
   npm run db:migrate
   
   # Seed initial admin user
   npm run db:seed
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:8080`

### Production Build

```bash
npm run build
npm start
```

## 🔑 Default Admin Account

After running `npm run db:seed`:

- **Email**: `admin@example.com`
- **Password**: `Admin@123`

⚠️ **Important**: Change the default password immediately after first login!

## 📚 API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/login` | Login with email/password | Public |
| POST | `/api/auth/refresh` | Refresh access token | Public |
| POST | `/api/auth/logout` | Logout and clear tokens | Public |
| POST | `/api/auth/invalidate-sessions` | Invalidate all user sessions | Private |

### Users

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users` | Get paginated users list | Manager/Admin |
| GET | `/api/users/me` | Get current user profile | Private |
| GET | `/api/users/search?q=query` | Search users | Manager/Admin |
| GET | `/api/users/stats` | Get user statistics | Admin |
| GET | `/api/users/:id` | Get user by ID | Manager/Admin |
| PATCH | `/api/users/:id` | Update user role/status | Admin/Manager |
| GET | `/api/users/:id/audit-logs` | Get user audit logs | Admin |

### Health Check

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/health` | Server health status | Public |

## 🔐 Authentication Flow

1. **Login**: POST `/api/auth/login` with `{ email, password }`
   - Returns `{ user, accessToken }` + sets httpOnly refresh cookie

2. **API Requests**: Include access token in header:
   ```
   Authorization: Bearer <access_token>
   ```

3. **Token Refresh**: POST `/api/auth/refresh`
   - Uses httpOnly cookie automatically
   - Returns new access token + rotates refresh token

4. **Logout**: POST `/api/auth/logout`
   - Clears refresh cookie and invalidates token

## 🛡️ Security Features

- **argon2id** password hashing with memory-hard parameters
- **JWT tokens** with 15-minute access token expiry
- **Refresh token rotation** (7-day expiry, stored in database)
- **Rate limiting** (10 auth attempts per 15 minutes)
- **CORS protection** configured for frontend origin
- **Helmet** security headers
- **Input validation** using Zod schemas
- **SQL injection protection** via parameterized queries

## 👥 Role-Based Access Control

### Roles

- **Admin**: Full access to all resources
- **Manager**: Can view/manage users (except other managers/admins)
- **Viewer**: Read-only access to their own profile

### Permissions Matrix

| Action | Admin | Manager | Viewer |
|--------|-------|---------|--------|
| View all users | ✅ | ✅ | ❌ |
| Update user roles | ✅ | ❌ | ❌ |
| Deactivate users | ✅ | ✅* | ❌ |
| View audit logs | ✅ | ❌ | ❌ |
| View statistics | ✅ | ❌ | ❌ |

*Managers can only manage viewers

## 📊 Database Schema

### Tables

- **users**: User accounts with roles and authentication data
- **refresh_tokens**: Active refresh tokens with expiry tracking
- **audit_logs**: Activity logs for user modifications

### Key Features

- **Token version**: Enables global session invalidation
- **Audit trail**: Tracks all user modifications
- **Proper indexing**: Optimized for query performance
- **Foreign keys**: Maintains referential integrity

## 🔄 Token Management

- **Access tokens**: 15-minute expiry, stateless JWT
- **Refresh tokens**: 7-day expiry, stored in database with rotation
- **Token versioning**: Allows instant invalidation of all user sessions
- **Automatic cleanup**: Expired tokens cleaned up hourly

## 🚀 Frontend Integration

This backend is designed to work seamlessly with your Vite + React + TypeScript frontend:

```typescript
// Frontend login example
const login = async (email: string, password: string) => {
  const response = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    credentials: 'include', // Important for cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  // Store access token in memory/state
  // Refresh token is automatically stored in httpOnly cookie
};
```

## 📈 Performance

- **Keyset pagination**: O(1) traversal for user listings
- **Database indexing**: Optimized queries for common operations
- **Connection pooling**: Efficient database connection management
- **Rate limiting**: Prevents abuse and ensures fair usage

## 🐛 Error Handling

- **Global error handler**: Catches and formats all errors
- **Custom error classes**: Type-safe error responses
- **Validation errors**: Detailed Zod validation messages
- **Database errors**: Proper MySQL error handling

## 📝 Logging

- **Audit logs**: Track all user modifications in database
- **Error logging**: Development error details
- **Activity tracking**: Login/logout events

## 🧪 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Type check
npm run type-check

# Build for production
npm run build

# Database commands
npm run db:migrate              # Run pending migrations
npm run db:migrate:rollback     # Rollback last migration
npm run db:migrate:status       # Show migration status
npm run db:generate <name>      # Generate new migration
npm run db:seed                 # Seed database
```

## 🗄️ Database Management

### Migration System

The project uses a versioned migration system that allows you to:
- **Add/modify/drop** database tables
- **Add/drop/modify** columns 
- **Create/drop** indexes
- **Rollback** changes safely

#### Common Migration Commands

```bash
# Check current migration status
npm run db:migrate:status

# Run all pending migrations
npm run db:migrate

# Rollback the last migration
npm run db:migrate:rollback
```

#### Creating New Migrations

1. **Generate a new migration**:
   ```bash
   npm run db:generate add_user_avatar_column
   ```

2. **Edit the generated migration** in `src/db/migrate.ts`:
   ```typescript
   {
     version: 2,
     name: "add_user_avatar_column",
     up: async (pool: Pool) => {
       await pool.execute(`
         ALTER TABLE users 
         ADD COLUMN avatar_url VARCHAR(500) NULL AFTER email
       `);
     },
     down: async (pool: Pool) => {
       await pool.execute(`
         ALTER TABLE users 
         DROP COLUMN avatar_url
       `);
     }
   }
   ```

3. **Run the migration**:
   ```bash
   npm run db:migrate
   ```

#### Example Migration Operations

**Add a column**:
```sql
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER email
```

**Drop a column**:
```sql
ALTER TABLE users DROP COLUMN avatar_url
```

**Modify a column**:
```sql
ALTER TABLE users MODIFY COLUMN phone_number VARCHAR(20) NOT NULL
```

**Add an index**:
```sql
CREATE INDEX idx_user_avatar ON users(avatar_url)
```

**Create a new table**:
```sql
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

#### Migration Best Practices

- **Always test migrations** on a copy of production data first
- **Write rollback logic** in the `down()` function for every migration
- **Use transactions** for complex migrations that involve multiple operations
- **Never modify existing migrations** that have been run in production
- **Keep migrations small and focused** on a single change


## 🤝 Frontend Integration Example

Here are the exact API calls your frontend should make:

```typescript
// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Refresh token
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  credentials: 'include'
});

// Logout
const logoutResponse = await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include'
});

// Get users with pagination
const usersResponse = await fetch('/api/users?limit=30&cursor=123', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

// Update user
const updateResponse = await fetch('/api/users/123', {
  method: 'PATCH',
  headers: { 
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ role: 'manager', is_active: true })
});
```

## 📄 License

MIT License