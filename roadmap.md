# Roadmap — App de Delivery

- [x] Schema + seeds (categorias, produtos, cardápio semanal, senhas, entregador exemplo)
- [x] Tema visual (Fraunces + Work Sans, paleta quente) e cor dinâmica via settings
- [x] Server fns: gate/senhas, público, pedidos, cozinha/entrega/caixa, admin
- [x] Rota / — cardápio, carrinho, checkout (entrega/salão, pagamento)
- [x] Rota /pedido/$id — acompanhamento em tempo real com toasts
- [x] Rota /cozinha — KDS (confirmados/em preparo/prontos), só itens needs_kitchen
- [x] Rota /entrega — login do entregador, assumir entrega, checklist, confirmar entrega+pagamento
- [x] Rota /caixa — abrir/fechar turno, lançamentos, relatório de faturamento
- [x] Rota /admin — produtos, categorias, cardápio semanal, entregadores, senhas, aparência, financeiro
- [x] Verificação end-to-end no navegador (pedido → cozinha → entrega → caixa → admin)

Fora de escopo (futuro): pagamento online (Pix/cartão), notificações push.
