import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // Funcionário tentando acessar /admin manualmente -> nega e redireciona
    // (seção 44: "o servidor também deve negar a operação").
    if (pathname.startsWith("/admin") && role !== "DIRETOR_ADMIN") {
      return NextResponse.redirect(new URL("/funcionario?erro=ACESSO_NAO_AUTORIZADO", req.url));
    }

    // Diretor não tem uma área "/funcionario" própria de solicitação — mas
    // não há mal em deixar navegar; a UI dele vive em /admin.
    if (pathname.startsWith("/funcionario") && role !== "FUNCIONARIO") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/funcionario/:path*", "/api/admin/:path*"],
};
