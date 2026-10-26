export type Variant = 'a' | 'b'

export type VariantStats = {
  impressions: number
  conversions: number
}

export type ExperimentLog = Record<Variant, VariantStats>

// Los conteos NO viven en una cookie: se guardan en una base (lib/db.ts).
// La cookie solo recuerda al visitante, su variante y las ventanas de medición.
export const COOKIE = {
  visitor: 'lab_visitor',
  variant: 'lab_variant',
  impressed: 'lab_impressed',
  converted: 'lab_converted',
} as const

// Header interno: proxy.ts lo escribe en cada request a /practica (y borra el que
// venga del cliente) para que la página vea la variante ya en el primer response.
export const HEADER = { variant: 'x-lab-variant' } as const

export const HASH_NAME = 'FNV-1a de 32 bits + mezcla fmix32 (MurmurHash3)'

export const THIRTY_DAYS = 60 * 60 * 24 * 30
export const SESSION_WINDOW = 60 * 30
export const CANONICAL_PATH = '/practica'
export const TITLE_RANGE = { min: 50, max: 60 }
export const DESCRIPTION_RANGE = { min: 140, max: 160 }

export const OFFER = [
  { label: 'Inicio', value: '14 de abril' },
  { label: 'Duración', value: '8 semanas' },
  { label: 'Cupo', value: '12 personas' },
  { label: 'Oficios', value: 'Carpintería, electricidad, cocina' },
] as const

export const VARIANTS = {
  a: {
    id: 'a',
    name: 'Control',
    seoTitle: 'Cursos de oficio en ocho semanas, con salida laboral',
    seoDescription:
      'Aprendé carpintería, electricidad o cocina en ocho semanas. Grupos de doce personas y práctica real, con una salida laboral que se puede cobrar.',
    headline: 'Ocho semanas para un oficio que se puede cobrar.',
    emphasis: null,
    lede: 'La práctica empieza en la primera clase. El mensaje de esta variante habla del método, no de la escasez.',
    cta: 'Ver cupos de abril',
  },
  b: {
    id: 'b',
    name: 'Tratamiento',
    seoTitle: 'Abril abre cupos: cursos de oficio en grupos de 12',
    seoDescription:
      'El 14 de abril empiezan grupos de doce. En la cohorte anterior, ocho de cada diez consiguieron trabajo en el rubro antes de los noventa días.',
    headline: 'El curso empieza el 14 de abril.',
    emphasis: 'El cupo, no.',
    lede: 'Doce lugares y una fecha. El mensaje de esta variante apura la decisión, sin cambiar la oferta.',
    cta: 'Reservar mi lugar',
  },
} as const

export const TEST_CASE: ExperimentLog = {
  a: { impressions: 240, conversions: 18 },
  b: { impressions: 236, conversions: 31 },
}

export const HASH_EXAMPLE_ID = 'lab-visitor-demo-01'

export function isVariant(value: string | null | undefined): value is Variant {
  return value === 'a' || value === 'b'
}

export function emptyLog(): ExperimentLog {
  return {
    a: { impressions: 0, conversions: 0 },
    b: { impressions: 0, conversions: 0 },
  }
}

// Hash determinístico, sin dependencias y sin azar:
//  1. FNV-1a de 32 bits sobre 'lab-01:' + id (la sal separa este experimento de otros).
//  2. fmix32 de MurmurHash3, para que todos los bits dependan de todo el id.
//  3. El bit más alto decide: 0 → A, 1 → B (50/50).
export function hashVisitor(visitorId: string): number {
  let h = 0x811c9dc5
  for (const byte of new TextEncoder().encode(`lab-01:${visitorId}`)) {
    h ^= byte
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

export function assignVariant(visitorId: string): Variant {
  return hashVisitor(visitorId) >>> 31 === 0 ? 'a' : 'b'
}

// El id viene de una cookie: no se confía hasta validarlo (UUID o similar).
export function isVisitorId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value)
}

// Crawlers conocidos. No incluye curl/wget: no son buscadores. Un crawler sin
// cookie recibe siempre el control (A), en la misma URL y con el mismo canonical.
const CRAWLER_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|mediapartners|adsbot|google-inspectiontool|lighthouse|headlesschrome|ia_archiver|yandex|baiduspider|duckduckgo/i

export function isCrawler(userAgent: string | null | undefined): boolean {
  return typeof userAgent === 'string' && CRAWLER_PATTERN.test(userAgent)
}

export function conversionRate(stats: VariantStats): number | null {
  // Sin impresiones la tasa no existe: null, nunca 0.
  if (!(stats.impressions > 0)) return null
  return stats.conversions / stats.impressions
}

export function rateGap(log: ExperimentLog): number | null {
  const control = conversionRate(log.a)
  const treatment = conversionRate(log.b)
  if (control === null || treatment === null) return null
  return (treatment - control) * 100
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseStats(value: unknown): VariantStats | null {
  if (typeof value !== 'object' || value === null) return null
  const { impressions, conversions } = value as Record<string, unknown>
  if (!isCount(impressions) || !isCount(conversions)) return null
  return { impressions, conversions }
}

// Todo lo que entra al cálculo pasa por acá: JSON ilegible, forma incorrecta o
// conteos negativos/no enteros → log vacío. Nunca se usa el dato sin validar.
export function parseLog(raw: string | undefined): ExperimentLog {
  if (typeof raw !== 'string') return emptyLog()
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return emptyLog()
    const a = parseStats((data as Record<string, unknown>).a)
    const b = parseStats((data as Record<string, unknown>).b)
    return a && b ? { a, b } : emptyLog()
  } catch {
    return emptyLog()
  }
}

export function serializeLog(log: ExperimentLog): string {
  return JSON.stringify(log)
}

const numberFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const integerFormat = new Intl.NumberFormat('es-AR')

export function formatCount(value: number): string {
  return integerFormat.format(value)
}

export function formatRate(rate: number | null): string {
  if (rate === null) return 'Sin impresiones'
  return `${numberFormat.format(rate * 100)}%`
}

export function formatPoints(value: number | null): string {
  if (value === null) return 'Sin datos'
  return `${numberFormat.format(value)} pp`
}

export function characterCount(value: string): number {
  return Array.from(value).length
}

export function inRange(length: number, range: { min: number; max: number }): boolean {
  return length >= range.min && length <= range.max
}

export function cookieOptions(secure: boolean, maxAge?: number) {
  // El preview corre en un iframe: la cookie tiene que ser Secure y SameSite=None.
  return {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: secure ? ('none' as const) : ('lax' as const),
    partitioned: secure,
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  }
}
