import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        username: { label: "Usuário/WhatsApp", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          include: { employee: true },
        });
        if (!user) return null;

        // Login bloqueado: funcionário PENDENTE, RECUSADO ou INATIVO não entra.
        if (user.status !== "ATIVO") return null;

        const validPassword = await verifyPassword(user.passwordHash, credentials.password);
        if (!validPassword) return null;

        return {
          id: user.id,
          name: user.employee?.fullName ?? user.username,
          username: user.username,
          role: user.role,
          employeeId: user.employee?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.employeeId = (user as any).employeeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
        (session.user as any).employeeId = token.employeeId;
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
