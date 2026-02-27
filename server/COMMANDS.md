# Quick Commands Reference

## Test Commands
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/utils/computeAge.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Database Commands

### Local Docker Database
```bash
# Sync schema from production to local Docker
npx prisma db pull && npx prisma generate && DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma db push --skip-generate

# Open Prisma Studio for local database
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx prisma studio
```

### Production Database (⚠️ USE WITH CAUTION)
```bash
# Pull schema from production (safe - read only)
npx prisma db pull

# Deploy migrations to production
npx prisma migrate deploy

# Open Prisma Studio for production
npx prisma studio
```

## Docker/Supabase Commands
```bash
# Start local Supabase
supabase start

# Check status
supabase status

# Stop local Supabase
supabase stop

# Reset local database (destroys all data)
supabase db reset
```

## Development
```bash
# Start dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint
```

---

**See [DEVOPS.md](./DEVOPS.md) for detailed documentation.**
