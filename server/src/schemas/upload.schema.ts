/**
 * @file src/schemas/upload.schema.ts
 * @description Zod validation schemas for profile picture upload endpoints.
 * 
 * Zod is a TypeScript-first schema validation library that:
 * - Validates request/response data at runtime
 * - Automatically generates TypeScript types
 * - Provides clear error messages for invalid data
 * 
 * WHY VALIDATION?
 * - Security: Reject malicious or malformed requests
 * - Type safety: Ensure data matches expected structure
 * - Error handling: Clear messages for debugging
 * - Documentation: Schemas serve as API contract
 * 
 * SCHEMAS IN THIS FILE:
 * 1. requestUploadSchema: Validates file extension when requesting signed URL
 * 2. requestUploadResponseSchema: Structure of successful URL response
 * 3. confirmUploadSchema: Validates upload path when confirming completion
 * 4. confirmUploadResponseSchema: Structure of successful confirmation
 * 5. uploadErrorResponseSchema: Structure of error responses
 */

import { z } from 'zod';

/**
 * Allowed file extensions for profile pictures
 * 
 * Only these extensions are accepted:
 * - jpg/jpeg: Most common, good compression
 * - png: Supports transparency
 * - webp: Modern format, smaller files, supported by React Native
 * 
 * Note: HEIC (iPhone default) should be converted to JPEG client-side
 */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

// ============================================
// REQUEST SCHEMAS (Validate incoming data)
// ============================================

/**
 * Schema for requesting a signed upload URL
 * 
 * Endpoint: POST /api/upload/profile-picture/request
 * 
 * Example request body:
 * {
 *   "fileExtension": "jpg",
 *   "fileSizeBytes": 2048576  // optional, 2MB
 * }
 * 
 * Validation:
 * - fileExtension: Must be one of the allowed types
 * - fileSizeBytes (optional): If provided, must be positive and under 5MB
 */
export const requestUploadSchema = z.object({
  fileExtension: z.enum(ALLOWED_EXTENSIONS, {
    message: 'File extension must be jpg, jpeg, png, or webp',
  }),
  // Optional: client can send file size for early rejection before upload
  // This saves bandwidth if file is too large
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, 'File size cannot exceed 5MB')
    .optional(),
});

// TypeScript type automatically generated from schema
// Type: { fileExtension: 'jpg' | 'jpeg' | 'png' | 'webp', fileSizeBytes?: number }
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

/**
 * Schema for confirming an upload was completed
 * 
 * Endpoint: POST /api/upload/profile-picture/confirm
 * 
 * Example request body:
 * {
 *   "uploadPath": "clx7abc123/1703849600-x7y8z9.jpg",
 *   "idempotencyKey": "upload-abc123-def456" // Optional: prevents duplicate processing
 * }
 * 
 * Validation:
 * - uploadPath: Must be a non-empty string (the path returned from request endpoint)
 * - idempotencyKey: Optional UUID/string to prevent duplicate submissions
 *   If the same key is sent twice, server returns the cached result instead of reprocessing
 */
export const confirmUploadSchema = z.object({
  uploadPath: z.string().min(1, 'Upload path is required'),

  // Idempotency key: prevents duplicate uploads if user clicks "confirm" multiple times
  // Client should generate once per upload attempt (e.g., UUID v4)
  // Server caches result by key and returns same response for duplicate requests
  idempotencyKey: z.string().optional(),
});

// TypeScript type: { uploadPath: string; idempotencyKey?: string }
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

// ============================================
// RESPONSE SCHEMAS (Document API responses)
// ============================================

/**
 * Response schema for signed upload URL request
 * 
 * Example response:
 * {
 *   "signedUrl": "https://project.supabase.co/storage/v1/upload/sign/...",
 *   "uploadPath": "clx7abc123/1703849600-x7y8z9.jpg",
 *   "expiresAt": "2024-01-15T10:32:00.000Z",
 *   "remainingUploads": 4
 * }
 * 
 * Fields:
 * - signedUrl: Temporary URL for uploading (expires in 2 minutes)
 * - uploadPath: Path to use for confirmation after upload
 * - expiresAt: ISO timestamp when signed URL expires
 * - remainingUploads: How many more uploads user can make in current hour
 */
export const requestUploadResponseSchema = z.object({
  signedUrl: z.string().url(),
  uploadPath: z.string(),
  expiresAt: z.string().datetime(), // ISO 8601 format: "2024-01-15T10:30:00.000Z"
  remainingUploads: z.number().int().min(0).max(5),
});

// TypeScript type automatically generated
export type RequestUploadResponse = z.infer<typeof requestUploadResponseSchema>;

/**
 * Response schema for upload confirmation
 * 
 * Example response:
 * {
 *   "publicUrl": "https://project.supabase.co/storage/v1/object/public/profile-pictures/clx7abc123/1703849600-x7y8z9.jpg",
 *   "message": "Profile picture updated successfully"
 * }
 * 
 * Fields:
 * - publicUrl: Permanent public URL for the uploaded image
 * - message: Optional success message
 */
export const confirmUploadResponseSchema = z.object({
  publicUrl: z.string().url(),
  message: z.string().optional(),
});

// TypeScript type: { publicUrl: string, message?: string }
export type ConfirmUploadResponse = z.infer<typeof confirmUploadResponseSchema>;

/**
 * Error response schema
 * 
 * Example error response:
 * {
 *   "error": "Rate limit exceeded",
 *   "details": "You can upload again in 45 minutes",
 *   "remainingUploads": 0
 * }
 * 
 * Fields:
 * - error: Human-readable error message
 * - details: Optional additional context
 * - remainingUploads: Optional remaining upload quota (for rate limit errors)
 */
export const uploadErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  remainingUploads: z.number().int().min(0).max(5).optional(),
});

// TypeScript type: { error: string, details?: string, remainingUploads?: number }
export type UploadErrorResponse = z.infer<typeof uploadErrorResponseSchema>;

