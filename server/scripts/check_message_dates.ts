/**
 * Script to check message dates in the database
 * Helps identify any messages with incorrect/future dates
 */

import { config } from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkMessageDates() {
    console.log('🔍 Checking message dates in database...\n');
    
    try {
        // Get all messages with their dates
        const messages = await prisma.message.findMany({
            select: {
                id: true,
                content: true,
                createdAt: true,
                sender: {
                    select: {
                        name: true
                    }
                },
                match: {
                    select: {
                        user1: { select: { name: true } },
                        user2: { select: { name: true } }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        console.log(`📊 Found ${messages.length} messages in database:\n`);
        
        const now = new Date();
        let futureMessages = 0;
        let todayMessages = 0;
        let recentMessages = 0;
        
        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.createdAt);
            const timeDiff = msgDate.getTime() - now.getTime();
            const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            
            let status = '';
            if (daysDiff > 0) {
                status = `🚨 FUTURE DATE (+${daysDiff} days)`;
                futureMessages++;
            } else if (daysDiff === 0) {
                status = '📅 TODAY';
                todayMessages++;
            } else if (daysDiff > -7) {
                status = `🕒 Recent (${Math.abs(daysDiff)} days ago)`;
                recentMessages++;
            } else {
                status = `⏰ ${Math.abs(daysDiff)} days ago`;
            }
            
            console.log(`${index + 1}. ${status}`);
            console.log(`   From: ${msg.sender.name}`);
            console.log(`   Date: ${msgDate.toLocaleString()}`);
            console.log(`   Content: "${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}"`);
            console.log(`   ID: ${msg.id}\n`);
        });
        
        console.log('\n📈 Summary:');
        console.log(`   Future messages: ${futureMessages}`);
        console.log(`   Today's messages: ${todayMessages}`);
        console.log(`   Recent messages (<7 days): ${recentMessages}`);
        console.log(`   Total messages: ${messages.length}`);
        
        if (futureMessages > 0) {
            console.log('\n🚨 ACTION REQUIRED:');
            console.log('Found messages with future dates. These should be cleaned up.');
            console.log('Run: npm run db:local:seed to reset with clean test data');
        }
        
    } catch (error) {
        console.error('❌ Error checking message dates:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMessageDates()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });