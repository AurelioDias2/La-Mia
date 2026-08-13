-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DIRETOR_ADMIN', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDENTE', 'ATIVO', 'INATIVO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('DOMINGO_MES', 'COMPENSATORIA', 'EXTRA');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELAMENTO_SOLICITADO', 'CANCELADA', 'UTILIZADA');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('COMPENSATORIA', 'EXTRA');

-- CreateEnum
CREATE TYPE "CreditTransactionKind" AS ENUM ('CONCESSAO', 'RESERVA', 'CONSUMO', 'ESTORNO', 'CORRECAO');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "StoreOpenStatus" AS ENUM ('ABERTA', 'FECHADA', 'NAO_DEFINIDO');

-- CreateEnum
CREATE TYPE "FunctionRole" AS ENUM ('PRINCIPAL', 'SECUNDARIA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_functions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dailyLeaveLimit" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_functions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobFunctionId" TEXT NOT NULL,
    "role" "FunctionRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobFunctionId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "creditTransactionId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "cancelRequestedAt" TIMESTAMP(3),
    "cancelDecidedAt" TIMESTAMP(3),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_credit_transactions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "creditType" "CreditType" NOT NULL,
    "kind" "CreditTransactionKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "originDate" TIMESTAMP(3),
    "note" TEXT,
    "correctsTransactionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL,
    "storeOpen" "StoreOpenStatus" NOT NULL DEFAULT 'NAO_DEFINIDO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_dates" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fixedClosedWeekday" INTEGER NOT NULL DEFAULT 1,
    "requestsRequireApproval" BOOLEAN NOT NULL DEFAULT true,
    "pendingRequestHoldsSlot" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_functions_name_key" ON "job_functions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_functions_employeeId_role_key" ON "employee_functions"("employeeId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_creditTransactionId_key" ON "leave_requests"("creditTransactionId");

-- CreateIndex
CREATE INDEX "leave_requests_date_jobFunctionId_status_idx" ON "leave_requests"("date", "jobFunctionId", "status");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_idx" ON "leave_requests"("employeeId");

-- CreateIndex
CREATE INDEX "leave_credit_transactions_employeeId_creditType_idx" ON "leave_credit_transactions"("employeeId", "creditType");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_name_key" ON "holidays"("date", "name");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_dates_date_key" ON "blocked_dates"("date");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_functions" ADD CONSTRAINT "employee_functions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_functions" ADD CONSTRAINT "employee_functions_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "job_functions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "job_functions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_creditTransactionId_fkey" FOREIGN KEY ("creditTransactionId") REFERENCES "leave_credit_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_credit_transactions" ADD CONSTRAINT "leave_credit_transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
