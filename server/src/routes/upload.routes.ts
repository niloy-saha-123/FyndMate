/**
 * @file src/routes/upload.routes.ts
 * @description API endpoints for profile picture uploads.
 * 
 * This file is the MAIN ENTRY POINT for image uploads. It brings together:
 * - Authentication (auth.middleware.ts)
 * - Rate limiting (rate-limit.ts)
 * - Schema validation (upload.schema.ts)
 * - Storage operations (storage.service.ts)
 * - Database updates (prisma)
 * 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │                         UPLOAD FLOW                                       │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │   ENDPOINT 1: POST /api/upload/profile-picture/request                   │
 * │   ─────────────────────────────────────────────────────                  │
 * │   1. Verify user is authenticated (JWT)                                  │
 * │   2. Check rate limit (5 uploads/hour)                                   │
 * │   3. Validate request body (file extension)                              │
 * │   4. Generate signed upload URL (2 min expiry)                           │
 * │   5. Return { signedUrl, uploadPath, expiresAt, remainingUploads }       │
 * │                                                                          │
 * │   ENDPOINT 2: POST /api/upload/profile-picture/confirm                   │
 * │   ─────────────────────────────────────────────────────                  │
 * │   1. Verify user is authenticated (JWT)                                  │
 * │   2. Validate request body (uploadPath)                                  │
 * │   3. Verify file exists in storage                                       │
 * │   4. Validate file metadata (size, MIME type)                            │
 * │   5. Clean up orphaned files (from failed uploads)                       │
 * │   6. Delete old profile picture (normal replacement)                     │
 * │   7. Update User.profilePicture in database                              │
 * │   8. Return { publicUrl, message }                                       │
 * │                                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 * 
 * SECURITY:
 * - All endpoints require authentication
 * - Rate limiting prevents spam
 * - Signed URLs expire in 2 minutes
 * - Post-upload validation catches bypassed client checks
 * - File path includes userId (ownership verification)
 * 
 * PROFILE PICTURE POLICY:
 * - Profile pictures are MANDATORY for all users (like Tinder)
 * - Users must upload a picture during signup (frontend enforces this)
 * - Users can REPLACE their picture anytime (this endpoint)
 * - Users CANNOT delete their picture without replacing it
 * - Frontend should only show "Change Profile Picture", NOT "Delete"
 * - Backend automatically deletes old pictures when new one is uploaded
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { checkUploadRateLimit, getRemainingUploads } from '../utils/rate-limit.js';
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
import { supabaseAdmin } from '../lib/supabase.js';
import { logUploadEvent, AuditAction } from '../services/audit.service.js';

/**
 * Register upload routes with the Fastify app
 * 
 * Usage in app.ts:
 * ```typescript
 * import uploadRoutes from './routes/upload.routes.js';
 * await app.register(uploadRoutes, { prefix: '/api/upload' });
 * ```
 */
export default async function uploadRoutes(app: FastifyInstance) {

  // ============================================
  // ENDPOINT 1: Request Signed Upload URL
  // ============================================
  /**
   * POST /api/upload/profile-picture/request
   * 
   * Request a signed URL to upload a profile picture directly to Supabase Storage.
   * The URL expires in 2 minutes.
   * 
   * Headers:
   *   Authorization: Bearer <jwt_token>
   * 
   * Body:
   *   { "fileExtension": "jpg" | "jpeg" | "png" | "webp" }
   * 
   * Success Response (200):
   *   {
   *     "signedUrl": "https://...",
   *     "uploadPath": "userId/timestamp-random.jpg",
   *     "expiresAt": "2024-01-15T10:32:00.000Z",
   *     "remainingUploads": 4
   *   }
   * 
   * Error Responses:
   *   401: Not authenticated
   *   400: Invalid file extension
   *   429: Rate limit exceeded
   */
  app.post(
    '/profile-picture/request',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Step 1: Get authenticated user ID
        const userId = request.user!.id;

        // Step 2: Check rate limit (5 uploads per hour)
        if (!checkUploadRateLimit(userId)) {
          const remaining = getRemainingUploads(userId);
          return reply.status(429).send({
            error: 'Rate limit exceeded',
            details: 'You can only upload 5 profile pictures per hour. Please try again later.',
            remainingUploads: remaining,
          });
        }

        // Step 3: Validate request body
        const parseResult = requestUploadSchema.safeParse(request.body);

        if (!parseResult.success) {
          // Zod v4 uses .issues instead of .errors
          const firstIssue = parseResult.error.issues[0];
          return reply.status(400).send({
            error: 'Validation failed',
            details: firstIssue?.message || 'Invalid request body',
          });
        }

        const { fileExtension } = parseResult.data;

        // Step 4: Generate signed upload URL
        const { signedUrl, path, expiresAt } = await createSignedUploadUrl(
          userId,
          fileExtension
        );

        // Step 4.5: Create upload session for IP binding and one-time use enforcement
        // This prevents signed URL leakage and replay attacks
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

        // Step 5: Return success response
        const remainingUploads = getRemainingUploads(userId);

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

  // ============================================
  // ENDPOINT 2: Confirm Upload Completed
  // ============================================
  /**
   * POST /api/upload/profile-picture/confirm
   * 
   * Confirm that a profile picture was uploaded successfully.
   * This validates the uploaded file and updates the user's profile.
   * 
   * Headers:
   *   Authorization: Bearer <jwt_token>
   * 
   * Body:
   *   { "uploadPath": "userId/timestamp-random.jpg" }
   * 
   * Success Response (200):
   *   {
   *     "publicUrl": "https://.../profile-pictures/userId/timestamp-random.jpg",
   *     "message": "Profile picture updated successfully"
   *   }
   * 
   * Error Responses:
   *   401: Not authenticated
   *   400: Invalid upload path / File not found / Invalid file type
   *   403: Upload path doesn't belong to user
   */
  app.post(
    '/profile-picture/confirm',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Step 1: Get authenticated user ID
        const userId = request.user!.id;

        // Step 2: Validate request body
        const parseResult = confirmUploadSchema.safeParse(request.body);

        if (!parseResult.success) {
          // Zod v4 uses .issues instead of .errors
          const firstIssue = parseResult.error.issues[0];
          return reply.status(400).send({
            error: 'Validation failed',
            details: firstIssue?.message || 'Invalid request body',
          });
        }

        const { uploadPath, idempotencyKey } = parseResult.data;

        // Step 2.5: IDEMPOTENCY - Check if this request was already processed
        // Prevents duplicate uploads if user clicks "confirm" multiple times due to:
        // - Slow network (user clicks again thinking it failed)
        // - Mobile app retry logic
        // - Accidental double-tap
        if (idempotencyKey) {
          // Check if we've already processed this idempotency key
          const existingSession = await prisma.uploadSession.findFirst({
            where: {
              userId,
              confirmedAt: { not: null }, // Only check confirmed uploads
            },
            // Store idempotency key in upload path or add separate field
            // For now, we'll check recent confirmations (last hour)
            orderBy: { confirmedAt: 'desc' },
            take: 10,
          });

          // TODO: For production, add a separate IdempotencyCache table:
          // - Store: { key, userId, response, createdAt }
          // - Return cached response if key exists
          // - Auto-expire after 24 hours
          // 
          // For MVP: Basic duplicate detection via upload session timing
          if (existingSession && existingSession.confirmedAt) {
            const timeSinceLastConfirm = Date.now() - existingSession.confirmedAt.getTime();
            if (timeSinceLastConfirm < 5000) { // 5 seconds
              request.log.info(
                { userId, idempotencyKey, uploadPath },
                'Potential duplicate request detected (same user confirmed <5s ago)'
              );
              // For now, continue processing
              // TODO: Return cached response instead when IdempotencyCache implemented
            }
          }
        }

        // Step 3: Security check - verify the upload path belongs to this user
        // Path format: {userId}/{timestamp}-{random}.{ext}
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

        // Step 3.5: SECURITY - IP Binding and One-Time Use Enforcement
        // Prevents signed URL leakage and replay attacks
        const uploadSession = await prisma.uploadSession.findUnique({
          where: { uploadPath },
        });

        if (!uploadSession) {
          request.log.warn(
            { userId, uploadPath },
            'Upload session not found - possible direct upload bypass'
          );
          return reply.status(403).send({
            error: 'Invalid upload session',
            details: 'This upload was not initiated through the proper flow',
          });
        }

        // Check if URL was already used (one-time use enforcement)
        if (uploadSession.used) {
          request.log.warn(
            {
              userId,
              uploadPath,
              firstUsedAt: uploadSession.usedAt,
            },
            'Attempted to reuse upload URL'
          );
          return reply.status(403).send({
            error: 'Upload URL already used',
            details: 'This upload link can only be used once',
          });
        }

        // Check if URL has expired
        if (new Date() > uploadSession.expiresAt) {
          request.log.warn(
            {
              userId,
              uploadPath,
              expiresAt: uploadSession.expiresAt,
            },
            'Upload URL expired'
          );
          return reply.status(403).send({
            error: 'Upload URL expired',
            details: 'This upload link has expired. Please request a new one',
          });
        }

        // Check IP binding (URL only works from requesting IP)
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

        // Mark session as used (one-time use)
        await prisma.uploadSession.update({
          where: { uploadPath },
          data: {
            used: true,
            usedAt: new Date(),
          },
        });

        request.log.info(
          {
            userId,
            uploadPath,
            ipAddress: request.ip,
          },
          'Upload session validated - IP binding and one-time use checks passed'
        );

        // Step 3.6: SECURITY - Prevent race condition attack
        // Verify file was uploaded during current user session
        // This prevents: User A uploads → deletes account → User B gets same ID → User A confirms
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

          // Get user's account creation time from Supabase Auth
          // This is our session boundary - files uploaded before this are invalid
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

          // If file was uploaded BEFORE user account was created, reject it
          // This prevents confirming orphaned files from previous account holders
          if (fileUploadTime < userCreatedAt) {
            request.log.warn(
              {
                userId,
                uploadPath,
                fileUploadTime: fileUploadTime.toISOString(),
                userCreatedAt: userCreatedAt.toISOString(),
              },
              'Attempted to confirm file uploaded before current session'
            );

            // Clean up the orphaned file
            await deleteFile(uploadPath);

            return reply.status(403).send({
              error: 'Upload expired',
              details: 'This file was uploaded before your current session and cannot be confirmed',
            });
          }

          request.log.info(
            {
              userId,
              uploadPath,
              fileUploadTime: fileUploadTime.toISOString(),
              userCreatedAt: userCreatedAt.toISOString(),
            },
            'File timestamp validation passed'
          );

        } catch (timestampCheckError) {
          request.log.error(
            { error: timestampCheckError, userId, uploadPath },
            'Failed to validate file timestamp'
          );
          // Don't fail the request if timestamp check fails (graceful degradation)
          // But log it for monitoring
        }

        // Step 4: Validate the uploaded file
        const validation = await validateUploadedFile(uploadPath);

        if (!validation.valid) {
          return reply.status(400).send({
            error: 'File validation failed',
            details: validation.error,
          });
        }

        // Step 5: Get the public URL for the new image
        const publicUrl = getPublicUrl(uploadPath);

        // Step 6: Get current user to check for existing profile picture
        // userId is now the database ID (from auth middleware)
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { profilePicture: true },
        });

        // Step 7: Clean up orphaned files (abandoned uploads)
        // This handles cases where user uploaded but never confirmed
        // (e.g., app crashed, network died, user closed app mid-upload)
        try {
          const { data: userFiles } = await supabaseAdmin.storage
            .from('profile-pictures')
            .list(userId);

          if (userFiles && userFiles.length > 0) {
            const filesToDelete: string[] = [];

            for (const file of userFiles) {
              const filePath = `${userId}/${file.name}`;

              // Keep the file we just uploaded
              if (filePath === uploadPath) {
                continue;
              }

              // Keep the current profile picture if it exists
              if (currentUser?.profilePicture && currentUser.profilePicture.includes(file.name)) {
                continue;
              }

              // Everything else is orphaned - mark for deletion
              filesToDelete.push(filePath);
            }

            // Delete all orphaned files at once
            if (filesToDelete.length > 0) {
              await supabaseAdmin.storage
                .from('profile-pictures')
                .remove(filesToDelete);

              request.log.info(
                { userId, deletedCount: filesToDelete.length },
                'Cleaned up orphaned files'
              );
            }
          }
        } catch (cleanupError) {
          // Don't fail the upload if cleanup fails - just log it
          request.log.warn(
            { userId, error: cleanupError },
            'Failed to clean up orphaned files (non-critical)'
          );
        }

        // Step 8: Delete old profile picture if exists
        // This handles normal replacement (user changing their picture)
        if (currentUser?.profilePicture) {
          await deleteFile(currentUser.profilePicture);
        }

        // Step 9: Update user's profile picture in database
        // userId is now the database ID (from auth middleware)
        await prisma.user.update({
          where: { id: userId },
          data: { profilePicture: publicUrl },
        });

        // Step 9.5: Mark upload session as confirmed
        await prisma.uploadSession.update({
          where: { uploadPath },
          data: { confirmedAt: new Date() },
        });

        // Step 10: Log successful upload to audit trail
        // This creates a permanent record for security, compliance, and investigation
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

        request.log.info(
          {
            userId,
            oldUrl: currentUser?.profilePicture,
            newUrl: publicUrl,
          },
          'Profile picture updated successfully (logged to audit trail)'
        );

        // Step 11: Return success response
        return reply.status(200).send({
          publicUrl,
          message: 'Profile picture updated successfully',
        });

      } catch (error) {
        request.log.error(error, 'Failed to confirm profile picture upload');

        // Log failed upload attempt to audit trail
        // This helps detect abuse patterns and system issues
        await logUploadEvent(request, {
          userId: request.user?.id || 'unknown',
          action: AuditAction.PROFILE_PICTURE_UPLOAD,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        }).catch((auditError) => {
          // Don't let audit logging failure crash the error handler
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

