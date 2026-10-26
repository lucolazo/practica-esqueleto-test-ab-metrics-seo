import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getStore } from '@/lib/db'
import {
  COOKIE,
  HEADER,
  SESSION_WINDOW,
  THIRTY_DAYS,
  assignVariant,
  cookieOptions,
  isCrawler,
  isVariant,
  isVisitorId,
} from '@/lib/experiment'
import { isSecureRequest } from '@/lib/visitor'

function isPrefetch(request: NextRequest): boolean {
  const purpose = `${request.headers.get('purpose') ?? ''} ${request.headers.get('sec-purpose') ?? ''}`
  return request.headers.has('next-router-prefetch') || /prefetch/i.test(purpose)
}

export async function proxy(request: NextRequest) {
  // Solo una carga de página cuenta. Los POST (la acción del CTA), HEAD y prefetch no.
  if (request.method !== 'GET') return NextResponse.next()

  // Nunca se confía en un header de variante que venga del cliente.
  const forwarded = new Headers(request.headers)
  forwarded.delete(HEADER.variant)
  const passThrough = () => NextResponse.next({ request: { headers: forwarded } })

  // ?preview=a|b: instrumento para ver las dos piezas. Sin cookies, sin visita, noindex.
  if (isVariant(request.nextUrl.searchParams.get('preview'))) {
    const response = passThrough()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }

  if (isPrefetch(request)) return passThrough()

  const cookieId = request.cookies.get(COOKIE.visitor)?.value
  const returning = isVisitorId(cookieId)

  // Un crawler sin cookie no participa: recibe el control (A) en la misma URL y con el
  // mismo canonical, y no se anota ni visitante ni impresión. Eso no es cloaking.
  if (!returning && isCrawler(request.headers.get('user-agent'))) return passThrough()

  const visitorId = isVisitorId(cookieId) ? cookieId : crypto.randomUUID()
  const variant = assignVariant(visitorId)
  forwarded.set(HEADER.variant, variant)

  const secure = isSecureRequest(request.headers, request.nextUrl.protocol)
  const response = passThrough()

  // Visitante y variante: cookie httpOnly, path '/', 30 días. Solo se escriben si faltan.
  if (!returning) response.cookies.set(COOKIE.visitor, visitorId, cookieOptions(secure, THIRTY_DAYS))
  if (request.cookies.get(COOKIE.variant)?.value !== variant) {
    response.cookies.set(COOKIE.variant, variant, cookieOptions(secure, THIRTY_DAYS))
  }

  // Una impresión por sesión de 30 minutos: la cookie caduca a los 30 minutos de la
  // primera impresión y recargar no la renueva.
  if (!request.cookies.has(COOKIE.impressed)) {
    try {
      await getStore().recordImpression(visitorId, variant)
      response.cookies.set(COOKIE.impressed, '1', cookieOptions(secure, SESSION_WINDOW))
    } catch (error) {
      // Si la base falla, la página sigue andando; no se marca la sesión como medida.
      console.error('No se pudo anotar la impresión', error)
    }
  }

  return response
}

export const config = {
  matcher: ['/practica'],
}
