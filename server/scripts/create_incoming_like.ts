/**
 * Quick script to create an incoming like from Alice to the postman test user
 * This allows testing of blocking and matching in Postman
 */

import { prisma } from '../src/lib/prisma.js';

async function createIncomingLike() {
    console.log('🔍 Finding users...');

    // Find the postman test user
    const testUser = await prisma.user.findUnique({
        where: { email: 'postman_final@fyndmate.com' }
    });

    if (!testUser) {
        console.error('❌ Test user not found. Run: npm run token:local');
        process.exit(1);
    }

    // Find Alice
    const alice = await prisma.user.findFirst({
        where: { name: 'Alice' }
    });

    if (!alice) {
        console.error('❌ Alice not found. Run: npm run db:local:seed');
        process.exit(1);
    }

    console.log(`✅ Found test user: ${testUser.email} (${testUser.id})`);
    console.log(`✅ Found Alice: ${alice.email} (${alice.id})`);

    // Check if like already exists
    const existingLike = await prisma.like.findFirst({
        where: {
            likerId: alice.id,
            likedId: testUser.id
        }
    });

    if (existingLike) {
        console.log('✅ Alice already liked you!');
        console.log('   Like ID:', existingLike.id);
        return;
    }

    // Create the incoming like
    console.log('\n💌 Creating incoming like from Alice...');
    const like = await prisma.like.create({
        data: {
            likerId: alice.id,
            likedId: testUser.id,
            liked: true,
            message: 'Hey! I really like your GitHub projects. Want to collaborate?',
            status: 'active'
        }
    });

    console.log('✅ Incoming like created!');
    console.log('\n📊 Summary:');
    console.log('   Alice liked YOU');
    console.log('   Like ID:', like.id);
    console.log('   Message:', like.message);

    console.log('\n🧪 Now you can test in Postman:');
    console.log('   1. Block Alice (use her ID:', alice.id, ')');
    console.log('   2. OR like Alice back to create a match!');
    console.log('   3. Then run "Get Matches" to see the match');

    await prisma.$disconnect();
}

createIncomingLike().catch(console.error);
