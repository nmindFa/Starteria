# ADR-007: File Storage for Evidence Uploads

## Status
Accepted

## Date
2026-03-03

## Context
Dashboard Starteria requires users (owners/entrepreneurs) to upload evidence for project steps and modules. Evidence includes:

- Images (screenshots, photos of prototypes, diagrams) — typically 1-10 MB
- PDF documents (business plans, market research, financial projections) — typically 1-50 MB
- Videos (pitch recordings, product demos) — typically 50-500 MB
- Other documents (spreadsheets, presentations) — variable size

The storage solution must:
- Handle files from 1 MB to 500 MB reliably
- Serve files to authenticated users without exposing permanent URLs
- Scale independently of the application server
- Support development/testing without cloud service dependencies
- Be cost-effective for a growing platform with potentially thousands of evidence files
- Not burden the Express.js server with proxying large file uploads/downloads

## Decision
We will use **S3-compatible object storage with presigned URLs** for all evidence file uploads and downloads.

### Architecture
- **Production**: AWS S3 (or compatible service like DigitalOcean Spaces, Cloudflare R2)
- **Development**: MinIO running in Docker, providing an S3-compatible local environment
- **Upload flow**: Client requests a presigned upload URL from the backend -> client uploads directly to S3 -> client confirms upload -> backend stores file metadata in PostgreSQL
- **Download flow**: Client requests a presigned download URL from the backend -> client downloads directly from S3
- **Presigned URL expiry**: 15 minutes for uploads, 1 hour for downloads

### File Metadata Model (PostgreSQL)

```typescript
model Evidence {
  id          String   @id @default(uuid())
  projectId   String
  stepId      String
  moduleId    String?
  fileName    String   // Original file name
  fileKey     String   // S3 object key
  fileSize    Int      // Size in bytes
  mimeType    String   // MIME type
  uploadedBy  String   // User ID
  uploadedAt  DateTime @default(now())
}
```

### S3 Bucket Structure
```
evidence/
  {projectId}/
    {stepId}/
      {uuid}-{originalFileName}
```

### Upload Flow Detail
1. Frontend sends `POST /api/v1/evidence/presign` with `{ fileName, mimeType, stepId, moduleId }`
2. Backend validates permissions (ADR-004), generates a presigned PUT URL with 15-minute expiry
3. Frontend uploads file directly to S3 using the presigned URL (no server proxy)
4. Frontend sends `POST /api/v1/evidence` with `{ fileKey, fileName, mimeType, fileSize, stepId, moduleId }` to confirm
5. Backend verifies the object exists in S3 and creates the evidence record in PostgreSQL

## Consequences

### Positive
- Presigned URLs offload upload/download bandwidth from the Express.js server — files go directly to/from S3
- S3-compatible API means we can switch providers (AWS -> R2 -> Spaces) without code changes
- MinIO provides a production-identical local development experience
- Object storage scales independently — no filesystem capacity planning needed
- Presigned URLs with short expiry prevent unauthorized access to files
- S3 lifecycle policies can automatically archive or delete old files to control costs
- Multipart upload support enables reliable upload of large video files

### Negative
- Presigned URL flow is more complex than simple `multipart/form-data` upload to the server
- Two-step upload (presign + confirm) requires careful error handling for partial uploads
- S3 adds an external service dependency and cost (though minimal at MVP scale)
- CORS configuration on the S3 bucket must be correctly set up for browser-direct uploads
- MinIO Docker setup adds development environment complexity

### Neutral
- File metadata is stored in PostgreSQL, not in S3 — deleting a database record requires also deleting the S3 object (cleanup job needed)
- S3 does not provide image/video processing — if thumbnails or transcoding are needed, a separate service is required

## Alternatives Considered

### Local Filesystem Storage
- **Pros**: Simplest implementation, no external dependencies, no cost, fast for development
- **Cons**: Not scalable beyond a single server, lost on server restart (serverless), no CDN integration, manual backup required, filesystem capacity limits

### Cloudinary
- **Pros**: Built-in image/video processing (resize, transcode, optimize), CDN delivery, media-specific features (face detection, auto-crop), generous free tier
- **Cons**: Vendor lock-in to Cloudinary API, cost grows with transformations and bandwidth, not ideal for non-media files (PDFs, spreadsheets), media-processing features are not needed for evidence storage

### Database BLOB Storage
- **Pros**: Single storage system (PostgreSQL), transactional consistency between metadata and file data, simple backup (just backup the database)
- **Cons**: Terrible performance for large files, dramatically increases database size and backup time, PostgreSQL is not optimized for binary storage, connection pool exhaustion during large uploads

## References
- AWS S3 Presigned URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- MinIO Docker Setup: https://min.io/docs/minio/container/index.html
- S3-Compatible Storage Comparison: https://www.cloudflare.com/r2/
