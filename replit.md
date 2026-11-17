# Healthfy Admin

Painel em português para a operação da Healthfy IA: clientes, produtos, banco de horas, invoices e páginas de checkout personalizadas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/healthfy-admin run dev` — frontend (use its managed workflow for the assigned port/base path)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/healthfy-admin/src/` — React frontend, administrative and public checkout routes
- `artifacts/api-server/src/routes/` — catalog, invoices, operational records, checkout and overview
- `artifacts/api-server/src/lib/healthfy-store.ts` — entity persistence and activity recording
- `lib/db/src/schema/healthfy.ts` — PostgreSQL entity storage
- `lib/api-spec/openapi.yaml` — source of truth for API contracts; regenerate clients after editing

## Architecture decisions

- Administrative routes require Replit OIDC sessions and an email allowlist in `ADMIN_EMAILS`. An authenticated account is not automatically an administrator. Keep customer data, financial data and uploads protected in development and production; the checkout remains public.
- The user declined connecting a payment provider. Checkout stores a purchase request and creates a CRM lead, never a payment confirmation. Do not collect card data or fabricate Pix QR codes.
- Invoice amounts and customer information are snapshots. Later product/customer edits must not alter issued documents. Numbers come from a database sequence, not list counts.
- Financial values use BRL; totals round to centavos. Manual transactions and invoices are independent sources and should not duplicate the same revenue.

## Product

- Product catalog supports hours, services and digital goods with HTTPS banner URL, checkout copy, accent color and payment terms.
- The initial reference product is based on the supplied contract: 10 hours at R$200/hour, R$2,000 total, R$1,000 entry and R$1,000 at completion.
- Invoices are non-fiscal billing documents, printable via the browser. Paid status is a manual administrative declaration, not gateway verification.
- CRM, projects, agenda, agent configuration, tracking and hour records are persisted operational records. No external calendar, ad platform or AI runtime is connected.

## User preferences

- The user wants to enter the panel with a normal email-and-password form, without depending on Replit sign-in. Preserve the existing administrative allowlist when changing authentication.
- The user explicitly requested removing checkout functionality. Preserve the product catalog, customers, invoices and existing records; do not reintroduce public purchase pages.

- Follow the supplied Healthfy brief: dark collapsible sidebar, predominantly white content, restrained Shopify-inspired professional presentation.
- Use the supplied Stage Grotesk family for interface typography and Arial for descriptions. Avoid subtitles; keep necessary form guidance and operational warnings.
- Clientes should use the supplied interactive glass-folder pattern, with the client's/company's name and uploaded logo highly visible. Preserve projects, invoices and customer actions.
- Multi Agenda should remain a light calendar with large day cells, names and photo avatars for every participant, visible labels, and combinable filters.
- Keep Projetos nested inside Clientes, never a standalone top-level sidebar module.
- Do not present fictitious operational data as real or include decorative nonfunctional actions.

## Gotchas

- Generated fetch clients require `dom.iterable` in their TypeScript lib list. Orval query generation is pinned to React Query v5.
- Product banners accept HTTPS URLs only. Client logos use protected App Storage uploads (PNG/JPG/WebP, up to 5 MB); PostgreSQL stores paths/metadata, never image bytes or base64.
- Customer logo upload requests require authorized sessions. Logos are validated against upload ownership, actual MIME, size and raster signatures before being attached; existing clients without logos remain valid.
- Only draft invoices can be deleted; issued invoices should be cancelled to preserve audit history.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
