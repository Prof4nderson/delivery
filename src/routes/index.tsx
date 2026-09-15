import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, Store, Bike, X } from "lucide-react";
import { toast } from "sonner";
import { getMenuData, getSettings } from "@/lib/public.functions";
import { createOrder } from "@/lib/orders.functions";
import { brl, PAYMENT_METHODS } from "@/lib/format";

type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  stock: number;
  needs_kitchen: boolean;
};

type Category = { id: string; name: string; sort_order: number };
type Cart = Record<string, number>;

export const Route = createFileRoute("/")({
  loader: async () => {
    const [menu, settings] = await Promise.all([getMenuData(), getSettings()]);
    return { menu, settings };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.settings.restaurant_name ?? "Cardápio"} — Cardápio do dia` },
      { name: "description", content: "Escolha seus pratos, monte o carrinho e acompanhe o pedido em tempo real." },
      { property: "og:title", content: `${loaderData?.settings.restaurant_name ?? "Cardápio"} — Cardápio do dia` },
      { property: "og:description", content: "Escolha seus pratos, monte o carrinho e acompanhe o pedido em tempo real." },
    ],
  }),
  component: MenuPage,
});

const DAILY_CATEGORY_NAME = "pratos quentes";

function MenuPage() {
  const { menu, settings } = Route.useLoaderData();
  const navigate = useNavigate();
  const submitOrder = useServerFn(createOrder);

  const [cart, setCart] = useState<Cart>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // checkout form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "dine_in">("delivery");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");

  const categories = menu.categories as Category[];
  const products = menu.products as Product[];
  const dailyIds = new Set(menu.dailyIds as string[]);

  const visibleByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const cat of categories) {
      const isDaily = cat.name.trim().toLowerCase() === DAILY_CATEGORY_NAME;
      const list = products.filter(
        (p) => p.category_id === cat.id && (!isDaily || dailyIds.has(p.id)),
      );
      if (list.length) map.set(cat.id, list);
    }
    return map;
  }, [categories, products, dailyIds]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
        .filter((i) => i.product && i.qty > 0),
    [cart, products],
  );
  const total = cartItems.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const count = cartItems.reduce((s, i) => s + i.qty, 0);

  function add(id: string, delta: number) {
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });
  }

  async function checkout() {
    if (!name.trim() || !phone.trim()) { toast.error("Informe seu nome e telefone"); return; }
    if (orderType === "delivery" && !address.trim()) { toast.error("Informe o endereço"); return; }
    if (!cartItems.length) { toast.error("Carrinho vazio"); return; }
    setSending(true);
    try {
      const res = await submitOrder({
        data: {
          customer_name: name,
          customer_phone: phone,
          order_type: orderType,
          address: orderType === "delivery" ? address : undefined,
          payment_method: payment,
          notes: notes || undefined,
          items: cartItems.map((i) => {
            const note = itemNotes[i.product.id]?.trim();
            return {
              product_id: i.product.id,
              qty: i.qty,
              ...(note ? { notes: note } : {}),
            };
          }),
        },
      });
      toast.success(`Pedido #${res.orderNumber} confirmado!`);
      setCart({});
      setItemNotes({});
      setCartOpen(false);
      navigate({ to: "/pedido/$id", params: { id: res.orderId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar pedido");
    } finally {
      setSending(false);
    }
  }

  const orderedCategories = categories.filter((c) => visibleByCategory.has(c.id));

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt={settings.restaurant_name} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="font-display text-xl font-bold leading-tight">{settings.restaurant_name}</h1>
            <p className="text-xs text-muted-foreground">Cardápio do dia</p>
          </div>
        </div>
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            Tudo
          </button>
          {orderedCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${activeCategory === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {/* Menu */}
      <main className="px-4 py-4">
        {orderedCategories
          .filter((c) => !activeCategory || c.id === activeCategory)
          .map((cat) => (
            <section key={cat.id} className="mb-6">
              <h2 className="font-display mb-3 text-lg font-semibold">{cat.name}</h2>
              <div className="space-y-3">
                {(visibleByCategory.get(cat.id) ?? []).map((p) => {
                  const qty = cart[p.id] ?? 0;
                  const out = p.stock <= 0;
                  return (
                    <article key={p.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          loading="lazy"
                          className="h-20 w-20 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-accent font-display text-2xl font-bold text-accent-foreground">
                          {p.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="font-medium leading-tight">{p.name}</h3>
                        {p.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <span className="font-semibold">{brl(p.price)}</span>
                          {out ? (
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                              Esgotado
                            </span>
                          ) : qty === 0 ? (
                            <button
                              onClick={() => add(p.id, 1)}
                              className="flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
                            >
                              <Plus className="h-4 w-4" /> Adicionar
                            </button>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => add(p.id, -1)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
                                aria-label="Remover um"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-4 text-center font-semibold">{qty}</span>
                              <button
                                onClick={() => add(p.id, 1)}
                                disabled={qty >= p.stock}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                                aria-label="Adicionar um"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        {orderedCategories.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">Cardápio indisponível no momento.</p>
        )}
      </main>

      {/* Cart bar */}
      {count > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-lg"
        >
          <span className="flex items-center gap-2 font-medium">
            <ShoppingBag className="h-5 w-5" /> {count} {count === 1 ? "item" : "itens"}
          </span>
          <span className="font-semibold">{brl(total)}</span>
        </button>
      )}

      {/* Cart / checkout sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={() => setCartOpen(false)}>
          <div
            className="max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Seu pedido</h2>
              <button onClick={() => setCartOpen(false)} aria-label="Fechar" className="rounded-full bg-secondary p-2">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {cartItems.map(({ product, qty }) => (
                <div key={product.id} className="rounded-xl bg-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{brl(product.price)} un.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => add(product.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary" aria-label="Remover">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                      <button onClick={() => add(product.id, 1)} disabled={qty >= product.stock} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Adicionar">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    placeholder="Observação: sem cebola, ponto da carne…"
                    maxLength={300}
                    value={itemNotes[product.id] ?? ""}
                    onChange={(e) =>
                      setItemNotes((n) => ({ ...n, [product.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderType("delivery")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium ${orderType === "delivery" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <Bike className="h-4 w-4" /> Entrega
                </button>
                <button
                  onClick={() => setOrderType("dine_in")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium ${orderType === "dine_in" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <Store className="h-4 w-4" /> No restaurante
                </button>
              </div>

              <input className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm" placeholder="Telefone / WhatsApp" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {orderType === "delivery" && (
                <input className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm" placeholder="Endereço de entrega" value={address} onChange={(e) => setAddress(e.target.value)} />
              )}

              <div>
                <p className="mb-1.5 text-sm font-medium">Pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setPayment(m)}
                      className={`rounded-xl border-2 py-2.5 text-sm ${payment === m ? "border-primary bg-primary/10 font-medium" : "border-border"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <textarea className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm" placeholder="Observações (opcional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button
              onClick={checkout}
              disabled={sending || count === 0}
              className="mt-5 w-full rounded-2xl bg-primary py-4 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {sending ? "Enviando…" : `Confirmar pedido • ${brl(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
