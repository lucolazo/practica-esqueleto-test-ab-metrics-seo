# Laboratorio 01 · Taller Norte — Test A/B sin duplicar URLs

Una landing (`/practica`), dos mensajes (A control, B tratamiento) y **una sola URL indexable**.
Bitácora en `/bitacora`.

## Cómo está resuelto

| Archivo | Qué hace |
| --- | --- |
| `proxy.ts` | Solo `/practica` y solo GET. Sin cookie: crea el visitante (UUID) y deriva la variante con `assignVariant`. Persiste `lab_visitor` y `lab_variant` (httpOnly, `path=/`, 30 días). Anota **una impresión por sesión de 30 minutos** (cookie `lab_impressed`). `?preview=a\|b`, prefetch y crawlers sin cookie no escriben cookies ni cuentan. |
| `lib/experiment.ts` | Hash estable (`FNV-1a 32 bits + fmix32`, sal `lab-01:`), tasa (`null` sin impresiones), `parseLog` (valida antes de usar), detección de crawlers. |
| `lib/db.ts` | Log de eventos en una base: SQLite (local) o Upstash Redis (deploy). La base garantiza una conversión por visitante. |
| `lib/visitor.ts` | Lectura de la asignación en el servidor (header del proxy → cookie). |
| `app/practica/page.tsx` | `generateMetadata` en el servidor: title/description por variante, canonical único `/practica`, `noindex` en `?preview=`. |
| `app/practica/actions.ts` | `recordConversion`: una por visitante, solo desde el CTA. |
| `app/bitacora/page.tsx` | Caso fijo (7,50% · 13,14% · 5,64 pp) calculado con la fórmula + eventos reales de la base. |

La variante **nunca** está en la URL; el canonical es siempre `/practica`, sin query. No se usa `localStorage`.

## Correr en local

```bash
pnpm install
pnpm dev          # usa SQLite en ./data/lab.sqlite (Node >= 22.5)
pnpm verify       # verifica hash, tasa, parseLog, longitudes (Node >= 22.18)
```

## Deploy (Vercel / v0)

El disco de una función serverless no persiste, así que en producción hay que usar Upstash Redis
(integración de Marketplace en Vercel, o una cuenta gratuita en upstash.com). Variables:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_SITE_URL=https://tu-dominio   # base absoluta del canonical
```

(`KV_REST_API_URL` / `KV_REST_API_TOKEN` también se aceptan.) No hay secretos en el repo.
La bitácora indica qué base está leyendo.

## Función de hash

`assignVariant(id)`: FNV-1a de 32 bits sobre `lab-01:<id>`, mezcla final fmix32 (MurmurHash3) y el bit más alto decide (0 → A, 1 → B).
`assignVariant('lab-visitor-demo-01')` → **A**, siempre (verificado en `pnpm verify` y mostrado en `/bitacora`).
