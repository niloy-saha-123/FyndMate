/**
 * @file src/services/report.service.ts
 * @description Manages user reporting and automatic enforcement actions.
 */

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { sanitizeText } from '../utils/sanitizeText.js';
import {
    REPORT_REASON_MIN_LENGTH,
    REPORT_REASON_MAX_LENGTH,
} from '../schemas/validation-constants.js';

export class ReportService {
    /**
     * Report a user and auto-block them.
     * Allowed only for users who matched with me or sent me an incoming like.
     */
    async reportUser(reporterId: string, reportedId: string, reason: string) {
        if (reporterId === reportedId) {
            throw new Error('Cannot report yourself.');
        }

        const sanitizedReason = sanitizeText(reason);
        if (sanitizedReason.length < REPORT_REASON_MIN_LENGTH) {
            throw new Error(`Report reason must be at least ${REPORT_REASON_MIN_LENGTH} characters.`);
        }
        if (sanitizedReason.length > REPORT_REASON_MAX_LENGTH) {
            throw new Error(`Report reason cannot exceed ${REPORT_REASON_MAX_LENGTH} characters.`);
        }

        const [targetUser, matchExists, incomingLikeExists] = await Promise.all([
            prisma.user.findUnique({
                where: { id: reportedId },
                select: { id: true },
            }),
            prisma.match.findFirst({
                where: {
                    status: 'active',
                    OR: [
                        { user1Id: reporterId, user2Id: reportedId },
                        { user1Id: reportedId, user2Id: reporterId },
                    ],
                },
                select: { id: true },
            }),
            prisma.like.findFirst({
                where: {
                    likerId: reportedId,
                    likedId: reporterId,
                    liked: true,
                    status: 'active',
                },
                select: { id: true },
            }),
        ]);

        if (!targetUser) {
            throw new Error('Cannot report this user.');
        }
        if (!matchExists && !incomingLikeExists) {
            throw new Error('You can only report users who matched with you or liked you.');
        }

        const result = await prisma.$transaction(async (tx) => {
            const report = await tx.report.create({
                data: {
                    reporterId,
                    reportedId,
                    reason: sanitizedReason,
                },
            });

            await tx.block.upsert({
                where: {
                    blockerId_blockedId: {
                        blockerId: reporterId,
                        blockedId: reportedId,
                    },
                },
                create: {
                    blockerId: reporterId,
                    blockedId: reportedId,
                },
                update: {},
            });

            // Keep match/messages in DB, but mark as reported and inaccessible to users.
            await tx.match.updateMany({
                where: {
                    OR: [
                        { user1Id: reporterId, user2Id: reportedId },
                        { user1Id: reportedId, user2Id: reporterId },
                    ],
                },
                data: {
                    status: 'reported',
                    blockedBy: reporterId,
                },
            });

            await tx.like.updateMany({
                where: {
                    OR: [
                        { likerId: reporterId, likedId: reportedId },
                        { likerId: reportedId, likedId: reporterId },
                    ],
                },
                data: { status: 'archived' },
            });

            return report;
        });

        await Promise.all([
            redis.del(`feed:${reporterId}`),
            redis.del(`feed:${reportedId}`),
        ]).catch(() => {});

        return result;
    }
}

export const reportService = new ReportService();
