import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bike,
  Check,
  ClipboardCheck,
  CreditCard,
  KeyRound,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { getOpsSessionInfo, courierLogin } from "@/lib/gate.functions";
import {
  getDeliveryBoard,
  assignDelivery,
  toggleItemChecked,
  setOutForDelivery,
  confirmDelivered,
} from "@/lib/ops.functions";
import { useOpsQuery } from "@/components/ops-gate";
import { OpsHeader } from "@/components/ops-nav";
import { brl, PAYMENT_METHODS } from "@/lib/format";

export const Route = createFileRoute("/entrega")({
  loader: () => getOpsSessionInfo(),
  head: () => ({
    meta: [
      { title: "Entregas" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Entregas" },
      { property: "og:description", content: "Painel do entregador" },
    ],
  }),
  component: DeliveryPage,
});

type Board = Awaited<ReturnType<typeof getDeliveryBoard>>;
type Order = Board["ready"][number];
type Item = Board["items"][number];

type Session = Awaited<ReturnType<typeof getOpsSessionInfo>>;

function DeliveryPage() {
  const session = Route.useLoaderData();
  const isCourier = session.roles.includes("entrega") || session.roles.includes("admin");
  if (!isCourier) return <CourierLogin />;
  return (
    <BoardView
      courierName={session.courierName}
      isAdmin={session.roles.includes("admin")}
      session={session}
    />
  );
}

function CourierLogin() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useServerFn(courierLogin);

  async function submit() {
    if (!name.trim() || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await login({ data: { name, password } });
      if (!res.ok) {
        setError("Nome ou senha incorretos");
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Não foi possível entrar agora");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="page-enter w-full max-w-sm">
        <div className="surface-card p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Bike className="h-6 w-6" />
            </div>
            <span className="user-pill gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Área protegida
            </span>
          </div>
          <p className="eyebrow mt-6">Acesso da equipe</p>
          <h1 className="font-display mt-1 text-3xl font-bold">Entregas</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Entre para assumir pedidos, conferir os itens e confirmar pagamentos.
          </p>
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="block text-sm font-semibold">
              Seu nome
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                placeholder="Ex.: Carlos"
                autoFocus
                autoComplete="username"
              />
            </label>
            <label className="block text-sm font-semibold">
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 font-normal"
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
            </label>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading || !name.trim() || !password}
              className="action-button w-full py-3.5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {loading ? "Entrando…" : "Entrar no painel"}
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

function BoardView({
  courierName,
  isAdmin,
  session,
}: {
  courierName: string | null;
  isAdmin: boolean;
  session: Session;
}) {
  const queryClient = useQueryClient();
  const fetchBoard = useServerFn(getDeliveryBoard);
  const assign = useServerFn(assignDelivery);
  const toggle = useServerFn(toggleItemChecked);
  const out = useServerFn(setOutForDelivery);
  const delivered = useServerFn(confirmDelivered);
  const { data } = useOpsQuery(["delivery"], fetchBoard);
  const [payMethod, setPayMethod] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const seenReady = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!data) return;
    const numbers = data.ready.map((order) => order.order_number);
    if (seenReady.current === null) {
      seenReady.current = new Set(numbers);
      return;
    }
    for (const number of numbers) {
      if (!seenReady.current.has(number)) {
        seenReady.current.add(number);
        toast.success(`Pedido #${number} pronto para entrega!`);
      }
    }
  }, [data]);

  async function run(key: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      queryClient.invalidateQueries({ queryKey: ["delivery"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar entrega");
    } finally {
      setBusy(null);
    }
  }

  const ready: Order[] = data?.ready ?? [];
  const mine: Order[] = data?.mine ?? [];
  const items: Item[] = data?.items ?? [];
  const itemsOf = (orderId: string) => items.filter((item) => item.order_id === orderId);

  return (
    <main className="page-shell max-w-2xl">
      <OpsHeader
        title="Entregas"
        subtitle="Confira, saia para a rua e finalize com segurança"
        icon={Bike}
        session={{ ...session, courierName }}
        active="entrega"
      />
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3 page-enter-delay-2">
        <div className="metric-card">
          <span className="metric-icon">
            <PackageCheck className="h-4 w-4" />
          </span>
          <p className="mt-3 text-xs text-muted-foreground">Disponíveis</p>
          <p className="font-display text-2xl font-bold">{ready.length}</p>
        </div>
        <div className="metric-card">
          <span className="metric-icon">
            <Truck className="h-4 w-4" />
          </span>
          <p className="mt-3 text-xs text-muted-foreground">Minhas entregas</p>
          <p className="font-display text-2xl font-bold">{mine.length}</p>
        </div>
        <div className="metric-card">
          <span className="metric-icon">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <p className="mt-3 text-xs text-muted-foreground">Em andamento</p>
          <p className="font-display text-2xl font-bold">
            {mine.filter((order) => order.status === "out_for_delivery").length}
          </p>
        </div>
      </div>

      <section className="page-enter-delay-2">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="eyebrow">Fila de saída</p>
            <h2 className="font-display text-xl font-bold">Prontos para entrega</h2>
          </div>
          <span className="count-badge">{ready.length}</span>
        </div>
        <div className="space-y-3">
          {ready.length === 0 && (
            <div className="empty-state">
              <PackageCheck className="h-5 w-5" />
              <p className="font-semibold">Tudo em dia</p>
              <p className="text-sm text-muted-foreground">Nenhum pedido aguardando entregador.</p>
            </div>
          )}
          {ready.map((order, index) => (
            <article
              key={order.id}
              className="surface-card page-enter p-4"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <OrderHeader order={order} />
              <ul className="mt-3 space-y-1.5 border-t border-border/70 pt-3 text-sm">
                {itemsOf(order.id).map((item) => (
                  <li key={item.id}>
                    <span className="mr-1 font-bold text-primary">{item.qty}×</span>
                    {item.name}
                    {item.notes && (
                      <p className="ml-5 text-xs text-muted-foreground">Obs.: {item.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
              <button
                onClick={() =>
                  run(
                    `assign-${order.id}`,
                    () => assign({ data: { orderId: order.id } }),
                    "Entrega assumida",
                  )
                }
                disabled={busy === `assign-${order.id}`}
                className="action-button mt-4 w-full py-3 text-sm disabled:opacity-50"
              >
                <Truck className="h-4 w-4" />
                Assumir entrega
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 page-enter-delay-2">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="eyebrow">Minha rota</p>
            <h2 className="font-display text-xl font-bold">Entregas em andamento</h2>
          </div>
          <span className="count-badge">{mine.length}</span>
        </div>
        <div className="space-y-3 pb-8">
          {mine.length === 0 && (
            <div className="empty-state">
              <Truck className="h-5 w-5" />
              <p className="font-semibold">Nenhuma entrega ainda</p>
              <p className="text-sm text-muted-foreground">
                Assuma um pedido quando estiver pronto.
              </p>
            </div>
          )}
          {mine.map((order, index) => {
            const orderItems = itemsOf(order.id);
            const allChecked = orderItems.length > 0 && orderItems.every((item) => item.checked);
            return (
              <article
                key={order.id}
                className="surface-card page-enter p-4"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <OrderHeader order={order} />
                {order.address && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {order.address}
                  </p>
                )}
                {order.customer_phone && (
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {order.customer_phone}
                  </a>
                )}
                <div className="mt-4 space-y-2">
                  {orderItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        run(`chk-${item.id}`, () =>
                          toggle({ data: { itemId: item.id, checked: !item.checked } }),
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left text-sm hover:border-primary/50"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${item.checked ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                      >
                        {item.checked && <Check className="h-4 w-4" />}
                      </span>
                      <span className={item.checked ? "line-through opacity-60" : ""}>
                        <span className="font-semibold">{item.qty}×</span> {item.name}
                        {item.notes && (
                          <span className="block text-xs text-muted-foreground">
                            Obs.: {item.notes}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                {order.status !== "out_for_delivery" ? (
                  <button
                    onClick={() =>
                      run(
                        `out-${order.id}`,
                        () => out({ data: { orderId: order.id } }),
                        "Saiu para entrega!",
                      )
                    }
                    disabled={!allChecked || busy === `out-${order.id}`}
                    className="action-button mt-4 w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {allChecked ? (
                      <>
                        <Bike className="h-4 w-4" />
                        Sair para entrega
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="h-4 w-4" />
                        Confira todos os itens acima
                      </>
                    )}
                  </button>
                ) : (
                  <div className="mt-4 rounded-2xl bg-accent/45 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Confirmar pagamento de {brl(order.total)}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {PAYMENT_METHODS.map((method) => (
                        <button
                          key={method}
                          onClick={() =>
                            setPayMethod((current) => ({ ...current, [order.id]: method }))
                          }
                          className={`rounded-lg border-2 py-2 text-xs ${(payMethod[order.id] ?? order.payment_method) === method ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border bg-background"}`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        run(
                          `done-${order.id}`,
                          () =>
                            delivered({
                              data: {
                                orderId: order.id,
                                payment_method: payMethod[order.id] ?? order.payment_method,
                              },
                            }),
                          "Entrega concluída!",
                        )
                      }
                      disabled={busy === `done-${order.id}`}
                      className="action-button mt-3 w-full py-3 text-sm disabled:opacity-50"
                    >
                      <PackageCheck className="h-4 w-4" />
                      Confirmar entrega e pagamento
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function OrderHeader({ order }: { order: Order }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className="font-display text-2xl font-bold">#{order.order_number}</span>
        <p className="mt-0.5 text-sm font-semibold">{order.customer_name}</p>
      </div>
      <span className="rounded-full bg-primary/10 px-3 py-1.5 font-display text-sm font-bold text-primary">
        {brl(order.total)}
      </span>
    </div>
  );
}
