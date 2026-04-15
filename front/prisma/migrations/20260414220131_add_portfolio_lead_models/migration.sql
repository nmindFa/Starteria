-- CreateEnum
CREATE TYPE "Role" AS ENUM ('participante', 'mentor', 'admin', 'sponsor', 'colaborador', 'viewer');

-- CreateEnum
CREATE TYPE "SponsorCheckpointStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'EXPIRED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AlignmentSignal" AS ENUM ('ALIGNED', 'CONCERNS', 'PIVOT_SUGGESTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'AI_REVIEW', 'ITERATION', 'EXPERT_SESSION_PENDING', 'STEP_APPROVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'AI_FEEDBACK', 'ADJUSTED', 'EXPERT_SESSION_PENDING', 'APPROVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'SUBMITTED', 'AI_FEEDBACK', 'ADJUSTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "Step0Status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('DRAFT', 'RUNNING', 'CLOSED', 'REVIEW_CHANGES');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE', 'PDF', 'VIDEO', 'LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('ACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING_SCHEDULE', 'SCHEDULED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SessionResult" AS ENUM ('APPROVED', 'ITERATE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('APPROVED', 'ITERATE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "HelpRequestStatus" AS ENUM ('PENDING', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "StrategicFrontStatus" AS ENUM ('draft', 'active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "StrategicFrontPriority" AS ENUM ('Alta', 'Media', 'Baja');

-- CreateEnum
CREATE TYPE "ChallengeActivationMode" AS ENUM ('convocatoria_abierta', 'personas_seleccionadas', 'squad_asignado');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('draft', 'listo_para_activar', 'activo_interno', 'publicado', 'recibiendo_iniciativas', 'con_iniciativas_activas', 'pendiente_de_decision', 'cerrado');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('correccion', 'crecimiento', 'exploracion');

-- CreateEnum
CREATE TYPE "StakeholderStatus" AS ENUM ('definido', 'notificado', 'confirmado');

-- CreateEnum
CREATE TYPE "ChallengeCoverageStatus" AS ENUM ('sin_cobertura', 'cobertura_parcial', 'cobertura_suficiente', 'resuelto', 'reformular', 'cerrar');

-- CreateEnum
CREATE TYPE "ChallengeOpenCallStatus" AS ENUM ('inactiva', 'activa');

-- CreateEnum
CREATE TYPE "InitiativePortfolioStatus" AS ENUM ('en_step_0', 'en_step_1', 'en_step_2', 'en_step_3', 'en_step_4', 'bloqueada', 'esperando_revision', 'lista_para_decision', 'cerrada');

-- CreateEnum
CREATE TYPE "InitiativeContributionType" AS ENUM ('descubrir', 'validar', 'resolver_parcialmente', 'resolver_directamente');

-- CreateEnum
CREATE TYPE "EstimatedContribution" AS ENUM ('bajo', 'medio', 'alto');

-- CreateEnum
CREATE TYPE "InitiativeOverlapLevel" AS ENUM ('bajo', 'medio', 'alto');

-- CreateEnum
CREATE TYPE "InitiativeOverlapRecommendation" AS ENUM ('seguir', 'fusionar', 'reformular_una', 'dejar_como_backup', 'cerrar_una');

-- CreateEnum
CREATE TYPE "ExecutiveOutputStatus" AS ENUM ('borrador_ejecutivo', 'listo_para_compartir', 'compartido_con_sponsor', 'compartido_con_gerencia', 'decision_recibida', 'aprobado', 'aprobado_con_ajustes', 'rechazado', 'transferido', 'escalado_a_segunda_fase', 'cerrado');

-- CreateEnum
CREATE TYPE "PortfolioDecisionOutcome" AS ENUM ('pasar_a_segunda_fase', 'iterar_desde_otro_angulo', 'transferir_a_ti', 'transferir_al_area_afectada', 'evaluar_innovacion_abierta', 'escalar_piloto', 'cerrar_con_aprendizaje');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "initials" TEXT NOT NULL,
    "skills" TEXT[],
    "bio" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "cohortId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "step0Status" "Step0Status" NOT NULL DEFAULT 'NOT_STARTED',
    "step0Data" JSONB,
    "mentorCredits" INTEGER NOT NULL DEFAULT 3,
    "riskLevel" "RiskLevel",
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastPosition" JSONB,
    "sponsorTouchpoints" JSONB,
    "sponsorComments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cohortId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'BLOCKED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stepData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'BLOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackIA" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "goodPoints" TEXT[],
    "missing" TEXT[],
    "actions" TEXT[],
    "questions" TEXT[],
    "contradictions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "mentorId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING_SCHEDULE',
    "result" "SessionResult",
    "comments" TEXT,
    "rubricScores" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "size" TEXT,
    "url" TEXT,
    "storageKey" TEXT,
    "stepRef" INTEGER NOT NULL,
    "moduleRef" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'VIEWER',
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "modulePermissions" TEXT[],

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'DRAFT',
    "metrics" JSONB,
    "learningCard" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mentorId" TEXT,
    "message" TEXT NOT NULL,
    "response" TEXT,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorCheckpoint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "status" "SponsorCheckpointStatus" NOT NULL DEFAULT 'PENDING',
    "strategicFeedback" TEXT,
    "alignmentSignal" "AlignmentSignal",
    "focusRecommendation" TEXT,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicFront" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategicObjective" TEXT,
    "whyNow" TEXT,
    "mainKpi" TEXT,
    "baseline" TEXT,
    "target" TEXT,
    "horizon" TEXT,
    "sponsor" TEXT,
    "status" "StrategicFrontStatus" NOT NULL DEFAULT 'draft',
    "priority" "StrategicFrontPriority" NOT NULL DEFAULT 'Media',
    "organizationId" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicFront_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "strategicFrontId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "type" "ChallengeType" NOT NULL DEFAULT 'crecimiento',
    "whatWeWantToMove" TEXT,
    "objective" TEXT,
    "whyNow" TEXT,
    "successCriteria" TEXT,
    "challengeOwner" TEXT,
    "challengeOwnerStatus" "StakeholderStatus" NOT NULL DEFAULT 'definido',
    "sponsorStatus" "StakeholderStatus" NOT NULL DEFAULT 'definido',
    "openCallStatus" "ChallengeOpenCallStatus" NOT NULL DEFAULT 'inactiva',
    "visibleToParticipants" BOOLEAN NOT NULL DEFAULT false,
    "publicationNotes" TEXT,
    "lastPublishedAt" TIMESTAMP(3),
    "status" "ChallengeStatus" NOT NULL DEFAULT 'draft',
    "activationMode" "ChallengeActivationMode" NOT NULL DEFAULT 'convocatoria_abierta',
    "coverageStatus" "ChallengeCoverageStatus" NOT NULL DEFAULT 'sin_cobertura',
    "sponsorId" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeInvitation" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" "StakeholderStatus" NOT NULL DEFAULT 'definido',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeSquadMember" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeSquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativePortfolioMeta" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "strategicFrontId" TEXT,
    "teamOwner" TEXT,
    "currentStep" TEXT,
    "status" "InitiativePortfolioStatus" NOT NULL DEFAULT 'en_step_0',
    "mentor" TEXT,
    "sponsorTouchpoint" TEXT,
    "mainAlert" TEXT,
    "nextActionRecommended" TEXT,
    "attackedArea" TEXT,
    "hypothesisCovered" TEXT,
    "mainMetric" TEXT,
    "contributionType" "InitiativeContributionType" NOT NULL DEFAULT 'descubrir',
    "estimatedContribution" "EstimatedContribution" NOT NULL DEFAULT 'bajo',
    "lastActivity" TEXT,
    "signalSummary" TEXT,
    "mainBlocker" TEXT,
    "teamLabel" TEXT,
    "requiresSponsor" BOOLEAN NOT NULL DEFAULT false,
    "readyForDecision" BOOLEAN NOT NULL DEFAULT false,
    "blockedDays" INTEGER NOT NULL DEFAULT 0,
    "requiresExternalCapability" BOOLEAN NOT NULL DEFAULT false,
    "partialSignal" BOOLEAN NOT NULL DEFAULT false,
    "resolvedCorePart" BOOLEAN NOT NULL DEFAULT false,
    "executiveSummary" TEXT,
    "experimentSummary" TEXT,
    "aiCommentSummary" TEXT,
    "mentorCommentSummary" TEXT,
    "decisionRecommendationReason" TEXT,
    "teamMembers" JSONB,
    "deliverables" JSONB,
    "stepsTimeline" JSONB,
    "coverageScore" DOUBLE PRECISION,
    "alignmentNotes" TEXT,
    "decisionOutcome" "PortfolioDecisionOutcome",
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativePortfolioMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeOverlap" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "initiativeAId" TEXT NOT NULL,
    "initiativeBId" TEXT NOT NULL,
    "overlapScore" DOUBLE PRECISION,
    "overlapNotes" TEXT,
    "level" "InitiativeOverlapLevel" NOT NULL DEFAULT 'bajo',
    "rationale" TEXT,
    "recommendation" "InitiativeOverlapRecommendation" NOT NULL DEFAULT 'seguir',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeOverlap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutiveOutput" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "recommendation" "PortfolioDecisionOutcome",
    "status" "ExecutiveOutputStatus" NOT NULL DEFAULT 'borrador_ejecutivo',
    "whyNow" TEXT,
    "kpiToMove" TEXT,
    "approachSummary" TEXT,
    "scopeSummary" TEXT,
    "evidenceSummary" TEXT,
    "keyDeliverableSummary" TEXT,
    "cautionSummary" TEXT,
    "recommendationWhy" TEXT,
    "secondaryOptions" TEXT,
    "nextStepSummary" TEXT,
    "nextStepOwner" TEXT,
    "nextStepHorizon" TEXT,
    "nextStepExpectedResult" TEXT,
    "managementNeeds" JSONB,
    "timeline" JSONB,
    "sharedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_cohortId_idx" ON "User"("cohortId");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_cohortId_idx" ON "Project"("cohortId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Step_projectId_idx" ON "Step"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Step_projectId_number_key" ON "Step"("projectId", "number");

-- CreateIndex
CREATE INDEX "Module_stepId_idx" ON "Module"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_stepId_moduleId_key" ON "Module"("stepId", "moduleId");

-- CreateIndex
CREATE INDEX "FeedbackIA_stepId_idx" ON "FeedbackIA"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorSession_stepId_key" ON "MentorSession"("stepId");

-- CreateIndex
CREATE INDEX "MentorSession_projectId_idx" ON "MentorSession"("projectId");

-- CreateIndex
CREATE INDEX "MentorSession_mentorId_idx" ON "MentorSession"("mentorId");

-- CreateIndex
CREATE INDEX "MentorSession_stepId_idx" ON "MentorSession"("stepId");

-- CreateIndex
CREATE INDEX "Evidence_projectId_idx" ON "Evidence"("projectId");

-- CreateIndex
CREATE INDEX "Evidence_ownerId_idx" ON "Evidence"("ownerId");

-- CreateIndex
CREATE INDEX "Evidence_stepRef_idx" ON "Evidence"("stepRef");

-- CreateIndex
CREATE INDEX "TeamMember_projectId_idx" ON "TeamMember"("projectId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_projectId_userId_key" ON "TeamMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Run_stepId_idx" ON "Run"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_name_key" ON "Cohort"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_family_idx" ON "RefreshToken"("family");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "HelpRequest_projectId_idx" ON "HelpRequest"("projectId");

-- CreateIndex
CREATE INDEX "HelpRequest_userId_idx" ON "HelpRequest"("userId");

-- CreateIndex
CREATE INDEX "HelpRequest_mentorId_idx" ON "HelpRequest"("mentorId");

-- CreateIndex
CREATE INDEX "HelpRequest_status_idx" ON "HelpRequest"("status");

-- CreateIndex
CREATE INDEX "SponsorCheckpoint_projectId_idx" ON "SponsorCheckpoint"("projectId");

-- CreateIndex
CREATE INDEX "SponsorCheckpoint_sponsorId_idx" ON "SponsorCheckpoint"("sponsorId");

-- CreateIndex
CREATE INDEX "SponsorCheckpoint_status_idx" ON "SponsorCheckpoint"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorCheckpoint_projectId_stepNumber_key" ON "SponsorCheckpoint"("projectId", "stepNumber");

-- CreateIndex
CREATE INDEX "StrategicFront_status_idx" ON "StrategicFront"("status");

-- CreateIndex
CREATE INDEX "StrategicFront_organizationId_idx" ON "StrategicFront"("organizationId");

-- CreateIndex
CREATE INDEX "Challenge_strategicFrontId_idx" ON "Challenge"("strategicFrontId");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE INDEX "ChallengeInvitation_challengeId_idx" ON "ChallengeInvitation"("challengeId");

-- CreateIndex
CREATE INDEX "ChallengeSquadMember_challengeId_idx" ON "ChallengeSquadMember"("challengeId");

-- CreateIndex
CREATE INDEX "InitiativePortfolioMeta_projectId_idx" ON "InitiativePortfolioMeta"("projectId");

-- CreateIndex
CREATE INDEX "InitiativePortfolioMeta_challengeId_idx" ON "InitiativePortfolioMeta"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativePortfolioMeta_projectId_challengeId_key" ON "InitiativePortfolioMeta"("projectId", "challengeId");

-- CreateIndex
CREATE INDEX "InitiativeOverlap_challengeId_idx" ON "InitiativeOverlap"("challengeId");

-- CreateIndex
CREATE INDEX "InitiativeOverlap_initiativeAId_idx" ON "InitiativeOverlap"("initiativeAId");

-- CreateIndex
CREATE INDEX "InitiativeOverlap_initiativeBId_idx" ON "InitiativeOverlap"("initiativeBId");

-- CreateIndex
CREATE INDEX "ExecutiveOutput_challengeId_idx" ON "ExecutiveOutput"("challengeId");

-- CreateIndex
CREATE INDEX "ExecutiveOutput_projectId_idx" ON "ExecutiveOutput"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveOutput_projectId_challengeId_key" ON "ExecutiveOutput"("projectId", "challengeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackIA" ADD CONSTRAINT "FeedbackIA_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorSession" ADD CONSTRAINT "MentorSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorSession" ADD CONSTRAINT "MentorSession_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorSession" ADD CONSTRAINT "MentorSession_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorCheckpoint" ADD CONSTRAINT "SponsorCheckpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorCheckpoint" ADD CONSTRAINT "SponsorCheckpoint_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_strategicFrontId_fkey" FOREIGN KEY ("strategicFrontId") REFERENCES "StrategicFront"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeInvitation" ADD CONSTRAINT "ChallengeInvitation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSquadMember" ADD CONSTRAINT "ChallengeSquadMember_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativePortfolioMeta" ADD CONSTRAINT "InitiativePortfolioMeta_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativePortfolioMeta" ADD CONSTRAINT "InitiativePortfolioMeta_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeOverlap" ADD CONSTRAINT "InitiativeOverlap_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveOutput" ADD CONSTRAINT "ExecutiveOutput_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
