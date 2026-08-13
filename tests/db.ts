import "./setup";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Limpa todas as tabelas entre testes, respeitando as FKs. */
export async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveCreditTransaction.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.employeeFunction.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.jobFunction.deleteMany();
  await prisma.settings.deleteMany();
}
