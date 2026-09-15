import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { unlockRoute } from "@/lib/gate.functions";
import type { Role } from "@/lib/gate.server";
import type { OpsSession } from "./ops-nav";

export function OpsGate({
  role,
  title,
  session,
  children,
}: {
  role: Role;
  title: string;
  session: OpsSession | null;
  children: ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const unlock = useServerFn(unlockRoute);

  if (session?.roles.includes(role) || session?.roles.includes("admin")) {
    return <>{children}</>;
  }

  async function submit() {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await unlock({ data: { route: role, password } });
      if (!res.ok) {
        setError("Senha incorreta. Confira e tente novamente.");
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Não foi possível validar a senha agora.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="page-enter w-full max-w-sm">
        <div className="surface-card overflow-hidden p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <span className="user-pill gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Área protegida
            </span>
          </div>
          <p className="eyebrow mt-6">Acesso operacional</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Digite a senha da área para continuar. A sessão fica protegida neste dispositivo.
          </p>

          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="mb-2 block text-sm font-semibold" htmlFor="ops-password">
              Senha de acesso
            </label>
            <div className="relative">
              <input
                id="ops-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 text-lg tracking-[0.22em]"
                placeholder="••••••••"
                autoFocus
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "ops-password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p id="ops-password-error" className="mt-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="action-button mt-4 w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {loading ? "Validando…" : "Desbloquear área"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Acesso restrito à equipe autorizada.
        </p>
      </div>
    </main>
  );
}

export function useOpsQuery<T>(
  key: string[],
  fn: () => Promise<T>,
  refetchMs = 5000,
  enabled = true,
) {
  return useQuery({ queryKey: key, queryFn: fn, refetchInterval: refetchMs, enabled });
}

export function hasOpsAccess(session: { roles: string[] } | null, role: Role): boolean {
  return !!session && (session.roles.includes(role) || session.roles.includes("admin"));
}
