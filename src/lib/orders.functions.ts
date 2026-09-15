import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const orderInput = z.object({
  customer_name: z.string().min(2),
  customer_phone: z.string().min(8),
  order_type: z.enum(["delivery", "dine_in"]),
  address: z.string().optional(),
  payment_method: z.string().min(2),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.number().int().min(1),
        notes: z.string().max(300).optional(),
      }),
    )
    .min(1),
});

type ProductRow = {
  id: string;
  name: string;
  price: string | number;
  stock: number;
  needs_kitchen: boolean;
};

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => orderInput.parse(data))
  .handler(async ({ data }) => {
    if (data.order_type === "delivery" && !data.address?.trim()) {
      throw new Error("Informe o endereço de entrega");
    }
    const { tx } = await import("./db.server");

    const ids = data.items.map((i) => i.product_id);

    return tx(async (client) => {
      const { rows: products } = await client.query<ProductRow>(
        "select id, name, price, stock, needs_kitchen from products where id = any($1::uuid[]) and available = true for update",
        [ids],
      );
      if (products.length !== ids.length) {
        throw new Error("Algum item não está mais disponível");
      }

      for (const item of data.items) {
        const p = products.find((x) => x.id === item.product_id)!;
        if (p.stock < item.qty) throw new Error(`Estoque insuficiente: ${p.name}`);
      }

      const total = data.items.reduce((sum, item) => {
        const p = products.find((x) => x.id === item.product_id)!;
        return sum + Number(p.price) * item.qty;
      }, 0);

      const { rows: orderRows } = await client.query<{ id: string; order_number: number }>(
        `insert into orders
           (customer_name, customer_phone, order_type, address, payment_method, notes, total, status)
         values ($1,$2,$3,$4,$5,$6,$7,'confirmed')
         returning id, order_number`,
        [
          data.customer_name.trim(),
          data.customer_phone.trim(),
          data.order_type,
          data.order_type === "delivery" ? data.address!.trim() : null,
          data.payment_method,
          data.notes?.trim() || null,
          total,
        ],
      );
      const order = orderRows[0]!;

      for (const item of data.items) {
        const p = products.find((x) => x.id === item.product_id)!;
        await client.query(
          `insert into order_items (order_id, product_id, name, price, qty, needs_kitchen, notes)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, p.id, p.name, p.price, item.qty, p.needs_kitchen, item.notes?.trim() || null],
        );
        await client.query("update products set stock = stock - $1 where id = $2", [
          item.qty,
          p.id,
        ]);
      }

      return { ok: true as const, orderId: order.id, orderNumber: order.order_number };
    });
  });
