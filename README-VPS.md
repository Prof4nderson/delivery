# Rodando no VPS com Docker

O app usa **PostgreSQL puro** e roda inteiro em containers Docker: um container para o
banco e outro para o app (frontend + backend juntos). A interface já vem otimizada
para celular, com modo escuro cyberpunk e modo claro holográfico. A única configuração obrigatória
é o arquivo `.env`.

## 1. Configurar o `.env`

```bash
cp .env.example .env
# edite usuário, senha e banco se quiser
```

Variáveis principais:

| Variável            | Padrão     | Uso                                   |
| ------------------- | ---------- | ------------------------------------- |
| `POSTGRES_USER`     | `delivery` | usuário do banco                      |
| `POSTGRES_PASSWORD` | `delivery` | senha do banco (**troque!**)          |
| `POSTGRES_DB`       | `delivery` | nome do banco                         |
| `APP_PORT`          | `3000`     | porta onde o app fica exposto no VPS  |

## 2. Subir tudo (banco + app)

```bash
docker compose up -d --build
```

Isso faz tudo:

1. Sobe o PostgreSQL e, na **primeira** subida, aplica `db/schema.sql` automaticamente
   (cria as tabelas e insere o cardápio de exemplo, as senhas das rotas e um entregador
   de teste). O script é idempotente — pode ser reaplicado sem duplicar dados.
2. Constrói a imagem do app a partir do `Dockerfile` e o sobe conectado ao banco.

O app fica em `http://seu-vps:3000`. Coloque um Nginx (ou Caddy/Traefik) na frente
para HTTPS e domínio próprio.

### Subir só o banco (app fora do Docker)

Se preferir rodar o app direto na máquina (sem container):

```bash
docker compose up -d postgres
bun install
NITRO_PRESET=node-server bun run build
DATABASE_URL=postgresql://delivery:delivery@localhost:5432/delivery bun .output/server/index.mjs
# ou com pm2:
# pm2 start "bun .output/server/index.mjs" --name delivery
```

## 3. Comandos úteis

```bash
docker compose logs -f app        # logs do app
docker compose logs -f postgres   # logs do banco
docker compose up -d --build app  # reconstruir o app após mudanças no código
docker compose down               # parar tudo (dados do banco são mantidos)
```

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
  (Se quiser máxima segurança, remova o bloco `ports:` do serviço `postgres` — o app
  continua alcançando o banco pela rede interna do compose.)
