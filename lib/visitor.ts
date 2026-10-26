import { cookies, headers } from 'next/headers'
import { COOKIE, HEADER, assignVariant, isVariant, isVisitorId, type Variant } from '@/lib/experiment'

// Lectura de la asignación en el servidor. La escribe proxy.ts; acá solo se lee.

export function isSecureRequest(h: Pick<Headers, 'get'>, protocol?: string): boolean {
  if (protocol === 'https:') return true
  if (h.get('x-forwarded-proto')?.split(',')[0].trim() === 'https') return true
  return h.get('origin')?.startsWith('https://') ?? false
}

// Variante asignada a esta request, o null si no hay (crawler, preview, sin cookies).
// Primero el header que puso el proxy (existe ya en el primer response); si no, la cookie.
export async function readAssignedVariant(): Promise<Variant | null> {
  const fromProxy = (await headers()).get(HEADER.variant)
  if (isVariant(fromProxy)) return fromProxy
  const jar = await cookies()
  const visitor = jar.get(COOKIE.visitor)?.value
  return isVisitorId(visitor) ? assignVariant(visitor) : null
}

// Visitante y variante para la acción de conversión. La variante se vuelve a derivar
// del id con el hash: una cookie de variante manipulada no cambia lo que se anota.
export async function readVisitor(): Promise<{ visitorId: string; variant: Variant } | null> {
  const visitor = (await cookies()).get(COOKIE.visitor)?.value
  if (!isVisitorId(visitor)) return null
  return { visitorId: visitor, variant: assignVariant(visitor) }
}
