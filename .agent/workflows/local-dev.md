---
description: How to set up a local Supabase instance with Docker for safe development and testing.
---

# Local Supabase Development Setup

This guide explains how to run Supabase locally using Docker. This creates a full replica of your production stack (Postgres, Auth, Storage, Edge Functions) on your machine. This is the **safest** way to develop and run tests without risking production data.

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- `npm` installed.

## Step 1: Initialize Project
Run this command in the project root. It creates a `supabase/` directory with configuration files.

```bash
npx supabase init
```

## Step 2: Start Local Supabase
This pulls the Docker images and starts the containers. It may take a few minutes the first time.

```bash
npx supabase start
```

**Output:**
You will see output containing your local API keys and URL.
- **API URL**: `http://127.0.0.1:54321`
- **DB URL**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (Standard port is 54322)
- **Studio URL**: `http://127.0.0.1:54323` (A local dashboard like Supabase.com!)

## Step 3: Configure Test Environment
Create a file specifically for testing that points to this local database.

**Create `server/.env.test`:**
```env
# Local Supabase Credentials (default for everyone using 'npx supabase start')
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

## Step 4: Run Tests
We need to tell our test runner to use this specific environment file.

**Update `server/package.json`:**
Change the `test` script to load `.env.test` before running vitest.
```json
"scripts": {
  "test": "dotenv -e .env.test -- vitest run",
  "test:watch": "dotenv -e .env.test -- vitest"
}
```
*(You may need to install dotenv-cli: `npm install -D dotenv-cli`)*

## Step 5: Workflow
1. **Start Work**: `npx supabase start`
2. **Run Tests**: `npm test` (Safe! Wipes local DB only)
3. **Stop Work**: `npx supabase stop`

## Common Commands
- `npx supabase status`: See your local URLs and keys.
- `npx supabase stop`: Stop the docker containers.
- `npx supabase db reset`: Wipes the local DB and re-runs migrations (Good for a fresh start).
