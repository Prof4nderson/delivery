import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Bike,
  Gift,
  Heart,
  Home,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getMenuData, getSettings } from "@/lib/public.functions";
import { createOrder } from "@/lib/orders.functions";
import { brl, PAYMENT_METHODS } from "@/lib/format";
import { Button } from "@/components/ui/button";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuPage,
});

const DAILY_CATEGORY_NAME = "pratos quentes";

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

function MenuPage() {
  const { menu, settings } = Route.useLoaderData();
  const navigate = useNavigate();
  const submitOrder = useServerFn(createOrder);

  const [cart, setCart] = useState<Cart>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "dine_in">("delivery");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");

  const categories = menu.categories as Category[];
  const products = menu.products as Product[];
  const dailyIds = new Set(menu.dailyIds as string[]);
  const normalizedQuery = query.trim().toLowerCase();

  const visibleByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const cat of categories) {
      const isDaily = cat.name.trim().toLowerCase() === DAILY_CATEGORY_NAME;
      const list = products.filter((p) => {
        const availableToday = p.category_id === cat.id && (!isDaily || dailyIds.has(p.id));
        const matchesSearch =
          !normalizedQuery ||
          p.name.toLowerCase().includes(normalizedQuery) ||
          (p.description?.toLowerCase().includes(normalizedQuery) ?? false);
        return availableToday && matchesSearch;
      });
      if (list.length) map.set(cat.id, list);
    }
    return map;
  }, [categories, products, dailyIds, normalizedQuery]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = products.find((p) => p.id === id);
          return product ? { product, qty } : null;
        })
        .filter((item): item is { product: Product; qty: number } => Boolean(item && item.qty > 0)),
    [cart, products],
  );
  const total = cartItems.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const count = cartItems.reduce((s, i) => s + i.qty, 0);
  const orderedCategories = categories.filter((c) => visibleByCategory.has(c.id));
  const popular = orderedCategories.flatMap((c) => visibleByCategory.get(c.id) ?? []).slice(0, 4);
  const heroProduct = popular[0];

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

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pr-14">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">Olá, seja bem-vindo</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold leading-tight text-foreground">
            {settings.restaurant_name}
          </h1>
          <p className="mt-1 text-sm font-medium text-primary">Comida boa, humor melhor</p>
        </div>
        <div className="icon-tile grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt={settings.restaurant_name} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <Store className="h-6 w-6 text-primary" />
          )}
        </div>
      </header>

      <div className="holo-input mt-5 flex items-center gap-3 rounded-2xl px-4 py-3">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar pratos, lanches e bebidas"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded-full px-5 ${!activeCategory ? "neon-button" : "glass-card text-foreground"}`}
          variant={activeCategory ? "ghost" : "default"}
        >
          Tudo
        </Button>
        {orderedCategories.map((c) => (
          <Button
            type="button"
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`shrink-0 rounded-full px-5 ${activeCategory === c.id ? "neon-button" : "glass-card text-foreground"}`}
            variant={activeCategory === c.id ? "default" : "ghost"}
          >
            {c.name}
          </Button>
        ))}
      </nav>

      {heroProduct && !activeCategory && !normalizedQuery && (
        <section className="glass-card relative mt-5 overflow-hidden rounded-[2rem] p-5">
          <div className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-accent-foreground">
            20% OFF
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-end gap-3">
            <div className="min-w-0 pb-1">
              <p className="neon-pill inline-flex rounded-full px-3 py-1 text-xs font-bold">Combo do dia</p>
              <h2 className="font-display mt-4 text-2xl font-extrabold leading-tight">{heroProduct.name}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{heroProduct.description}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xl font-black text-primary">{brl(heroProduct.price)}</span>
                <Button type="button" onClick={() => add(heroProduct.id, 1)} className="neon-button rounded-full px-4">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            </div>
            <div className="icon-tile aspect-square overflow-hidden rounded-[1.75rem]">
              {heroProduct.image_url ? (
                <img src={heroProduct.image_url} alt={heroProduct.name} className="h-full w-full object-cover" />
              ) : (
                <UtensilsCrossed className="m-auto h-12 w-12 text-primary" />
              )}
            </div>
          </div>
        </section>
      )}

      <main className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-extrabold">Popular agora</h2>
          <span className="text-xs font-bold uppercase text-muted-foreground">{count} no carrinho</span>
        </div>
        {orderedCategories
          .filter((c) => !activeCategory || c.id === activeCategory)
          .map((cat) => (
            <section key={cat.id} className="mb-7">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> {cat.name}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(visibleByCategory.get(cat.id) ?? []).map((p) => {
                  const qty = cart[p.id] ?? 0;
                  const out = p.stock <= 0;
                  return (
                    <article key={p.id} className="glass-card flex min-h-64 flex-col rounded-[1.75rem] p-3">
                      <div className="relative aspect-square overflow-hidden rounded-[1.35rem] bg-secondary">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-4xl font-black text-primary">{p.name.charAt(0)}</div>
                        )}
                        <button type="button" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-glass text-foreground backdrop-blur-xl" aria-label="Favoritar">
                          <Heart className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-1 flex-col pt-3">
                        <h4 className="line-clamp-2 min-h-10 text-sm font-extrabold leading-tight">{p.name}</h4>
                        {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="text-sm font-black text-primary">{brl(p.price)}</span>
                          {out ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Esgotado</span>
                          ) : qty === 0 ? (
                            <Button type="button" onClick={() => add(p.id, 1)} size="icon" className="neon-button h-9 w-9 rounded-full" aria-label="Adicionar">
                              <Plus className="h-4 w-4" />
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Button type="button" onClick={() => add(p.id, -1)} size="icon" variant="secondary" className="h-8 w-8 rounded-full" aria-label="Remover um">
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-5 text-center text-sm font-black">{qty}</span>
                              <Button type="button" onClick={() => add(p.id, 1)} disabled={qty >= p.stock} size="icon" className="neon-button h-8 w-8 rounded-full" aria-label="Adicionar um">
                                <Plus className="h-4 w-4" />
                              </Button>
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
          <p className="glass-card rounded-[1.75rem] py-16 text-center text-muted-foreground">Cardápio indisponível no momento.</p>
        )}
      </main>

      <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto grid max-w-xl grid-cols-4 gap-1 rounded-[1.6rem] border border-border bg-glass-strong p-2 text-muted-foreground shadow-2xl backdrop-blur-2xl">
        {[{ icon: Home, label: "Início" }, { icon: Gift, label: "Ofertas" }, { icon: ReceiptText, label: "Pedidos" }, { icon: Heart, label: "Favoritos" }].map((item, idx) => (
          <button key={item.label} type="button" className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.68rem] font-bold ${idx === 0 ? "neon-pill text-primary" : ""}`}>
            <item.icon className="h-4 w-4" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      {count > 0 && !cartOpen && (
        <Button
          type="button"
          onClick={() => setCartOpen(true)}
          className="neon-button fixed inset-x-4 bottom-24 z-30 mx-auto flex h-auto max-w-xl items-center justify-between rounded-[1.35rem] px-5 py-4"
        >
          <span className="flex items-center gap-2 font-bold">
            <ShoppingBag className="h-5 w-5" /> {count} {count === 1 ? "item" : "itens"}
          </span>
          <span className="font-black">{brl(total)}</span>
        </Button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-scrim" onClick={() => setCartOpen(false)}>
          <div className="max-h-[90vh] overflow-y-auto rounded-t-[2rem] border border-border bg-popover p-5 shadow-2xl backdrop-blur-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-extrabold">Seu pedido</h2>
              <Button type="button" onClick={() => setCartOpen(false)} aria-label="Fechar" size="icon" variant="secondary" className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-2">
              {cartItems.map(({ product, qty }) => (
                <div key={product.id} className="glass-card rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{brl(product.price)} un.</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" onClick={() => add(product.id, -1)} size="icon" variant="secondary" className="h-8 w-8 rounded-full" aria-label="Remover">
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-5 text-center text-sm font-black">{qty}</span>
                      <Button type="button" onClick={() => add(product.id, 1)} disabled={qty >= product.stock} size="icon" className="neon-button h-8 w-8 rounded-full" aria-label="Adicionar">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <input
                    className="holo-input mt-2 w-full rounded-xl px-3 py-2 text-xs"
                    placeholder="Observação: sem cebola, ponto da carne…"
                    maxLength={300}
                    value={itemNotes[product.id] ?? ""}
                    onChange={(e) => setItemNotes((n) => ({ ...n, [product.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" onClick={() => setOrderType("delivery")} variant="ghost" className={`h-auto rounded-2xl border-2 py-3 ${orderType === "delivery" ? "border-primary bg-primary/15" : "border-border"}`}>
                  <Bike className="h-4 w-4" /> Entrega
                </Button>
                <Button type="button" onClick={() => setOrderType("dine_in")} variant="ghost" className={`h-auto rounded-2xl border-2 py-3 ${orderType === "dine_in" ? "border-primary bg-primary/15" : "border-border"}`}>
                  <Store className="h-4 w-4" /> No restaurante
                </Button>
              </div>

              <input className="holo-input w-full rounded-2xl px-4 py-3 text-sm" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="holo-input w-full rounded-2xl px-4 py-3 text-sm" placeholder="Telefone / WhatsApp" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {orderType === "delivery" && (
                <input className="holo-input w-full rounded-2xl px-4 py-3 text-sm" placeholder="Endereço de entrega" value={address} onChange={(e) => setAddress(e.target.value)} />
              )}

              <div>
                <p className="mb-1.5 text-sm font-bold">Pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <Button key={m} type="button" onClick={() => setPayment(m)} variant="ghost" className={`h-auto rounded-2xl border-2 py-2.5 text-sm ${payment === m ? "border-primary bg-primary/15 font-bold" : "border-border"}`}>
                      {m}
                    </Button>
                  ))}
                </div>
              </div>

              <textarea className="holo-input w-full rounded-2xl px-4 py-3 text-sm" placeholder="Observações gerais (opcional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <Button
              type="button"
              onClick={checkout}
              disabled={sending || count === 0}
              className="neon-button mt-5 h-auto w-full rounded-[1.35rem] py-4 text-base font-black"
            >
              {sending ? "Enviando…" : `Confirmar pedido • ${brl(total)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
