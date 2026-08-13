import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireDirector() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DIRETOR_ADMIN") {
    return { session: null, error: "ACESSO_NAO_AUTORIZADO" as const };
  }
  return { session, error: null };
}

export async function requireEmployee() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FUNCIONARIO" || !session.user.employeeId) {
    return { session: null, error: "ACESSO_NAO_AUTORIZADO" as const };
  }
  return { session, error: null };
}

export async function requireAnyUser() {
  const session = await getServerSession(authOptions);
  if (!session) return { session: null, error: "ACESSO_NAO_AUTORIZADO" as const };
  return { session, error: null };
}
