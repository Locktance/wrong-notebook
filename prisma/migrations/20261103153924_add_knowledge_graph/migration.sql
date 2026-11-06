-- CreateTable
CREATE TABLE "KnowledgeNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cnmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "domain" TEXT,
    "grade" INTEGER,
    "semester" TEXT,
    "chapter" TEXT,
    "description" TEXT,
    "diagnosticQuestion" TEXT,
    "diagnosticAnswer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KnowledgeEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "strength" TEXT NOT NULL DEFAULT 'hard',
    "reason" TEXT,
    CONSTRAINT "KnowledgeEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ErrorItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortId" TEXT,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "originalImageUrl" TEXT NOT NULL,
    "ocrText" TEXT,
    "questionText" TEXT,
    "answerText" TEXT,
    "analysis" TEXT,
    "wrongAnswerText" TEXT,
    "mistakeAnalysis" TEXT,
    "mistakeStatus" TEXT,
    "knowledgePoints" TEXT,
    "geogebraCommands" TEXT,
    "svgAnimation" TEXT,
    "svgAnimationEn" TEXT,
    "primaryNodeId" TEXT,
    "nodeSource" TEXT,
    "source" TEXT,
    "errorType" TEXT,
    "userNotes" TEXT,
    "masteryLevel" INTEGER NOT NULL DEFAULT 0,
    "gradeSemester" TEXT,
    "paperLevel" TEXT,
    "difficultyStars" INTEGER,
    "hasFigure" BOOLEAN NOT NULL DEFAULT false,
    "figureSvg" TEXT,
    "figureScale" INTEGER NOT NULL DEFAULT 100,
    "figureAlign" TEXT NOT NULL DEFAULT 'center',
    "answerSpacePx" INTEGER,
    "lastPractice" TEXT,
    "masteryProbability" REAL,
    "masteryReason" TEXT,
    "masterySource" TEXT,
    "masteryEvaluatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ErrorItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ErrorItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ErrorItem_primaryNodeId_fkey" FOREIGN KEY ("primaryNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ErrorItem_paperLevel_fkey" FOREIGN KEY ("paperLevel") REFERENCES "PaperGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ErrorItem" ("analysis", "answerSpacePx", "answerText", "createdAt", "difficultyStars", "errorType", "figureAlign", "figureScale", "figureSvg", "geogebraCommands", "gradeSemester", "hasFigure", "id", "knowledgePoints", "lastPractice", "masteryEvaluatedAt", "masteryLevel", "masteryProbability", "masteryReason", "masterySource", "mistakeAnalysis", "mistakeStatus", "ocrText", "originalImageUrl", "paperLevel", "questionText", "shortId", "source", "subjectId", "svgAnimation", "svgAnimationEn", "updatedAt", "userId", "userNotes", "wrongAnswerText") SELECT "analysis", "answerSpacePx", "answerText", "createdAt", "difficultyStars", "errorType", "figureAlign", "figureScale", "figureSvg", "geogebraCommands", "gradeSemester", "hasFigure", "id", "knowledgePoints", "lastPractice", "masteryEvaluatedAt", "masteryLevel", "masteryProbability", "masteryReason", "masterySource", "mistakeAnalysis", "mistakeStatus", "ocrText", "originalImageUrl", "paperLevel", "questionText", "shortId", "source", "subjectId", "svgAnimation", "svgAnimationEn", "updatedAt", "userId", "userNotes", "wrongAnswerText" FROM "ErrorItem";
DROP TABLE "ErrorItem";
ALTER TABLE "new_ErrorItem" RENAME TO "ErrorItem";
CREATE UNIQUE INDEX "ErrorItem_shortId_key" ON "ErrorItem"("shortId");
CREATE INDEX "ErrorItem_userId_createdAt_idx" ON "ErrorItem"("userId", "createdAt");
CREATE INDEX "ErrorItem_subjectId_idx" ON "ErrorItem"("subjectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeNode_cnmId_key" ON "KnowledgeNode"("cnmId");

-- CreateIndex
CREATE INDEX "KnowledgeNode_subject_grade_idx" ON "KnowledgeNode"("subject", "grade");

-- CreateIndex
CREATE INDEX "KnowledgeNode_name_idx" ON "KnowledgeNode"("name");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_toNodeId_idx" ON "KnowledgeEdge"("toNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEdge_fromNodeId_toNodeId_key" ON "KnowledgeEdge"("fromNodeId", "toNodeId");
