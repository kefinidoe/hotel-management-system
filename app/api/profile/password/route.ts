import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/password";

// Change YOUR OWN password. Any signed-in user, and it requires the current
// password -- so a borrowed or stolen session alone isn't enough to lock the
// real owner out of their account.
//
// NOTE: sessions are JWTs, so a session already open elsewhere stays valid until
// it expires. This stops the OLD password being used to sign in again; it does
// not kick out a session someone already holds. If you're rotating because you
// suspect compromise, also deactivate and re-enable the account.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = body.newPassword;

  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!user.isActive) {
    return NextResponse.json({ error: "This account is deactivated." }, { status: 403 });
  }

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) {
    return NextResponse.json({ error: "That current password isn't right." }, { status: 400 });
  }

  // Re-using the same password is the most common way a forced rotation ends up
  // meaning nothing.
  const sameAsBefore = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsBefore) {
    return NextResponse.json(
      { error: "The new password must be different from the current one." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  return NextResponse.json({ ok: true });
}
