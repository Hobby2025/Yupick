-- CreateTable
CREATE TABLE "Prize" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCandidate" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "authorName" TEXT,
    "authorChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeWinner" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prize_eventId_idx" ON "Prize"("eventId");

-- CreateIndex
CREATE INDEX "PrizeCandidate_prizeId_idx" ON "PrizeCandidate"("prizeId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCandidate_prizeId_userKey_key" ON "PrizeCandidate"("prizeId", "userKey");

-- CreateIndex
CREATE INDEX "PrizeWinner_prizeId_idx" ON "PrizeWinner"("prizeId");

-- CreateIndex
CREATE INDEX "PrizeWinner_candidateId_idx" ON "PrizeWinner"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeWinner_prizeId_candidateId_key" ON "PrizeWinner"("prizeId", "candidateId");

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCandidate" ADD CONSTRAINT "PrizeCandidate_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeWinner" ADD CONSTRAINT "PrizeWinner_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeWinner" ADD CONSTRAINT "PrizeWinner_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "PrizeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
