# Rodando no VPS com PostgreSQL em Docker

O app usa **PostgreSQL puro**. A única configuração obrigatória é a variável `DATABASE_URL`.

## 1. Configurar o `.env`

```bash
cp .env.example .env
# edite usuário, senha e banco se quiser
```

## 2. Subir o banco

```bash
docker compose up -d
```

Na primeira subida o arquivo `db/schema.sql` é aplicado automaticamente: cria todas as
tabelas e já insere o cardápio de exemplo, as senhas das rotas e um entregador de teste.

Para aplicar o schema manualmente (banco já existente):

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

O script é idempotente — pode ser executado novamente sem duplicar dados.

## 3. Instalar, construir e servir

```bash
bun install
bun run build
bun run start        # ou: pm2 start "bun run start" --name delivery
```

O app fica disponível na porta configurada pelo servidor (padrão 3000). Coloque um Nginx
na frente para HTTPS e domínio próprio.

## 4. Acessos iniciais

| Rota       | Senha inicial |
| ---------- | ------------- |
| `/admin`   | `admin123`    |
| `/cozinha` | `cozinha123`  |
| `/entrega` | `entrega123`  |
| `/caixa`   | `caixa123`    |

Entregador de exemplo: **Carlos Entregador**, senha `1234`.

Troque todas as senhas em **/admin → Senhas** logo no primeiro acesso.

## 5. Backup

```bash
docker exec delivery-postgres pg_dump -U delivery delivery > backup-$(date +%F).sql
```

Restaurar:

```bash
cat backup.sql | docker exec -i delivery-postgres psql -U delivery -d delivery
```

## Observações

- Todos os dados ficam no volume `postgres-data`, persistido entre reinícios.
- As telas de cozinha, entrega, caixa, admin e o acompanhamento do cliente se atualizam
  automaticamente por recarga periódica (a cada 5–15 segundos).
- Nunca exponha a porta 5432 na internet; mantenha o banco acessível só ao app.
