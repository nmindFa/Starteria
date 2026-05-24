-- TASK-006: PDF autofill schema (SPEC-002, ADR-007 deferred to S3 in a later TASK)
-- V1: local-disk storage; this migration only creates the relational metadata.

-- CreateEnum
CREATE TYPE "PdfStatus" AS ENUM ('UPLOADED', 'PARSING', 'EXTRACTING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "ExtractionRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'COST_CAPPED');

-- CreateEnum
CREATE TYPE "ConfidenceBand" AS ENUM ('HIGH', 'MED', 'LOW');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EDITED', 'DISCARDED');

-- CreateTable: InitiativePdf
CREATE TABLE "InitiativePdf" (
    "id"               TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "fileKey"          TEXT NOT NULL,
    "fileName"         TEXT NOT NULL,
    "mimeType"         TEXT NOT NULL,
    "fileSize"         INTEGER NOT NULL,
    "uploadedBy"       TEXT NOT NULL,
    "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionUntil"   TIMESTAMP(3),
    "deletedAt"        TIMESTAMP(3),
    "status"           "PdfStatus" NOT NULL DEFAULT 'UPLOADED',
    "languageDetected" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativePdf_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PdfExtractionRun
CREATE TABLE "PdfExtractionRun" (
    "id"          TEXT NOT NULL,
    "pdfId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "status"      "ExtractionRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt"   TIMESTAMP(3),
    "finishedAt"  TIMESTAMP(3),
    "costUsd"     DECIMAL(10,4),
    "tokensIn"    INTEGER,
    "tokensOut"   INTEGER,
    "model"       TEXT,
    "language"    TEXT,
    "errorReason" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PdfFieldProposal
CREATE TABLE "PdfFieldProposal" (
    "id"             TEXT NOT NULL,
    "runId"          TEXT NOT NULL,
    "projectId"      TEXT NOT NULL,
    "fieldPath"      TEXT NOT NULL,
    "proposedValue"  JSONB NOT NULL,
    "provenance"     JSONB NOT NULL,
    "confidence"     DOUBLE PRECISION NOT NULL,
    "confidenceBand" "ConfidenceBand" NOT NULL,
    "status"         "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "finalValue"     JSONB,
    "confirmedBy"    TEXT,
    "confirmedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfFieldProposal_pkey" PRIMARY KEY ("id")
);

-- Indexes / Uniques
CREATE UNIQUE INDEX "InitiativePdf_fileKey_key" ON "InitiativePdf"("fileKey");
CREATE INDEX "InitiativePdf_projectId_idx"      ON "InitiativePdf"("projectId");
CREATE INDEX "InitiativePdf_status_idx"         ON "InitiativePdf"("status");
CREATE INDEX "InitiativePdf_retentionUntil_idx" ON "InitiativePdf"("retentionUntil");

CREATE INDEX "PdfExtractionRun_pdfId_idx"             ON "PdfExtractionRun"("pdfId");
CREATE INDEX "PdfExtractionRun_projectId_status_idx"  ON "PdfExtractionRun"("projectId", "status");
CREATE INDEX "PdfExtractionRun_status_idx"            ON "PdfExtractionRun"("status");

CREATE INDEX "PdfFieldProposal_runId_fieldPath_idx"   ON "PdfFieldProposal"("runId", "fieldPath");
CREATE INDEX "PdfFieldProposal_projectId_status_idx"  ON "PdfFieldProposal"("projectId", "status");

-- Foreign keys
ALTER TABLE "InitiativePdf"
    ADD CONSTRAINT "InitiativePdf_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PdfExtractionRun"
    ADD CONSTRAINT "PdfExtractionRun_pdfId_fkey"
    FOREIGN KEY ("pdfId") REFERENCES "InitiativePdf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PdfFieldProposal"
    ADD CONSTRAINT "PdfFieldProposal_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "PdfExtractionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
