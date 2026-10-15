import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

/**
 * Borra la cookie y lleva al login. La usa `requireAdmin` cuando la sesión dejó de valer
 * (por ejemplo, después de cambiar la contraseña): desde un Server Component no se pueden
 * borrar cookies, y sin esto el proxy (que solo mira la firma) volvería a mandar a /admin.
 */
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
