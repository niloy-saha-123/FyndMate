# FyndMate Server

## 📦 Redis Setup (Required)

### Quick Setup (5 minutes):
1. Go to https://upstash.com and create free account
2. Create Redis database (Regional, us-east-1, TLS enabled)
3. Copy connection string to `server/.env`:
   ```bash
   REDIS_URL="rediss://default:PASSWORD@host.upstash.io:6379"
   ```
4. Run: `npm run dev`
5. Verify: `curl http://localhost:3000/health/redis`

**Cost**: Free for first 1K users ($0.12/month at 2K users)

### What Redis Does:
- 🔒 **Rate limiting** (prevents abuse) - Fail-closed with in-memory fallback
- 🔒 **Replay protection** (location security) - Fail-closed with in-memory fallback
- ⚡ **Feed caching** (5 min) - Speeds up by 70%
- ⚡ **Geocoding cache** (30 days) - Saves 95% of API calls

### Without Redis:
- Development: Works with in-memory fallback (single server only)
- Production: Server won't start (prevents security issues)

---

# FyndMate Server (Original README)

## 🧪 Testing Setup (Team Onboarding)

To run tests locally without messing up production, we use a local Docker database.

### Prerequisites
- Docker Desktop installed and running.
- Node.js installed.

### Quick Start (One-Click Setup)
1.  **Initialize & Start DB**:
    ```bash
    npx supabase start
    ```
    *This spins up a local Postgres instance on port 54322.*

2.  **Run Full Setup**:
    ```bash
    npm run db:local:setup
    ```
    *This installs dependencies, creates `.env.test`, and generates the Prisma client.*

3.  **Run Tests**:
    ```bash
    npm test
    ```

### Troubleshooting
- **Deadlock detected?**: Tests are configured to run sequentially (`fileParallelism: false`) to avoid this.
- **DB URL**: The local Supabase DB is at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## ⚙️ Environment Configuration

This project uses **different environment files** for different purposes:

| File | Purpose | Loaded By | Gitignored? |
|------|---------|-----------|-------------|
| `.env` | Production configuration | `npm run start`, `npm run dev:prod` | ❌ No (contains safe defaults) |
| `.env.local` | **Local development** (Docker Supabase) | `npm run dev` | ✅ Yes |
| `.env.test` | Test environment | `npm test` | ✅ Yes |

### 🏠 Local Development Setup

When you run `npm run dev`, the server automatically loads `.env.local` which points to your **local Supabase instance** running in Docker.

**You don't need to do anything!** The `.env.local` file is already configured with:
- Local Supabase URL: `http://127.0.0.1:54321`
- Local database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Local service role key (standard Supabase CLI default)

### 🎯 Quick Reference: Local vs Production

**Default = Local (Safe)**  
All commands use local environment by default. Production requires explicit `prod` in the command name.

## 📘 Daily Development Workflow

### 1. Start Local Environment
```bash
# Start local Supabase (runs in Docker)
npx supabase start

# Start dev server (auto-loads .env.local)
npm run dev
```

### 2. Database Operations (Local)
```bash
# Push schema changes to local DB
npm run db:local:push

# View/edit database data
npm run db:local:studio

# Seed test users for matching engine
npm run db:local:seed

# Reset local DB (fresh start)
npm run db:local:reset

# Generate Prisma client
npm run db:generate
```

### 3. Testing
```bash
# Generate JWT token for Postman
npm run token:local

# Run automated tests
npm test
```

---

## 🚀 Production Operations (Use with Caution!)

### Deploy Database Changes
```bash
# Deploy pending migrations to production
npm run db:prod:migrate

# Push schema directly (skip migrations) - DANGEROUS
npm run db:prod:push

# View production data (read-only recommended)
npm run db:prod:studio
```

### Run Production Server
```bash
# Test against production locally
npm run dev:prod

# Run in production
npm run start:prodHumans
```

---

## 🧭 When to Use Each Environment

### ✅ Use LOCAL for:
- Daily development (`npm run dev`)
- Testing APIs with Postman (`npm run token:local`)
- Experimenting with database schema (`npm run db:local:push`)
- Running automated tests (`npm test`)
- Seeding test data (`npm run db:local:seed`)
- **Breaking things** (it's safe!)

### ⚠️ Use PRODUCTION for:
- Deploying schema migrations (`npm run db:prod:migrate`)
- Emergency data fixes (`npm run db:prod:studio`)
- **NEVER** for testing or experimentation

---

## 🔧 Common Workflows

### Adding a New Table/Column
```bash
# 1. Edit prisma/schema.prisma
vim prisma/schema.prisma

# 2. Test locally first
npm run db:local:push

# 3. Verify it works
npm run dev

# 4. Create migration (for production)
npm run db:migrate

# 5. Deploy to production
npm run db:prod:migrate
```

### Testing Matching Engine
```bash
# 1. Seed test users
npm run db:local:seed

# 2. Generate token
npm run token:local

# 3. Use token in Postman
# Copy/paste token → jwtToken variable
```

---

## 📝 Environment Files Reference

| File | Purpose | Example URLs |
|------|---------|-------------|
| `.env` | Production defaults | `https://roiekavirwvgxhnzuoqa.supabase.co` |
| `.env.local` | Local Docker Supabase | `http://127.0.0.1:54321` |
| `.env.test` | Test environment | `postgresql://localhost:54322` |

**Note**: `.env.local` and `.env.test` are gitignored. New team members need to create `.env.local` (see setup instructions above).

---

## 🧪 Postman API Testing

1. **Start local environment**:
   ```bash
   npx supabase start
   npm run db:local:seed  # Creates test users
   npm run dev           # Starts server
   ```

2. **Generate test token**:
   ```bash
   npm run token:local
   ```

3. **Copy token to Postman**:
   - Open Postman
   - Collection → Variables
   - Set `jwtToken` = (paste token)

4. **Test endpoints**:
   - All requests now work with local Supabase ✅

## 🛠️ Helper Scripts

We have created scripts to help with local development and testing.

### 1. `scripts/get_test_token.ts`
**Purpose**: Generates a valid JWT Access Token for testing API endpoints (e.g., in Postman).
**Usage**:
```bash
npx tsx scripts/get_test_token.ts
```
**Details**: Creates a verified user (`postman_final@fyndmate.com`) via Admin API and prints the token.

### 2. `scripts/test_matching_engine.ts`
**Purpose**: **Reset & Seed** tool. Wipes your local DB and fills it with dummy users and interactions.
**⚠️ WARNING**: THIS DELETES ALL DATA in the connected database.
**Usage**:
```bash
npx tsx scripts/test_matching_engine.ts
```
**Details**: Great for quickly populating the app with users to swipe on in the Simulator.
