# FyndMate Server

## 🧪 Testing Setup (Team Onboarding)

To run tests locally without messing up production, we use a local Docker database.

### Prerequisites
- Docker Desktop installed and running.
- Node.js installed.

### Quick Start
1.  **Initialize & Start DB**:
    ```bash
    npx supabase start
    ```
    *This spins up a local Postgres instance on port 54322.*

2.  **Configure Environment**:
    Run this command to create your `.env.test` file automatically:
    ```bash
    npm run test:setup
    ```

3.  **Run Tests**:
    ```bash
    npm test
    ```

### Troubleshooting
- **Deadlock detected?**: Tests are configured to run sequentially (`fileParallelism: false`) to avoid this.
- **DB URL**: The local Supabase DB is at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
