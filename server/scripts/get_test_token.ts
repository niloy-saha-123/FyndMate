/**
 * @file scripts/get_test_token.ts
 * @description Helper script to generate a valid JWT Access Token for API testing (e.g., Postman).
 *
 * PURPOSE:
 * - Authenticates a test user (`postman_final@fyndmate.com`) against the Supabase Auth instance.
 * - Uses the Service Role Key to bypass email confirmation steps (auto-confirms user).
 * - Prints the `access_token` to the console.
 *
 * SAFETY GUARD:
 * - Checks SUPABASE_URL to ensure it is targeting LOCALHOST before running.
 *
 * USAGE:
 * - Run: `npx tsx scripts/get_test_token.ts`
 * - Copy the output token into Postman "Variables" -> "jwtToken".
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from server root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = "http://127.0.0.1:54321"; // Force Local URL
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"; // Force Local DB

// Force Database URL to be local before importing Prisma
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes("localhost") && !process.env.DATABASE_URL.includes("127.0.0.1")) {
    console.log("⚠️  Forcing DATABASE_URL to Local Default (Safety Guard)");
    process.env.DATABASE_URL = LOCAL_DB_URL;
}

if (!SUPABASE_URL.includes("localhost") && !SUPABASE_URL.includes("127.0.0.1")) {
    console.error("\n❌ SAFETY ERROR: This script is for LOCAL DEVELOPMENT ONLY.");
    process.exit(1);
}

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("\n❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Import Prisma AFTER setting env var
import { prisma } from '../src/lib/prisma.js';


const TEST_EMAIL = "postman_final@fyndmate.com";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "password123";

async function getToken() {
    console.log(`🔄 Setting up test user: ${TEST_EMAIL}...`);

    // ==================================================
    // STEP 1: CLEANUP - Remove existing test user data
    // ==================================================
    console.log("🧹 Cleaning up existing test user data...");

    // Delete from database first (if exists)
    const existingDbUser = await prisma.user.findUnique({
        where: { email: TEST_EMAIL }
    });

    if (existingDbUser) {
        console.log("  ↳ Deleting existing database user...");
        // Cascade delete will handle related records (likes, matches, etc.)
        await prisma.user.delete({
            where: { id: existingDbUser.id }
        });
        console.log("  ✓ Database user deleted");
    }

    // List all Supabase Auth users to find and delete existing one
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (!listError && users) {
        const existingAuthUser = users.find(u => u.email === TEST_EMAIL);
        if (existingAuthUser) {
            console.log("  ↳ Deleting existing Supabase Auth user...");
            await supabase.auth.admin.deleteUser(existingAuthUser.id);
            console.log("  ✓ Auth user deleted");
        }
    }

    // ==================================================
    // STEP 2: CREATE - Fresh user in Supabase Auth
    // ==================================================
    console.log("🔐 Creating user in Supabase Auth...");
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true
    });

    if (createError || !userData.user) {
        console.error("❌ Failed to create Auth user:", createError?.message);
        process.exit(1);
    }

    const supabaseUserId = userData.user.id;
    console.log(`  ✓ Auth user created (ID: ${supabaseUserId})`);

    // ==================================================
    // STEP 3: CREATE - Database user record
    // ==================================================
    console.log("💾 Creating user in database...");
    const dbUser = await prisma.user.create({
        data: {
            supabaseId: supabaseUserId,
            email: TEST_EMAIL,
            name: "Postman Test User",
            profilePicture: "https://avatar.iran.liara.run/public/42",
            bio: "Test user for Postman API testing",
            location: "Test City",
            timezone: "UTC",
            skills: ["TypeScript", "React", "Node.js"],
            interests: ["Testing", "APIs", "Automation"]
        }
    });
    console.log(`  ✓ Database user created (ID: ${dbUser.id})`);

    // ==================================================
    // STEP 4: AUTHENTICATE - Get JWT token
    // ==================================================
    console.log("🔑 Generating JWT token...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    if (!signInData.session) {
        console.error("❌ Login Failed:", signInError?.message);
        process.exit(1);
    }

    // ==================================================
    // SUCCESS - Display token
    // ==================================================
    console.log("\n" + "=".repeat(60));
    console.log("✅ Test User Ready!");
    console.log("=".repeat(60));
    console.log(`📧 Email: ${TEST_EMAIL}`);
    console.log(`🔑 Password: ${TEST_PASSWORD}`);
    console.log(`🆔 Database ID: ${dbUser.id}`);
    console.log(`🔐 Supabase ID: ${supabaseUserId}`);
    console.log("=".repeat(60));
    console.log("\n👇 COPY THIS TOKEN TO POSTMAN (Variable: jwtToken) 👇\n");
    console.log(signInData.session.access_token);
    console.log("\n" + "=".repeat(60));
}

getToken();
