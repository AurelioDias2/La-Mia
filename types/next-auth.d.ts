import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      username: string;
      role: "DIRETOR_ADMIN" | "FUNCIONARIO";
      employeeId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "DIRETOR_ADMIN" | "FUNCIONARIO";
    username: string;
    employeeId: string | null;
  }
}
