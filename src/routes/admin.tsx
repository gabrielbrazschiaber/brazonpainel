import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração" }] }),
  component: () => (
    <RequireRole role="admin">
      <AdminPlaceholder />
    </RequireRole>
  ),
});

function AdminPlaceholder() {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="max-w-md p-8 text-center">
        <h1 className="text-xl font-bold text-foreground">Administração</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Olá {profile?.nome || profile?.email}. Esta área será construída na próxima fase.
        </p>
        <Button variant="outline" className="mt-6" onClick={signOut}>
          Sair
        </Button>
      </Card>
    </div>
  );
}
