-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'CONTACTED', 'CLOSED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "paidAt" TIMESTAMPTZ(3),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "reminderSentAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_businessId_day_status_idx" ON "WaitlistEntry"("businessId", "day", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_businessId_day_phone_key" ON "WaitlistEntry"("businessId", "day", "phone");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
