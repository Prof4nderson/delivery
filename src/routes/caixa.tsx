import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Check,
  Clock3,
  DoorClosed,
  DoorOpen,
  FileText,
  LockKeyhole,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { OpsGate, useOpsQuery, hasOpsAccess } from "@/components/ops-gate";
import { OpsHeader, SectionHeading } from "@/components/ops-nav";
import { getOpsSessionInfo } from "@/lib/gate.functions";
import { getCashierData, openShift, addCashEntry, closeShift } from "@/lib/ops.functions";
import { brl, PAYMENT_METHODS } from "@/lib/format";

export const Route = createFileRoute("/caixa")({
  loader: () => getOpsSessionInfo(),
  head: () => ({
    meta: [
      { title: "Caixa" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Caixa" },
      { property: "og:description", content: "Controle de caixa e turno" },
    ],
  }),
  component: CashierPage,
});

type Report = {
  opened_at: string;
  closed_at: string;
  opening_amount: number;
  total_income: number;
  total_expense: number;
  by_method: Record<string, number>;
  orders_count: number;
  orders_total: number;
  orders: {
    order_number: number;
    customer_name: string;
    total: number;
    payment_method: string;
    order_type?: string;
    status?: string;
  }[];
};

type Session = Awaited<ReturnType<typeof getOpsSessionInfo>>;

function CashierPage() {
  const session = Route.useLoaderData();
  const allowed = hasOpsAccess(session, "caixa");
  return (
    <OpsGate role="caixa" title="Caixa" session={session}>
      {allowed && <CashierPanel session={session} />}
    </OpsGate>
  );
}

function CashierPanel({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const fetchData = useServerFn(getCashierData);
  const open = useServerFn(openShift);
  const addEntry = useServerFn(addCashEntry);
  const close = useServerFn(closeShift);
  const { data, isLoading } = useOpsQuery(["cashier"], fetchData, 5000, true);

  const [opening, setOpening] = useState("");
  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0] ?? "Dinheiro");
  const [description, setDescription] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [busy, setBusy] = useState(false);

  const shift = data?.shift ?? null;
  const entries = data?.entries ?? [];
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expense = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const balance = Number(shift?.opening_amount ?? 0) + income - expense;

  async function handleOpen() {
    const value = Number(opening.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Informe um fundo inicial válido");
      return;
    }
    setBusy(true);
    try {
      await open({ data: { opening_amount: value } });
      toast.success("Turno aberto com segurança");
      setOpening("");
      queryClient.invalidateQueries({ queryKey: ["cashier"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir turno");
    } finally {
      setBusy(false);
    }
  }

  async function handleEntry() {
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe uma descrição");
      return;
    }
    setBusy(true);
    try {
      await addEntry({
        data: {
          type: entryType,
          amount: value,
          description: description.trim(),
          method: entryType === "income" ? method : undefined,
        },
      });
      toast.success(entryType === "income" ? "Entrada registrada" : "Saída registrada");
      setAmount("");
      setDescription("");
      setShowEntry(false);
      queryClient.invalidateQueries({ queryKey: ["cashier"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar lançamento");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (
      !window.confirm(
        "Fechar o turno e gerar o relatório de faturamento? Esta ação não pode ser desfeita.",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await close({ data: {} });
      setReport(result.report as Report);
      toast.success("Turno fechado e relatório gerado");
      queryClient.invalidateQueries({ queryKey: ["cashier"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao fechar turno");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell max-w-3xl">
      <OpsHeader
        title="Caixa"
        subtitle="Controle financeiro do turno atual"
        icon={Wallet}
        session={session}
        active="caixa"
      />
      {isLoading && <p className="mb-4 text-sm text-muted-foreground">Carregando caixa…</p>}
      {!shift ? (
        <section className="page-enter surface-card overflow-hidden">
          <div className="bg-foreground p-6 text-background sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <DoorOpen className="h-5 w-5" />
              </span>
              <div>
                <p className="eyebrow text-background/60">Novo turno</p>
                <h2 className="font-display text-2xl font-bold">Abra o caixa para começar</h2>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-background/70">
              Informe o fundo de troco inicial. Todas as entradas, saídas e pedidos serão
              organizados neste turno.
            </p>
          </div>
          <div className="p-6 sm:p-8">
            <label className="block text-sm font-semibold">
              Fundo inicial
              <input
                value={opening}
                onChange={(event) => setOpening(event.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3.5 text-lg"
                autoFocus
              />
            </label>
            <button
              onClick={handleOpen}
              disabled={busy}
              className="action-button mt-4 w-full py-3.5 disabled:opacity-50"
            >
              <LockKeyhole className="h-4 w-4" />
              {busy ? "Abrindo…" : "Abrir turno com segurança"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary" /> Acesso protegido por senha e sessão
              segura
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 page-enter-delay-1">
            <Metric icon={ArrowDownLeft} label="Entradas" value={brl(income)} tone="positive" />
            <Metric icon={ArrowUpRight} label="Saídas" value={brl(expense)} tone="negative" />
            <Metric
              icon={Wallet}
              label="Saldo atual"
              value={brl(balance)}
              tone={balance >= 0 ? "positive" : "negative"}
            />
            <Metric icon={ReceiptText} label="Lançamentos" value={String(entries.length)} />
          </section>
          <section className="surface-card mb-5 p-4 page-enter-delay-2 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Turno em andamento</p>
                <h2 className="font-display text-xl font-bold">Operação aberta</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Aberto em{" "}
                  {new Date(shift.opened_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Ativo
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => setShowEntry(true)} className="action-button flex-1 py-3">
                <Plus className="h-4 w-4" />
                Novo lançamento
              </button>
              <button
                onClick={handleClose}
                disabled={busy}
                className="secondary-button flex-1 py-3 text-destructive disabled:opacity-50"
              >
                <DoorClosed className="h-4 w-4" />
                {busy ? "Fechando…" : "Fechar turno"}
              </button>
            </div>
          </section>

          <section className="page-enter-delay-2">
            <SectionHeading
              eyebrow="Movimentações"
              title="Lançamentos do turno"
              count={entries.length}
            />
            {entries.length === 0 ? (
              <div className="empty-state">
                <Banknote className="h-5 w-5" />
                <p className="font-semibold">Nenhum lançamento ainda</p>
                <p className="text-sm text-muted-foreground">Entradas e saídas aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry, index) => (
                  <article
                    key={entry.id}
                    className="surface-card flex items-center gap-3 p-3.5 page-enter"
                    style={{ animationDelay: `${index * 35}ms` }}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${entry.type === "income" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}
                    >
                      {entry.type === "income" ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.method ?? (entry.type === "expense" ? "Despesa" : "Receita")} •{" "}
                        {new Date(entry.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${entry.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                    >
                      {entry.type === "income" ? "+" : "−"}
                      {brl(entry.amount)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showEntry && (
        <EntrySheet
          entryType={entryType}
          setEntryType={setEntryType}
          amount={amount}
          setAmount={setAmount}
          description={description}
          setDescription={setDescription}
          method={method}
          setMethod={setMethod}
          busy={busy}
          onClose={() => setShowEntry(false)}
          onSave={handleEntry}
        />
      )}
      {report && <ReportSheet report={report} onClose={() => setReport(null)} />}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="metric-card">
      <span
        className={`metric-icon ${tone === "negative" ? "text-destructive" : tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 truncate font-display text-lg font-bold ${tone === "negative" ? "text-destructive" : tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function EntrySheet({
  entryType,
  setEntryType,
  amount,
  setAmount,
  description,
  setDescription,
  method,
  setMethod,
  busy,
  onClose,
  onSave,
}: {
  entryType: "income" | "expense";
  setEntryType: (value: "income" | "expense") => void;
  amount: string;
  setAmount: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  method: string;
  setMethod: (value: string) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div
        className="modal-sheet bg-background p-5 sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="eyebrow">Movimentação manual</p>
              <h2 className="font-display text-2xl font-bold">Novo lançamento</h2>
            </div>
            <button onClick={onClose} className="icon-button" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setEntryType("income")}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold ${entryType === "income" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
            >
              <TrendingUp className="h-4 w-4" />
              Entrada
            </button>
            <button
              onClick={() => setEntryType("expense")}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold ${entryType === "expense" ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}
            >
              <TrendingDown className="h-4 w-4" />
              Saída
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold">
              Valor
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg"
                autoFocus
              />
            </label>
            <label className="block text-sm font-semibold">
              Descrição
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ex.: compra de embalagens"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal"
              />
            </label>
            {entryType === "income" && (
              <div>
                <p className="mb-1.5 text-sm font-semibold">Meio de pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((item) => (
                    <button
                      key={item}
                      onClick={() => setMethod(item)}
                      className={`rounded-xl border-2 py-2.5 text-xs ${method === item ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onSave}
            disabled={busy}
            className="action-button mt-5 w-full py-3.5 disabled:opacity-50"
          >
            {busy ? "Registrando…" : "Registrar lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportSheet({ report, onClose }: { report: Report; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const finalBalance = report.opening_amount + report.total_income - report.total_expense;
  const averageTicket = report.orders_count ? report.orders_total / report.orders_count : 0;
  const maxMethod = Math.max(...Object.values(report.by_method), 1);
  const orderTypes = useMemo(
    () =>
      report.orders.reduce<Record<string, number>>((result, order) => {
        const label = order.order_type === "delivery" ? "Entrega" : "No local";
        result[label] = (result[label] ?? 0) + 1;
        return result;
      }, {}),
    [report.orders],
  );

  function printReport() {
    window.print();
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex flex-col justify-end">
      <div
        className="modal-sheet max-h-[94vh] overflow-y-auto bg-background p-5 sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Fechamento concluído</p>
              <h2 className="font-display text-2xl font-bold">Relatório do turno</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {new Date(report.opened_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                →{" "}
                {new Date(report.closed_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <button onClick={onClose} className="icon-button" aria-label="Fechar relatório">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric icon={ReceiptText} label="Pedidos" value={String(report.orders_count)} />
            <Metric
              icon={Banknote}
              label="Faturamento"
              value={brl(report.orders_total)}
              tone="positive"
            />
            <Metric
              icon={TrendingUp}
              label="Entradas"
              value={brl(report.total_income)}
              tone="positive"
            />
            <Metric
              icon={TrendingDown}
              label="Saídas"
              value={brl(report.total_expense)}
              tone="negative"
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <div className="surface-card p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Saldo final</p>
                  <p
                    className={`font-display text-3xl font-bold ${finalBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                  >
                    {brl(finalBalance)}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
                  Ticket médio {brl(averageTicket)}
                </span>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Receita por pagamento
                </p>
                <div className="space-y-3">
                  {Object.entries(report.by_method).map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{label}</span>
                        <span className="font-semibold">{brl(value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.max(5, (value / maxMethod) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {Object.keys(report.by_method).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Sem receitas registradas por pagamento.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="surface-card p-4">
              <p className="text-sm font-semibold">Resumo operacional</p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fundo inicial</span>
                  <span className="font-semibold">{brl(report.opening_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Período</span>
                  <span className="font-semibold">
                    {Math.max(
                      1,
                      Math.round(
                        (new Date(report.closed_at).getTime() -
                          new Date(report.opened_at).getTime()) /
                          3600000,
                      ),
                    )}
                    h
                  </span>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pedidos por canal
                  </p>
                  {Object.entries(orderTypes).map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1">
                      <span>{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <button
              onClick={() => setExpanded((value) => !value)}
              className="secondary-button w-full justify-between"
            >
              {" "}
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {expanded ? "Ocultar" : "Ver"} detalhamento dos pedidos
              </span>
              <span>{expanded ? "−" : "+"}</span>
            </button>
            {expanded && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-border">
                <div className="hidden grid-cols-[0.5fr_1fr_0.8fr_0.8fr] gap-3 bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground sm:grid">
                  <span>Pedido</span>
                  <span>Cliente</span>
                  <span>Pagamento</span>
                  <span className="text-right">Total</span>
                </div>
                {report.orders.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhum pedido no turno.</p>
                ) : (
                  report.orders.map((order) => (
                    <div
                      key={order.order_number}
                      className="grid gap-1 border-t border-border px-3 py-3 text-sm first:border-t-0 sm:grid-cols-[0.5fr_1fr_0.8fr_0.8fr] sm:items-center sm:gap-3"
                    >
                      <span className="font-semibold">#{order.order_number}</span>
                      <span className="text-muted-foreground">{order.customer_name}</span>
                      <span className="text-xs text-muted-foreground">{order.payment_method}</span>
                      <span className="font-semibold sm:text-right">{brl(order.total)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={printReport} className="secondary-button flex-1">
              <FileText className="h-4 w-4" />
              Imprimir
            </button>
            <button onClick={onClose} className="action-button flex-1">
              <Check className="h-4 w-4" />
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
