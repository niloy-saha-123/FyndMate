# FyndMate Server - DevOps Guide

## 🚨 CRITICAL: Environment Safety

**ALWAYS verify which environment you're targeting before running commands!**

### Environment Overview

| Environment | Database | Supabase | Purpose |
|------------|----------|----------|---------|
| **Local** | `127.0.0.1:54322` (Docker) | `http://127.0.0.1:54321` | Development |
| **Test** | `127.0.0.1:54322` (Docker) | `http://127.0.0.1:54321` | Running tests |
| **Production** | Supabase Cloud | Supabase Cloud | Live app |

---

## 📋 Common Commands Cheat Sheet

### 1. Running Tests (Client + Server, Safe Local Setup)

#### 1A. Client tests (no DB access)

```bash
cd client
npm install
npm test

# watch mode
npm run test:watch

# run only component tests
npm run test:components

# run only unit tests
npm run test:unit
```

Client tests are pure unit/component tests and must not hit Supabase/Postgres.

#### 1B. Server tests (LOCAL DOCKER ONLY)

```bash
cd server

# Ensure local Supabase + local Redis are running
supabase start
docker ps | grep fyndmate-redis || docker run -d --name fyndmate-redis -p 6379:6379 redis:7-alpine

# Build .env.test and sync schema to local test DB
npm run test:setup

# Run all tests
npm test

# Run specific file
npm test -- tests/unit/utils/computeAge.test.ts
```

**Environment**: Server tests use `.env.test` and local docker only (`127.0.0.1`/`localhost`).

---

### 2. Database Migrations

#### Pull Schema from Production to Local

```bash
# Pull latest schema from Supabase production
npx prisma db pull

# Generate Prisma client
npx prisma generate

# Push schema to LOCAL Docker database
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push --skip-generate
```

**⚠️ WARNING**: `npx prisma db pull` uses `.env` which points to PRODUCTION. This is READ-ONLY and safe.

**⚠️ DANGER**: `npx prisma db push` writes to database! Always specify LOCAL database URL explicitly.

#### Apply Migrations to Production

```bash
# PRODUCTION DEPLOY - Use with extreme caution!
# This applies migrations to Supabase production
npx prisma migrate deploy

# ALWAYS run in staging first if available
```

---

### 3. Prisma Studio (Database GUI)

```bash
# Open Prisma Studio for LOCAL Docker database
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma studio

# Open Prisma Studio for PRODUCTION (READ CAREFULLY!)
# Uses .env which points to production
npx prisma studio
```

---

### 4. Development Server

```bash
# Start development server (uses .env)
npm run dev

# Start with local database explicitly
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run dev
```

---

### 5. Docker Commands (Local Development)

```bash
# Start local Supabase (includes PostgreSQL)
supabase start

# Stop local Supabase
supabase stop

# Reset local database (DESTROYS ALL LOCAL DATA)
supabase db reset

# Check status
supabase status
```

---

## 🔐 Environment Files

### `.env` (Production/Development)
```bash
DATABASE_URL="postgresql://...supabase.com..."
DIRECT_URL="postgresql://...supabase.com..."
SUPABASE_URL="https://...supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

**Used by**: Development server, Prisma migrations, production deploys

---

### `.env.test` (Testing Only)
```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
REDIS_URL="redis://127.0.0.1:6379"
```

**Used by**: `npm test` (Vitest auto-loads this)

---

## 🛡️ Safety Mechanisms

### 1. Database Safety Checks

**Location**: `tests/setup.ts` and `tests/helpers.ts`

```typescript
// These functions abort if DATABASE_URL doesn't contain "127.0.0.1" or "localhost"
- clearDatabase()
- getAuthToken()
- beforeAll() hook
```

**Result**: Tests CANNOT accidentally run against production

---

### 2. Prisma Commands

**Safe Commands** (Read-only):
- `npx prisma db pull` - Reads from database specified in `.env`
- `npx prisma generate` - Only generates code locally
- `npx prisma studio` - Opens GUI (can modify data, but you control it)

**Dangerous Commands** (Write operations):
- `npx prisma db push` - Writes schema to database ⚠️
- `npx prisma migrate deploy` - Applies migrations ⚠️
- `npx prisma migrate dev` - Creates and applies migrations ⚠️

**Best Practice**: Always specify `DATABASE_URL` explicitly for write operations:
```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push
```

---

## 📝 Common Workflows

### Workflow 1: Pull Production Schema to Local

```bash
# 1. Pull schema from production (safe - read only)
npx prisma db pull

# 2. Generate Prisma client with new types
npx prisma generate

# 3. Push schema to LOCAL Docker database
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push --skip-generate

# 4. Verify tests pass
npm test
```

---

### Workflow 2: Create New Migration

```bash
# 1. Make schema changes in prisma/schema.prisma

# 2. Create migration (on production)
npx prisma migrate dev --name add_new_field

# 3. Pull changes to local
npx prisma db pull

# 4. Push to local Docker
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push --skip-generate

# 5. Test
npm test
```

---

### Workflow 3: Running Tests (Both Apps)

```bash
# 1. Ensure local services are running
supabase status
docker ps | grep fyndmate-redis || docker run -d --name fyndmate-redis -p 6379:6379 redis:7-alpine

# 2. Server test setup + run (local DB only)
cd server
npm run test:setup
npm test
npm test -- tests/integration/services/like.test.ts

# 3. Client test run (no DB access)
cd ../client
npm install
npm test
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests pass locally: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] Build succeeds: `npm run build`

### Deployment
- [ ] Review migration files if any
- [ ] Deploy to staging first (if available)
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Deploy application code
- [ ] Verify health checks

### Post-Deployment
- [ ] Check application logs
- [ ] Verify critical flow in production
- [ ] Monitor error rates

---

## 💡 Pro Tips

1. **Never trust environment variables blindly**
   ```bash
   # Always check before destructive operations
   echo $DATABASE_URL
   ```

2. **Use explicit DATABASE_URL for risky commands**
   ```bash
   # Good ✅
   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push
   
   # Risky ⚠️
   npx prisma db push  # Uses .env which might be production!
   ```

3. **Backup before schema changes**
   ```bash
   # Production backup (via Supabase dashboard)
   # Local backup
   supabase db dump > backup.sql
   ```

4. **Test migrations locally first**
   ```bash
   # Apply migration to local Docker
   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma migrate deploy
   
   # Run tests
   npm test
   
   # If all good, apply to production
   npx prisma migrate deploy
   ```

---

## 🔍 Troubleshooting

### "Tests failing with database errors"
```bash
# 1. Check Docker is running
supabase status

# 2. Reset local database
supabase db reset

# 3. Push schema
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push

# 4. Run tests
npm test
```

### "Schema out of sync"
```bash
# Pull from production
npx prisma db pull
npx prisma generate

# Push to local
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push --skip-generate
```

### "Accidentally ran command on wrong environment"
```bash
# Check what happened
git status
git diff

# If schema changes were pushed to production accidentally:
# 1. Check Supabase dashboard for recent schema changes
# 2. Contact team immediately
# 3. Consider rolling back if no data loss

# Prevention: Use this alias
alias prisma-local="DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' npx prisma"
# Then: prisma-local db push
```

---

## 📊 Quick Reference Table

| Task | Command | Environment |
|------|---------|-------------|
| Run tests | `npm test` | Local Docker (auto) |
| Pull schema | `npx prisma db pull` | Production → Local files |
| Generate types | `npx prisma generate` | Local files only |
| Push to local DB | `DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push` | Local Docker |
| Push to prod DB | `npx prisma db push` | ⚠️ Production |
| Dev server | `npm run dev` | Uses `.env` |
| Prisma Studio (local) | `DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma studio` | Local Docker |
| Prisma Studio (prod) | `npx prisma studio` | ⚠️ Production |

---

## 🎯 Remember

> **Golden Rule**: When in doubt, explicitly specify `DATABASE_URL` for write operations!

> **Test Safety**: Tests auto-abort if `DATABASE_URL` doesn't contain `127.0.0.1` or `localhost`

> **Always verify**: `echo $DATABASE_URL` before destructive operations
