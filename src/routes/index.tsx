import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bike,
  Check,
  CircleCheck,
  CreditCard,
  MapPin,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from "lucide-react";
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
      {
        name: "description",
        content: "Escolha seus pratos, monte o carrinho e acompanhe o pedido em tempo real.",
      },
      {
        property: "og:title",
        content: `${loaderData?.settings.restaurant_name ?? "Cardápio"} — Cardápio do dia`,
      },
      {
        property: "og:description",
        content: "Escolha seus pratos, monte o carrinho e acompanhe o pedido em tempo real.",
      },
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

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "dine_in">("delivery");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");

  const categories = menu.categories as Category[];
  const products = menu.products as Product[];
  const dailyIds = useMemo(() => new Set(menu.dailyIds as string[]), [menu.dailyIds]);

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
  const total = cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);
  const count = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const orderedCategories = categories.filter((c) => visibleByCategory.has(c.id));

  function add(id: string, delta: number) {
    setCart((current) => {
      const next = { ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });
  }

  async function checkout() {
    if (!name.trim() || !phone.trim()) {
      toast.error("Informe seu nome e telefone");
      return;
    }
    if (orderType === "delivery" && !address.trim()) {
      toast.error("Informe o endereço");
      return;
    }
    if (!cartItems.length) {
      toast.error("Carrinho vazio");
      return;
    }
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
          items: cartItems.map((item) => {
            const note = itemNotes[item.product.id]?.trim();
            return {
              product_id: item.product.id,
              qty: item.qty,
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
    <div className="mx-auto min-h-screen max-w-2xl pb-28">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3.5">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.restaurant_name}
              className="h-11 w-11 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Store className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="eyebrow">Comida feita com cuidado</p>
            <h1 className="truncate font-display text-xl font-bold leading-tight">
              {settings.restaurant_name}
            </h1>
          </div>
          {count > 0 && (
            <button
              onClick={() => setCartOpen(true)}
              className="icon-button ml-auto"
              aria-label="Abrir carrinho"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="absolute -mt-7 ml-7 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${!activeCategory ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
          >
            Tudo
          </button>
          {orderedCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${activeCategory === category.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-5">
        <section className="page-enter relative mb-7 overflow-hidden rounded-3xl bg-foreground px-5 py-6 text-background shadow-xl sm:px-7">
          <div className="relative z-10 max-w-sm">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-background/12 px-3 py-1.5 text-xs font-semibold text-background/80">
              <Sparkles className="h-3.5 w-3.5" /> Feito hoje, servido com carinho
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight">
              Seu próximo prato favorito começa aqui.
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-background/70">
              Escolha seus favoritos, personalize o pedido e receba tudo quentinho.
            </p>
          </div>
          <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full bg-primary/40 blur-2xl" />
          <div className="absolute -bottom-20 right-8 h-44 w-44 rounded-full border-[24px] border-accent/30" />
        </section>

        {orderedCategories
          .filter((category) => !activeCategory || category.id === activeCategory)
          .map((category, categoryIndex) => (
            <section
              key={category.id}
              className="mb-7 page-enter"
              style={{ animationDelay: `${80 + categoryIndex * 45}ms` }}
            >
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="eyebrow">Seleção da casa</p>
                  <h2 className="font-display text-xl font-semibold">{category.name}</h2>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {visibleByCategory.get(category.id)?.length ?? 0} opções
                </span>
              </div>
              <div className="space-y-3">
                {(visibleByCategory.get(category.id) ?? []).map((product, productIndex) => {
                  const qty = cart[product.id] ?? 0;
                  const out = product.stock <= 0;
                  return (
                    <article
                      key={product.id}
                      className="surface-card group flex gap-3 p-3.5"
                      style={{ animationDelay: `${productIndex * 35}ms` }}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          loading="lazy"
                          className="h-24 w-24 shrink-0 rounded-2xl object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-accent font-display text-3xl font-bold text-accent-foreground">
                          {product.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="font-semibold leading-tight">{product.name}</h3>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="font-display text-lg font-bold">
                            {brl(product.price)}
                          </span>
                          {out ? (
                            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                              Esgotado
                            </span>
                          ) : qty === 0 ? (
                            <button
                              onClick={() => add(product.id, 1)}
                              className="action-button px-3.5 py-2 text-xs"
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 rounded-full bg-secondary p-1">
                              <button
                                onClick={() => add(product.id, -1)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-background"
                                aria-label={`Remover ${product.name}`}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-5 text-center text-sm font-bold">{qty}</span>
                              <button
                                onClick={() => add(product.id, 1)}
                                disabled={qty >= product.stock}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                                aria-label={`Adicionar ${product.name}`}
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
          <div className="empty-state py-16">
            <ReceiptText className="h-6 w-6" />
            <p className="font-semibold">Cardápio indisponível</p>
            <p className="text-sm text-muted-foreground">Volte em alguns instantes.</p>
          </div>
        )}
      </main>

      {count > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="page-enter fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-2xl items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-xl shadow-primary/25"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingBag className="h-5 w-5" />
            {count} {count === 1 ? "item" : "itens"}
          </span>
          <span className="flex items-center gap-1 font-bold">
            Ver pedido <ArrowRight className="h-4 w-4" />
          </span>
          <span className="hidden font-display text-lg font-bold sm:block">{brl(total)}</span>
        </button>
      )}

      {cartOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-40 flex flex-col justify-end"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="modal-sheet max-h-[92vh] overflow-y-auto bg-background p-5 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border" />
            <div className="mx-auto max-w-2xl">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Quase lá</p>
                  <h2 className="font-display text-2xl font-bold">Revise seu pedido</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confira os itens e escolha como receber.
                  </p>
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  aria-label="Fechar carrinho"
                  className="icon-button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                {cartItems.map(({ product, qty }) => (
                  <div key={product.id} className="rounded-2xl border border-border bg-card p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{product.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {brl(product.price)} por unidade
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-secondary p-1">
                        <button
                          onClick={() => add(product.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-background"
                          aria-label="Remover item"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{qty}</span>
                        <button
                          onClick={() => add(product.id, 1)}
                          disabled={qty >= product.stock}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                          aria-label="Adicionar item"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs"
                      placeholder="Observação: sem cebola, ponto da carne…"
                      maxLength={300}
                      value={itemNotes[product.id] ?? ""}
                      onChange={(event) =>
                        setItemNotes((current) => ({
                          ...current,
                          [product.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold">Como você quer receber?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOrderType("delivery")}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold ${orderType === "delivery" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}
                    >
                      <Bike className="h-4 w-4" /> Entrega
                    </button>
                    <button
                      onClick={() => setOrderType("dine_in")}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold ${orderType === "dine_in" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}
                    >
                      <Store className="h-4 w-4" /> No local
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Seu nome
                    <input
                      className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm font-normal"
                      placeholder="Como podemos chamar você?"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Telefone / WhatsApp
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className="w-full rounded-xl border border-input bg-card py-3 pl-9 pr-4 text-sm font-normal"
                        placeholder="(00) 00000-0000"
                        inputMode="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>
                  </label>
                </div>
                {orderType === "delivery" && (
                  <label className="block text-sm font-semibold">
                    Endereço de entrega
                    <div className="relative mt-1.5">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className="w-full rounded-xl border border-input bg-card py-3 pl-9 pr-4 text-sm font-normal"
                        placeholder="Rua, número e complemento"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                      />
                    </div>
                  </label>
                )}
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4 text-primary" /> Forma de pagamento
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method}
                        onClick={() => setPayment(method)}
                        className={`rounded-xl border-2 py-2.5 text-sm ${payment === method ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border bg-card"}`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-sm font-semibold">
                  Observações <span className="font-normal text-muted-foreground">(opcional)</span>
                  <textarea
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm font-normal"
                    placeholder="Algum detalhe importante para o restaurante?"
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Total do pedido</span>
                <span className="font-display text-2xl font-bold">{brl(total)}</span>
              </div>
              <button
                onClick={checkout}
                disabled={sending || count === 0}
                className="action-button mt-4 w-full py-4 text-sm disabled:opacity-50"
              >
                {sending ? (
                  "Enviando pedido…"
                ) : (
                  <>
                    <CircleCheck className="h-5 w-5" /> Confirmar pedido
                  </>
                )}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" /> Você poderá acompanhar o status em
                tempo real
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
