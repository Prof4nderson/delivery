import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Bike, PackageCheck, Store, Clock } from "lucide-react";
import { toast } from "sonner";
import { getOrder } from "@/lib/public.functions";
import { brl, ORDER_STATUS_LABELS } from "@/lib/format";

export const Route = createFileRoute("/pedido/$id")({
  loader: ({ params }) => getOrder({ data: { id: params.id } }),
  head: () => ({
    meta: [
      { title: "Acompanhar pedido" },
      { name: "description", content: "Acompanhe o status do seu pedido em tempo real." },
      { property: "og:title", content: "Acompanhar pedido" },
      { property: "og:description", content: "Acompanhe o status do seu pedido em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackPage,
});

const TOASTS: Record<string, string> = {
  confirmed: "Seu pedido foi confirmado!",
  preparing: "Seu pedido está em preparo na cozinha",
  ready: "Seu pedido está pronto!",
  out_for_delivery: "Seu pedido saiu para entrega",
  delivered: "Pedido entregue. Bom apetite!",
  served: "Pedido servido. Bom apetite!",
};

function TrackPage() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const lastStatus = useRef(initial.order.status);

  const { data } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: { id } }),
    initialData: initial,
    refetchInterval: 10000,
  });

  // Avisa o cliente a cada mudança de status detectada nas recargas periódicas
  useEffect(() => {
    const status = data.order.status;
    if (status !== lastStatus.current) {
      lastStatus.current = status;
      const msg = TOASTS[status];
      if (msg) toast.success(msg);
    }
  }, [data]);

  const order = data.order;
  const items = data.items;
  const isDelivery = order.order_type === "delivery";

  const steps = isDelivery
    ? [
        { key: "confirmed", label: "Confirmado", icon: CheckCircle2 },
        { key: "preparing", label: "Em preparo", icon: ChefHat },
        { key: "ready", label: "Pronto", icon: PackageCheck },
        { key: "out_for_delivery", label: "A caminho", icon: Bike },
        { key: "delivered", label: "Entregue", icon: CheckCircle2 },
      ]
    : [
        { key: "confirmed", label: "Confirmado", icon: CheckCircle2 },
        { key: "preparing", label: "Em preparo", icon: ChefHat },
        { key: "ready", label: "Pronto", icon: PackageCheck },
        { key: "served", label: "Servido", icon: Store },
      ];

  const orderOf = ["confirmed", "preparing", "ready", "out_for_delivery", "delivered", "served"];
  const currentIdx = orderOf.indexOf(order.status);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-6 pb-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        ← Voltar ao cardápio
      </Link>

      <div className="surface-card page-enter mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Acompanhamento</p>
            <h1 className="font-display text-3xl font-bold">#{order.order_number}</h1>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {order.customer_name} • {isDelivery ? "Entrega" : "Consumo no restaurante"} •{" "}
          {order.payment_method}
        </p>

        {order.status === "cancelled" ? (
          <p className="mt-6 rounded-xl bg-destructive/10 p-4 text-center text-sm font-medium text-destructive">
            Este pedido foi cancelado.
          </p>
        ) : (
          <ol className="mt-7 space-y-0">
            {steps.map((step, i) => {
              const stepIdx = orderOf.indexOf(step.key);
              const done = currentIdx >= stepIdx;
              const current = currentIdx === stepIdx;
              const Icon = step.icon;
              return (
                <li
                  key={step.key}
                  className="flex gap-3 page-enter"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ${done ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "bg-muted text-muted-foreground"}`}
                    >
                      {current && order.status !== "delivered" && order.status !== "served" ? (
                        <Clock className="h-4 w-4 animate-pulse" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={`h-8 w-0.5 ${done && currentIdx > stepIdx ? "bg-primary" : "bg-border"}`}
                      />
                    )}
                  </div>
                  <p className={`pt-2 text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                    {step.label}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="surface-card page-enter-delay-1 mt-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PackageCheck className="h-4 w-4" />
          </div>
          <h2 className="font-display text-lg font-semibold">Itens do pedido</h2>
        </div>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.qty}× {item.name}
                {item.notes && (
                  <span className="block text-xs text-muted-foreground">{item.notes}</span>
                )}
              </span>
              <span className="font-medium">{brl(Number(item.price) * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
          <span>Total</span>
          <span>{brl(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
