/**
 * @file src/routes/upload.routes.ts
 * @description API endpoints for profile picture uploads.
 * Handles the secure upload flow: Request Signed URL -> Direct Upload -> Confirm Upload.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { checkUploadRateLimit, getRemainingUploads, getUploadRateLimitTTL } from '../utils/rate-limit.js';
import {
  createSignedUploadUrl,
  validateUploadedFile,
  getPublicUrl,
  deleteFile,
} from '../services/storage.service.js';
import {
  requestUploadSchema,
  confirmUploadSchema,
  type RequestUploadInput,
  type ConfirmUploadInput,
} from '../schemas/upload.schema.js';
import { prisma } from '../lib/prisma.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { logUploadEvent, AuditAction } from '../services/audit.service.js';

/**
 * Register upload routes with the Fastify app.
 */
export default async function uploadRoutes(app: FastifyInstance) {

  /**
   * POST /api/upload/profile-picture/request
   * Request a signed URL to upload a profile picture directly to Supabase Storage.
   */
  app.post(
    '/profile-picture/request',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        // Check rate limit (5 uploads per hour)
        if (!(await checkUploadRateLimit(userId))) {
          const remaining = await getRemainingUploads(userId);
          const retryAfter = await getUploadRateLimitTTL(userId);
          
          // Structured logging for rate limit violations
          request.log.warn({
            event: 'upload_rate_limit_exceeded',
            userId: userId,
            ip: request.ip,
            endpoint: '/api/upload/profile-picture/request',
            limit: 5,
            window: 3600,
            retryAfter: retryAfter,
            userAgent: request.headers['user-agent'],
            timestamp: new Date().toISOString(),
          }, 'Upload rate limit exceeded');
          
          return reply.status(429)
            .header('Retry-After', retryAfter.toString())
            .header('X-RateLimit-Limit', '5')
            .header('X-RateLimit-Remaining', '0')
            .header('X-RateLimit-Reset', (Date.now() + (retryAfter * 1000)).toString())
            .send({
              error: 'Rate limit exceeded',
              details: 'You can only upload 5 profile pictures per hour. Please try again later.',
              remainingUploads: remaining,
              retryAfter: retryAfter,
            });
        }

        const parseResult = requestUploadSchema.safeParse(request.body);

        if (!parseResult.success) {
          const firstIssue = parseResult.error.issues[0];
          return reply.status(400).send({
            error: 'Validation failed',
            details: firstIssue?.message || 'Invalid request body',
          });
        }

        const { fileExtension } = parseResult.data;

        const { signedUrl, path, expiresAt } = await createSignedUploadUrl(
          userId,
          fileExtension
        );

        // Create upload session for IP binding and one-time use enforcement
        await prisma.uploadSession.create({
          data: {
            userId,
            uploadPath: path,
            expiresAt,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          },
        });

        request.log.info(
          { userId, uploadPath: path, ipAddress: request.ip },
          'Upload session created with IP binding'
        );

        const remainingUploads = await getRemainingUploads(userId);

        return reply.status(200).send({
          signedUrl,
          uploadPath: path,
          expiresAt: expiresAt.toISOString(),
          remainingUploads,
        });

      } catch (error) {
        request.log.error(error, 'Failed to generate signed upload URL');
        return reply.status(500).send({
          error: 'Failed to generate upload URL',
          details: 'An unexpected error occurred. Please try again.',
        });
      }
    }
  );

  /**
   * POST /api/upload/profile-picture/confirm
   * Confirm that a profile picture was uploaded successfully.
   * Validates the file against session requirements and updates the user profile.
   */
  app.post(
    '/profile-picture/confirm',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        const parseResult = confirmUploadSchema.safeParse(request.body);

        if (!parseResult.success) {
          const firstIssue = parseResult.error.issues[0];
          return reply.status(400).send({
            error: 'Validation failed',
            details: firstIssue?.message || 'Invalid request body',
          });
        }

        const { uploadPath, idempotencyKey } = parseResult.data;

        // Idempotency check
        if (idempotencyKey) {
          const existingSession = await prisma.uploadSession.findFirst({
            where: {
              userId,
              confirmedAt: { not: null },
            },
            orderBy: { confirmedAt: 'desc' },
            take: 10,
          });

          if (existingSession && existingSession.confirmedAt) {
            const timeSinceLastConfirm = Date.now() - existingSession.confirmedAt.getTime();
            if (timeSinceLastConfirm < 5000) {
              request.log.info(
                { userId, idempotencyKey, uploadPath },
                'Potential duplicate request detected (same user confirmed <5s ago)'
              );
            }
          }
        }

        // Verify upload path ownership
        const pathUserId = uploadPath.split('/')[0];

        if (pathUserId !== userId) {
          request.log.warn(
            { userId, pathUserId, uploadPath },
            'User attempted to confirm upload for different user'
          );
          return reply.status(403).send({
            error: 'Access denied',
            details: 'You can only confirm your own uploads',
          });
        }

        // Validate session (IP binding, expiration, one-time use)
        const uploadSession = await prisma.uploadSession.findUnique({
          where: { uploadPath },
        });

        if (!uploadSession) {
          return reply.status(403).send({
            error: 'Invalid upload session',
            details: 'This upload was not initiated through the proper flow',
          });
        }

        if (uploadSession.used) {
          return reply.status(403).send({
            error: 'Upload URL already used',
            details: 'This upload link can only be used once',
          });
        }

        if (new Date() > uploadSession.expiresAt) {
          return reply.status(403).send({
            error: 'Upload URL expired',
            details: 'This upload link has expired. Please request a new one',
          });
        }

        if (uploadSession.ipAddress !== request.ip) {
          request.log.warn(
            {
              userId,
              uploadPath,
              expectedIp: uploadSession.ipAddress,
              actualIp: request.ip,
            },
            'IP mismatch - possible URL leakage'
          );
          return reply.status(403).send({
            error: 'IP address mismatch',
            details: 'This upload link can only be used from the device that requested it',
          });
        }

        await prisma.uploadSession.update({
          where: { uploadPath },
          data: {
            used: true,
            usedAt: new Date(),
          },
        });

        // Verify file timestamp prevents race condition attacks
        try {
          const fileName = uploadPath.split('/')[1];
          const { data: fileList } = await supabaseAdmin.storage
            .from('profile-pictures')
            .list(userId, {
              search: fileName,
            });

          if (!fileList || fileList.length === 0) {
            return reply.status(404).send({
              error: 'File not found',
              details: 'Upload path does not exist',
            });
          }

          const fileMetadata = fileList[0];
          const fileUploadTime = new Date(fileMetadata.created_at);

          const authHeader = request.headers.authorization || '';
          const token = authHeader.replace('Bearer ', '');
          const { data: authData } = await supabaseAdmin.auth.getUser(token);

          if (!authData?.user) {
            return reply.status(401).send({
              error: 'Invalid session',
              details: 'Could not verify user session',
            });
          }

          const userCreatedAt = new Date(authData.user.created_at);

          if (fileUploadTime < userCreatedAt) {
            await deleteFile(uploadPath);

            return reply.status(403).send({
              error: 'Upload expired',
              details: 'This file was uploaded before your current session and cannot be confirmed',
            });
          }
        } catch (timestampCheckError) {
          request.log.error(
            { error: timestampCheckError, userId, uploadPath },
            'Failed to validate file timestamp'
          );
        }

        // Validate the uploaded file content matches constraints
        const validation = await validateUploadedFile(uploadPath);

        if (!validation.valid) {
          return reply.status(400).send({
            error: 'File validation failed',
            details: validation.error,
          });
        }

        const publicUrl = getPublicUrl(uploadPath);

        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { profilePicture: true },
        });

        // Cleanup orphaned files
        try {
          const { data: userFiles } = await supabaseAdmin.storage
            .from('profile-pictures')
            .list(userId);

          if (userFiles && userFiles.length > 0) {
            const filesToDelete: string[] = [];

            for (const file of userFiles) {
              const filePath = `${userId}/${file.name}`;

              if (filePath === uploadPath) continue;
              if (currentUser?.profilePicture && currentUser.profilePicture.includes(file.name)) continue;

              filesToDelete.push(filePath);
            }

            if (filesToDelete.length > 0) {
              await supabaseAdmin.storage
                .from('profile-pictures')
                .remove(filesToDelete);
            }
          }
        } catch (cleanupError) {
          request.log.warn(
            { userId, error: cleanupError },
            'Failed to clean up orphaned files (non-critical)'
          );
        }

        // Delete old profile picture
        if (currentUser?.profilePicture) {
          await deleteFile(currentUser.profilePicture);
        }

        // Update database
        await prisma.user.update({
          where: { id: userId },
          data: { profilePicture: publicUrl },
        });

        await prisma.uploadSession.update({
          where: { uploadPath },
          data: { confirmedAt: new Date() },
        });

        await logUploadEvent(request, {
          userId,
          action: AuditAction.PROFILE_PICTURE_UPLOAD,
          oldValue: currentUser?.profilePicture,
          newValue: publicUrl,
          metadata: {
            fileSize: validation.size,
            mimeType: validation.mimeType,
            uploadPath,
          },
          status: 'SUCCESS',
        });

        return reply.status(200).send({
          publicUrl,
          message: 'Profile picture updated successfully',
        });

      } catch (error) {
        request.log.error(error, 'Failed to confirm profile picture upload');

        await logUploadEvent(request, {
          userId: request.user?.id || 'unknown',
          action: AuditAction.PROFILE_PICTURE_UPLOAD,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        }).catch((auditError) => {
          request.log.error(auditError, 'Failed to log failed upload to audit trail');
        });

        return reply.status(500).send({
          error: 'Failed to update profile picture',
          details: 'An unexpected error occurred. Please try again.',
        });
      }
    }
  );
}

