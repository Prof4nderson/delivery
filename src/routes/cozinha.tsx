import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Bike, Check, ChefHat, CircleAlert, Clock3, Flame, Store, X } from "lucide-react";
import { toast } from "sonner";
import { OpsGate, useOpsQuery, hasOpsAccess } from "@/components/ops-gate";
import { OpsHeader, SectionHeading } from "@/components/ops-nav";
import { getOpsSessionInfo } from "@/lib/gate.functions";
import { getKitchenOrders, setOrderStatus } from "@/lib/ops.functions";

export const Route = createFileRoute("/cozinha")({
  loader: () => getOpsSessionInfo(),
  head: () => ({
    meta: [
      { title: "Cozinha — Pedidos" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Cozinha" },
      { property: "og:description", content: "Painel da cozinha" },
    ],
  }),
  component: KitchenPage,
});

function elapsed(createdAt: string) {
  const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return min < 1 ? "agora" : `${min} min`;
}

function KitchenPage() {
  const session = Route.useLoaderData();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getKitchenOrders);
  const changeStatus = useServerFn(setOrderStatus);
  const allowed = hasOpsAccess(session, "cozinha");
  const { data, isLoading } = useOpsQuery(["kitchen"], fetchOrders, 5000, allowed);

  const seenOrders = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!allowed || !data) return;
    const numbers = data.orders.map((order) => order.order_number);
    if (seenOrders.current === null) {
      seenOrders.current = new Set(numbers);
      return;
    }
    for (const number of numbers) {
      if (!seenOrders.current.has(number)) {
        seenOrders.current.add(number);
        toast.success(`Novo pedido #${number} confirmado!`);
      }
    }
  }, [data, allowed]);

  async function move(id: string, status: "preparing" | "ready" | "served" | "cancelled") {
    try {
      await changeStatus({ data: { orderId: id, status } });
      toast.success(status === "cancelled" ? "Pedido cancelado" : "Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar pedido");
    }
  }

  type Order = NonNullable<typeof data>["orders"][number];
  type Item = NonNullable<typeof data>["items"][number];
  const orders: Order[] = data?.orders ?? [];
  const allItems: Item[] = data?.items ?? [];
  const itemsOf = (orderId: string) =>
    allItems.filter((item) => item.order_id === orderId && item.needs_kitchen !== false);
  const cols = [
    {
      status: "confirmed",
      title: "Confirmados",
      helper: "Aguardando preparo",
      icon: CircleAlert,
      orders: orders.filter((o) => o.status === "confirmed"),
      tone: "border-primary/35",
    },
    {
      status: "preparing",
      title: "Em preparo",
      helper: "Na bancada agora",
      icon: Flame,
      orders: orders.filter((o) => o.status === "preparing"),
      tone: "border-accent/70",
    },
    {
      status: "ready",
      title: "Prontos",
      helper: "Aguardando retirada",
      icon: Check,
      orders: orders.filter((o) => o.status === "ready"),
      tone: "border-emerald-500/40",
    },
  ] as const;

  return (
    <OpsGate role="cozinha" title="Cozinha" session={session}>
      <main className="page-shell max-w-7xl">
        <OpsHeader
          title="Cozinha"
          subtitle="Organize o ritmo do serviço em um só lugar"
          icon={ChefHat}
          session={session}
          active="cozinha"
        />
        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3 page-enter-delay-2">
          <div className="metric-card">
            <span className="metric-icon">
              <CircleAlert className="h-4 w-4" />
            </span>
            <p className="mt-3 text-xs text-muted-foreground">Na fila</p>
            <p className="font-display text-2xl font-bold">{cols[0].orders.length}</p>
          </div>
          <div className="metric-card">
            <span className="metric-icon">
              <Flame className="h-4 w-4" />
            </span>
            <p className="mt-3 text-xs text-muted-foreground">Preparando</p>
            <p className="font-display text-2xl font-bold">{cols[1].orders.length}</p>
          </div>
          <div className="metric-card">
            <span className="metric-icon">
              <Check className="h-4 w-4" />
            </span>
            <p className="mt-3 text-xs text-muted-foreground">Prontos</p>
            <p className="font-display text-2xl font-bold">{cols[2].orders.length}</p>
          </div>
        </div>

        {isLoading && <p className="mb-4 text-sm text-muted-foreground">Atualizando pedidos…</p>}
        <div className="grid gap-4 md:grid-cols-3">
          {cols.map((column) => {
            const ColumnIcon = column.icon;
            return (
              <section
                key={column.status}
                className="page-enter"
                style={{
                  animationDelay: `${120 + cols.findIndex((item) => item.status === column.status) * 70}ms`,
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary">
                      <ColumnIcon className="h-4 w-4 text-primary" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold">{column.title}</h2>
                      <p className="text-[11px] text-muted-foreground">{column.helper}</p>
                    </div>
                  </div>
                  <span className="count-badge">{column.orders.length}</span>
                </div>
                <div className="space-y-3 rounded-2xl bg-secondary/35 p-2">
                  {column.orders.length === 0 && (
                    <div className="empty-state border-0 py-10">
                      <Clock3 className="h-5 w-5" />
                      <p className="text-xs text-muted-foreground">Nenhum pedido aqui</p>
                    </div>
                  )}
                  {column.orders.map((order, orderIndex) => {
                    const kitchenItems = itemsOf(order.id);
                    return (
                      <article
                        key={order.id}
                        className={`surface-card page-enter p-4 ${column.tone}`}
                        style={{ animationDelay: `${orderIndex * 45}ms` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-display text-2xl font-bold">
                              #{order.order_number}
                            </span>
                            <p className="mt-0.5 text-sm font-semibold">{order.customer_name}</p>
                          </div>
                          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            {elapsed(order.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          {order.order_type === "delivery" ? (
                            <>
                              <Bike className="h-3.5 w-3.5 text-primary" /> Entrega
                            </>
                          ) : (
                            <>
                              <Store className="h-3.5 w-3.5" /> Consumo no local
                            </>
                          )}
                        </p>
                        <ul className="mt-3 space-y-2 border-t border-border/70 pt-3">
                          {kitchenItems.map((item) => (
                            <li key={item.id} className="text-sm">
                              <span className="mr-1 font-bold text-primary">{item.qty}×</span>
                              {item.name}
                              {item.notes && (
                                <p className="mt-1 flex items-start gap-1 rounded-lg bg-accent/60 px-2 py-1.5 text-xs font-medium">
                                  <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                                  {item.notes}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                        {order.notes && (
                          <p className="mt-3 rounded-lg bg-accent/50 p-2 text-xs leading-5">
                            <strong>Obs.:</strong> {order.notes}
                          </p>
                        )}
                        <div className="mt-4 flex gap-2">
                          {column.status === "confirmed" && (
                            <>
                              <button
                                onClick={() => move(order.id, "preparing")}
                                className="action-button flex-1 py-2.5 text-xs"
                              >
                                <Flame className="h-4 w-4" />
                                Iniciar preparo
                              </button>
                              <button
                                onClick={() => move(order.id, "cancelled")}
                                className="secondary-button px-3 py-2.5 text-destructive"
                                aria-label="Cancelar pedido"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {column.status === "preparing" && (
                            <button
                              onClick={() => move(order.id, "ready")}
                              className="action-button w-full py-2.5 text-xs"
                            >
                              <Check className="h-4 w-4" />
                              Marcar como pronto
                            </button>
                          )}
                          {column.status === "ready" && order.order_type === "dine_in" && (
                            <button
                              onClick={() => move(order.id, "served")}
                              className="action-button w-full py-2.5 text-xs"
                            >
                              <Store className="h-4 w-4" />
                              Marcar como servido
                            </button>
                          )}
                          {column.status === "ready" && order.order_type === "delivery" && (
                            <p className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground">
                              <Bike className="h-3.5 w-3.5" />
                              Aguardando entregador
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </OpsGate>
  );
}
