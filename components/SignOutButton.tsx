"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-secondary w-full text-sm">
      Sair
    </button>
  );
}
