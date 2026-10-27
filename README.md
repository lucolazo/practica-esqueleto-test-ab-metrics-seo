# Laboratorio 01 · Taller Norte

**Una landing, dos mensajes, una sola URL indexable.**

Programación Avanzada 2026 · Licenciatura en Sistemas de Información (FCyT)
Alumna: **Ana Lucía Colazo**

Test A/B de una landing en Next.js. La variante se asigna con un hash estable, los metadatos salen en el HTML del servidor, el canonical es único y los eventos se guardan en una base SQLite local. El proyecto está pensado para **correr en la máquina de quien lo corrige**: no necesita cuentas, servicios externos ni variables de entorno.

> Taller Norte es una escuela ficticia.

---

## URL (con el servidor levantado)

| Página                  | URL                                        |
| ----------------------- | ------------------------------------------ |
| Landing del experimento | <http://localhost:3000/practica>           |
| Bitácora                | <http://localhost:3000/bitacora>           |
| Preview del copy A      | <http://localhost:3000/practica?preview=a> |
| Preview del copy B      | <http://localhost:3000/practica?preview=b> |

---

## Cómo correrlo

### Requisitos

- **Node.js 22.18 o superior** (`node --version`). Hace falta por `node:sqlite` y por `pnpm verify`.
- **pnpm** (`npm install -g pnpm`, o `corepack enable`). También funciona con `npm`.
- Internet la primera vez: `next/font` descarga las tipografías de Google. Sin conexión, en desarrollo usa una fuente de respaldo y el proyecto funciona igual.

### Pasos

```bash
pnpm install     # o: npm install
pnpm dev         # o: npm run dev
```

Abrir <http://localhost:3000/practica>. En la primera carga se crea `data/lab.sqlite`; no hay que preparar nada.

Verificación de la lógica pura (hash, tasa, validación del log, longitudes):

```bash
pnpm verify      # o: npm run verify
```

> Un aviso `ExperimentalWarning: SQLite is an experimental feature` en la consola es normal: `node:sqlite` todavía es experimental.

### Configuración (todo es opcional)

| Variable               | Para qué sirve                                                                                  | Por defecto             |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ----------------------- |
| `LAB_DB_PATH`          | Ruta del archivo SQLite.                                                                        | `./data/lab.sqlite`     |
| `NEXT_PUBLIC_SITE_URL` | Base absoluta del canonical. Definirla solo si el servidor corre en un puerto distinto de 3000. | `http://localhost:3000` |

Si se corre en otro puerto, por ejemplo `pnpm dev -p 4000`, definir `NEXT_PUBLIC_SITE_URL=http://localhost:4000`; si no, el canonical seguirá apuntando al puerto 3000. El proyecto también acepta Upstash Redis (`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`) pensado para un deploy, pero **no se usa en esta entrega**.

---

## Guía de prueba (cómo corregirlo en 5 minutos)

Probar en una **pestaña normal**, con el servidor levantado.

| #   | Qué probar                                            | Qué tiene que pasar                                                                                                    |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Abrir `/practica` y recargar varias veces             | La variante no cambia.                                                                                                 |
| 2   | Abrir `/bitacora`                                     | **Eventos reales**: 1 impresión en la variante que tocó. Recargar `/practica` no la suma otra vez (ventana de 30 min). |
| 3   | Hacer clic en el botón de `/practica`                 | Suma 1 conversión. Un segundo clic no suma otra. Cargar la página nunca convierte.                                     |
| 4   | Abrir `/practica?preview=b`                           | Se ve B, con aviso de preview. No suma visita ni conversión y no cambia la asignación.                                 |
| 5   | Volver a `/practica`                                  | Vuelve la variante asignada, no la del query.                                                                          |
| 6   | Ver el código fuente (`Ctrl+U`) en `/practica`        | `<title>` y `description` de la variante, y `canonical` = `http://localhost:3000/practica`, sin query.                 |
| 7   | Ver el código fuente del preview                      | Lleva `noindex`.                                                                                                       |
| 8   | Abrir una ventana de incógnito y entrar a `/practica` | Es otro visitante: puede tocar la otra variante.                                                                       |
| 9   | `/bitacora`, sección **Caso de prueba fijo**          | **7,50 %**, **13,14 %** y **5,64 pp**, calculados con la fórmula.                                                      |
| 10  | `/bitacora`, sección **Asignación estable**           | `assignVariant('lab-visitor-demo-01')` → **A** tres veces, con "mismo resultado: sí".                                  |

### Con `curl` (opcional)

Mac, Linux o Git Bash:

```bash
curl -s http://localhost:3000/practica | grep -iE "<title|name=\"description\"|canonical|robots"
curl -s "http://localhost:3000/practica?preview=b" | grep -i robots
curl -s -A "Googlebot" -D - -o /dev/null http://localhost:3000/practica | grep -iE "set-cookie|HTTP/"
```

Windows (PowerShell; usar `curl.exe`, no `curl`):

```powershell
curl.exe -s http://localhost:3000/practica | findstr /i "title description canonical robots"
curl.exe -s "http://localhost:3000/practica?preview=b" | findstr /i robots
curl.exe -s -A "Googlebot" -D - -o NUL http://localhost:3000/practica | findstr /i "set-cookie HTTP/"
```

Resultado esperado: title y description de la variante, canonical sin query, `noindex` en el preview y **ninguna cookie** para Googlebot.

### Empezar de cero

1. Detener el servidor.
2. Borrar la carpeta `data/` (se vuelve a crear sola).
3. Borrar las cookies de `localhost` del navegador, o usar una ventana de incógnito. Para ver otra impresión sin esperar 30 minutos, alcanza con borrar la cookie `lab_impressed`.

---

## Qué hace cada archivo

| Archivo                   | Responsabilidad                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proxy.ts`                | Solo `/practica` y solo GET. Sin cookie crea el visitante (UUID) y deriva la variante con `assignVariant`. Persiste `lab_visitor` y `lab_variant` (httpOnly, `path=/`, 30 días). Anota una impresión por sesión de 30 minutos (`lab_impressed`). El preview, el prefetch y los crawlers sin cookie no escriben cookies ni cuentan. |
| `lib/experiment.ts`       | Copy y oferta, hash, tasa (`null` sin impresiones), `parseLog` (valida antes de usar), detección de crawlers y formatos.                                                                                                                                                                                                           |
| `lib/db.ts`               | Log de eventos en SQLite. Un índice único garantiza una conversión por visitante.                                                                                                                                                                                                                                                  |
| `lib/visitor.ts`          | Lectura de la asignación en el servidor (header del proxy y, si falta, cookie).                                                                                                                                                                                                                                                    |
| `app/practica/page.tsx`   | `generateMetadata` en el servidor: title y description por variante, canonical único, `noindex` en `?preview=`.                                                                                                                                                                                                                    |
| `app/practica/actions.ts` | `recordConversion`: una conversión por visitante, solo desde el CTA.                                                                                                                                                                                                                                                               |
| `app/bitacora/page.tsx`   | Caso fijo calculado con la fórmula, eventos reales de la base y prueba del hash.                                                                                                                                                                                                                                                   |
| `components/`             | `landing.tsx` (mensaje y oferta) y `cta.tsx` (botón).                                                                                                                                                                                                                                                                              |
| `scripts/verify.mjs`      | Verificación automática de la lógica pura.                                                                                                                                                                                                                                                                                         |

---

## Decisiones de diseño

- **La variante no está en la URL.** El canonical es siempre `/practica`, sin query. No existen `/variante-a` ni `/variante-b`.
- **Metadatos en el servidor.** Title y description salen en el HTML del primer response. El title usa `absolute`, sin el sufijo del layout.
- **Preview como instrumento.** `?preview=a|b` no escribe cookies, no cuenta y lleva `noindex` (en el meta y en el header `X-Robots-Tag`).
- **Eventos en una base.** Las cookies guardan visitante, variante y ventanas de medición; los conteos viven en SQLite. No se usa `localStorage`.
- **Seguridad.** El proxy descarta cualquier header `x-lab-variant` que venga del cliente. El id de visitante se valida antes de usarse. Al convertir, la variante se vuelve a derivar del id con el hash: manipular la cookie `lab_variant` no cambia lo que se anota.
- **Crawlers.** Un crawler conocido sin cookie recibe el control (A), en la misma URL y con el mismo canonical, y no se anota visitante ni impresión. No es cloaking: no se muestra una cosa al buscador y otra a la persona para manipular el ranking; es una regla fija y documentada que da estabilidad a lo indexado. Se explica en el informe.

---

## Función de hash

`assignVariant(id)`: **FNV-1a de 32 bits** sobre `lab-01:<id>`, con mezcla final **fmix32** (MurmurHash3). El bit más alto decide: 0 → A, 1 → B.

```
assignVariant('lab-visitor-demo-01') → A   (siempre; tres llamadas, mismo resultado)
```

La prueba se ve en `/bitacora` y se verifica con `pnpm verify`, que además comprueba un reparto cercano a 50/50 con 20.000 ids.

---

## Caso de prueba fijo

Los números no salen de la sesión; los porcentajes se calculan con la fórmula `conversiones / impresiones`.

| Variante        | Impresiones | Conversiones | Cálculo              | Tasa        |
| --------------- | ----------- | ------------ | -------------------- | ----------- |
| A · Control     | 240         | 18           | 18 / 240 = 0,075     | **7,50 %**  |
| B · Tratamiento | 236         | 31           | 31 / 236 = 0,131355… | **13,14 %** |
| B − A           |             |              | 13,14 − 7,50         | **5,64 pp** |

Es una diferencia entre tasas, no una prueba: no se declara ganador.

---

## Límites conocidos

- `pnpm verify` prueba solo la lógica pura. El proxy, las cookies y los metadatos HTML se comprueban con la guía de prueba de arriba.
- Si el navegador bloquea las cookies, cada visita parece un visitante nuevo y suma una impresión.
- `curl` y `wget` no se consideran crawlers: cuentan como visitantes.
- Los datos viven en `data/lab.sqlite`, en la máquina donde corre el servidor; la carpeta está en `.gitignore`, así que cada copia del proyecto empieza con la bitácora real en cero.

---

## Problemas frecuentes

| Síntoma                                                | Causa y solución                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot find module 'node:sqlite'` o error al arrancar | Node demasiado viejo. Instalar Node 22.18 o superior.                                                                                       |
| `pnpm: command not found`                              | `npm install -g pnpm`, o usar `npm install` y `npm run dev`.                                                                                |
| El puerto 3000 está ocupado                            | `pnpm dev -p 3001` y definir `NEXT_PUBLIC_SITE_URL=http://localhost:3001`.                                                                  |
| En la bitácora, "sin conexión" o error de lectura      | No se pudo abrir `data/lab.sqlite`: revisar permisos de escritura de la carpeta del proyecto, o fijar `LAB_DB_PATH` en una ruta escribible. |
| Cada recarga parece un visitante nuevo                 | Cookies bloqueadas. Probar en una pestaña normal con las cookies de `localhost` habilitadas.                                                |
| Las tipografías se ven distintas                       | Sin internet, `next/font` usa una fuente de respaldo. No afecta la lógica.                                                                  |
