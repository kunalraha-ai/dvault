import { getOrCreateLocalUser } from "@/lib/local-user";
import { AppShell } from "@/components/app/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getOrCreateLocalUser();
  const { prisma } = await import("@/lib/db");
  const userRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  return (
    <AppShell user={{ id: user.id, name: user.name, email: userRow?.email ?? null }}>
      {children}
    </AppShell>
  );
}
