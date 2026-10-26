'use server'

import { cookies, headers } from 'next/headers'
import { getStore } from '@/lib/db'
import { COOKIE, THIRTY_DAYS, cookieOptions } from '@/lib/experiment'
import { isSecureRequest, readVisitor } from '@/lib/visitor'

export type ConversionResult = {
  status: 'recorded' | 'duplicate' | 'no-assignment' | 'error'
}

// Se llama solo desde el clic del CTA (components/cta.tsx). Cargar la página no la invoca.
export async function recordConversion(): Promise<ConversionResult> {
  const visitor = await readVisitor()
  if (!visitor) return { status: 'no-assignment' }

  try {
    // La base garantiza una conversión por visitante: el segundo clic devuelve false.
    const recorded = await getStore().recordConversion(visitor.visitorId, visitor.variant)
    const secure = isSecureRequest(await headers())
    ;(await cookies()).set(COOKIE.converted, '1', cookieOptions(secure, THIRTY_DAYS))
    return { status: recorded ? 'recorded' : 'duplicate' }
  } catch (error) {
    console.error('No se pudo anotar la conversión', error)
    return { status: 'error' }
  }
}
