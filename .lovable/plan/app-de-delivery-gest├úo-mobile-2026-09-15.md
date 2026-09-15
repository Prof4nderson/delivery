# App de Delivery + Gestão (mobile)

Aplicativo para celular com cardápio por dia da semana, carrinho, acompanhamento de pedido e telas de operação (cozinha, entrega, caixa, admin). Todos os dados ficam salvos no servidor (Lovable Cloud), não no celular.

## Telas do cliente
- **Início / Cardápio**: categorias (Pratos quentes, Lanches, Sobremesas, Bebidas, Outros — editáveis pelo admin). Pratos quentes mostram apenas o que está configurado para o dia da semana atual. Itens sem estoque aparecem como "esgotado".
- **Carrinho**: quantidades, observações, escolha entre **entrega** ou **consumo no restaurante**, endereço quando for entrega, e **meio de pagamento** (dinheiro, Pix, cartão na entrega).
- **Acompanhamento**: número do pedido e status. Avisos em toast quando o pedido é **confirmado**, entra em **preparo** e **sai para entrega**.

## Telas de operação (cada uma com senha configurável)
- **/cozinha (KDS)**: colunas Confirmado / Em preparo / Pronto. Cada cartão mostra número do pedido, nome do cliente e os itens. Só aparecem produtos marcados como "preparar na cozinha".
- **/entrega**: o entregador faz login com a própria senha, vê pedidos prontos, **assume** um pedido, marca a conferência dos itens, sai para entrega e confirma entrega + recebimento do pagamento. O admin recebe toast a cada entrega concluída.
- **/caixa**: abertura e fechamento de turno, registro dos pagamentos recebidos, lançamento de receitas e despesas, e **relatório de faturamento** no fim do turno.
- **/admin**: senha própria, também configurável.

## Painel do admin
- **Produtos**: nome, preço, categoria, foto, estoque, "precisa preparo na cozinha" (sim/não), disponível/indisponível — indisponíveis não aparecem no cardápio do cliente.
- **Categorias**: criar, renomear, reordenar, ativar/desativar.
- **Cardápio do dia**: para cada dia da semana, escolher os pratos quentes que aparecem.
- **Entregadores**: nome, telefone, e-mail, placa do veículo, senha de acesso.
- **Senhas das rotas**: /cozinha, /entrega, /caixa e /admin.
- **Aparência do app**: cores principais, nome do restaurante e logo — aplicados em todo o app.
- **Financeiro**: faturamento consolidado por período e por turno, despesas e receitas, relatórios de turnos encerrados.

## Notas técnicas
- Backend: Lovable Cloud (banco Postgres + storage para imagens). Nada de dados só no navegador.
- Tabelas: `categories`, `products`, `daily_menu`, `orders`, `order_items`, `couriers`, `shifts`, `cash_entries`, `route_passwords`, `app_settings`.
- Status do pedido: `pending → confirmed → preparing → ready → out_for_delivery → delivered` (+ `cancelled`); pedidos de salão terminam em `served`.
- Estoque decrementado na confirmação do pedido; devolvido em cancelamento.
- Atualização ao vivo entre cliente/cozinha/entrega via Realtime; toasts disparados pelas mudanças de status.
- Senhas de rota e de entregador guardadas com hash e validadas no servidor (nunca no código do app).
- Sessão de acesso por rota guardada em cookie de sessão, com validade até o fim do turno.
- Layout mobile-first: navegação inferior no app do cliente, cartões grandes e alvos de toque amplos nas telas de operação.

## Ordem de construção
1. Banco de dados, configurações e senhas de rota.
2. Cardápio + carrinho + finalização do pedido (cliente).
3. Acompanhamento do pedido com toasts.
4. /cozinha (KDS).
5. /entrega com login de entregador e confirmação de pagamento.
6. Turnos + /caixa + relatório de faturamento.
7. /admin: produtos, categorias, cardápio do dia, entregadores, senhas, aparência, financeiro.

## Fora deste escopo (por enquanto)
- Pagamento online integrado (Pix/cartão automáticos) — o pagamento é registrado manualmente na entrega/caixa.
- Notificações push fora do app; os avisos são toasts dentro do app.
