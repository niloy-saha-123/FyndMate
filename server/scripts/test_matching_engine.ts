/**
 * @file scripts/test_matching_engine.ts
 * @description Automated Integration Test for the Matching Engine.
 * 
 * RUN WITH: npx tsx scripts/test_matching_engine.ts
 * 
 * SCENARIOS:
 * 1. Feed Generation (Exclusions).
 * 2. Liking & Passing.
 * 3. Match Creation (Instant & Async).
 * 4. Blocking.
 */

import { prisma } from '../src/lib/prisma.js';
import { feedService } from '../src/services/feed.service.js';
import { likeService } from '../src/services/like.service.js';
import { matchService } from '../src/services/match.service.js';
import { blockService } from '../src/services/block.service.js';

const LOG = (msg: string) => console.log(`[TEST] ${msg}`);
const ASSERT = (condition: boolean, msg: string) => {
    if (!condition) {
        console.error(`❌ FAILED: ${msg}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${msg}`);
};

async function main() {
    LOG("Starting Matching Engine Test Suite...");

    // ==========================================
    // 1. SETUP: Clean DB & Seed Users
    // ==========================================
    LOG("Cleaning Database...");
    await prisma.message.deleteMany();
    await prisma.match.deleteMany();
    await prisma.like.deleteMany();
    await prisma.block.deleteMany();
    await prisma.user.deleteMany(); // Be careful running this in prod!

    LOG("Seeding Test Users...");
    const create = (name: string) => prisma.user.create({
        data: {
            name,
            email: `${name.toLowerCase()}@test.com`,
            supabaseId: `auth_${name}`,
            profilePicture: `https://avatar.com/${name}`,
            bio: `I am ${name}`,
            location: "Test City",
            timezone: "UTC"
        }
    });

    const A = await create("Alice");
    const B = await create("Bob");
    const C = await create("Charlie");
    const D = await create("David");
    const E = await create("Eve");

    // ==========================================
    // 2. TEST FEED (Basic)
    // ==========================================
    LOG("Testing Feed...");
    let feedA = await feedService.getFeed(A.id);
    const namesA = feedA.map(u => u.name).sort();

    // Alice should see everyone else (B, C, D, E)
    ASSERT(namesA.includes("Bob") && namesA.includes("Charlie"), "Alice sees other users");
    ASSERT(!namesA.includes("Alice"), "Alice does not see herself");

    // ==========================================
    // 3. TEST LIKE (A -> B)
    // ==========================================
    LOG("Testing Like (Alice -> Bob)...");
    await likeService.createLike(A.id, B.id, true, "Hi Bob! I'd love to connect with you!");

    feedA = await feedService.getFeed(A.id);
    const newNamesA = feedA.map(u => u.name);
    ASSERT(!newNamesA.includes("Bob"), "Bob removed from Alice's feed after liking");

    // ==========================================
    // 4. TEST LIKE (A -> C) -> PASS
    // ==========================================
    LOG("Testing Pass (Alice -> Charlie)...");
    await likeService.createLike(A.id, C.id, false);

    feedA = await feedService.getFeed(A.id);
    ASSERT(!feedA.map(u => u.name).includes("Charlie"), "Charlie removed from Alice's feed after passing");

    // ==========================================
    // 5. TEST MATCH (Bob -> Alice)
    // ==========================================
    LOG("Testing Match (Bob -> Alice)...");
    // Bob checks feed, sees Alice?
    const feedB = await feedService.getFeed(B.id);
    ASSERT(!feedB.some(u => u.id === A.id), "Bob does NOT see Alice in Feed (She is in 'Likes You')");

    const likesB = await likeService.getReceivedLikes(B.id);
    ASSERT(likesB.some(l => l.likerUser.id === A.id), "Bob sees Alice in 'Likes You' list");

    // Bob likes Alice (Reciprocal)
    const match = await likeService.createLike(B.id, A.id, true, "Hi Alice! That implies we are a match!");
    // Should return a Match object, not a Like object (if service logic returns accepted match)
    // NOTE: likeService.createLike returns result of matchService.acceptLike which is the Match.
    ASSERT(!!match && 'user1Id' in match, "Match object returned on instant match");

    // Verify Match in DB
    const matchesA = await matchService.getMatches(A.id);
    ASSERT(matchesA.length === 1, "Alice has 1 match");
    ASSERT(matchesA[0].user1.name === "Alice" || matchesA[0].user2.name === "Alice", "Match contains Alice");

    // Verify Exclusion
    const feedAgainA = await feedService.getFeed(A.id);
    ASSERT(!feedAgainA.some(u => u.name === "Bob"), "Bob still not in Alice's feed");
    const feedAgainB = await feedService.getFeed(B.id);
    ASSERT(!feedAgainB.some(u => u.name === "Alice"), "Alice removed from Bob's feed after match");

    // ==========================================
    // 6. TEST BLOCK (Alice blocks David)
    // ==========================================
    LOG("Testing Block (Alice -> David)...");

    // Prerequisite: Must iterate to block? service says "Must have interaction".
    // Let's create an interaction first. Alice Likes David.
    await likeService.createLike(A.id, D.id, true, "Hi David! I am liking you so I can block you.");

    await blockService.blockUser(A.id, D.id);

    // David should not see Alice
    const feedD = await feedService.getFeed(D.id);
    ASSERT(!feedD.some(u => u.name === "Alice"), "David cannot see Alice (Blocked)");

    // Alice should not see David
    const feedFinalA = await feedService.getFeed(A.id);
    ASSERT(!feedFinalA.some(u => u.name === "David"), "Alice cannot see David (Blocked)");

    LOG("🎉 ALL TESTS PASSED!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
