import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Landing } from '@/components/landing'
import {
  CANONICAL_PATH,
  COOKIE,
  DESCRIPTION_RANGE,
  TITLE_RANGE,
  VARIANTS,
  characterCount,
  inRange,
  isVariant,
  type Variant,
} from '@/lib/experiment'
import { readAssignedVariant } from '@/lib/visitor'

type PracticaPageProps = {
  searchParams: Promise<{ preview?: string | string[] }>
}
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// Variante de esta vista: ?preview= (instrumento) o la asignada (cookie + hash).
// Sin asignación (crawler sin cookie, o sin cookies) queda el control, A.
async function resolveView(searchParams: PracticaPageProps['searchParams']) {
  const requested = firstParam((await searchParams).preview)
  const preview = isVariant(requested) ? requested : null
  const assigned = preview ? null : await readAssignedVariant()
  const variant: Variant = preview ?? assigned ?? 'a'
  return { preview, assigned, variant }
}

// Title, description y canonical salen en el HTML del primer response (render de servidor).
export async function generateMetadata({ searchParams }: PracticaPageProps): Promise<Metadata> {
  const { preview, variant } = await resolveView(searchParams)
  const copy = VARIANTS[variant]
  return {
    // absolute: sin el sufijo '· Laboratorio 01' del layout.
    title: { absolute: copy.seoTitle },
    description: copy.seoDescription,
    // Un solo canonical, siempre /practica, sin query ni variante.
    alternates: { canonical: CANONICAL_PATH },
    robots: preview ? { index: false, follow: false } : { index: true, follow: true },
  }
}

export default async function PracticaPage({ searchParams }: PracticaPageProps) {
  const { preview, assigned, variant } = await resolveView(searchParams)
  const converted = !preview && (await cookies()).get(COOKIE.converted)?.value === '1'
  const copy = VARIANTS[variant]
  const titleLength = characterCount(copy.seoTitle)
  const descriptionLength = characterCount(copy.seoDescription)

  return (
    <main id="contenido" className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 md:py-14">
      <p className="border-b border-border pb-4 text-sm text-muted-foreground">
        {preview
          ? `Estás viendo el copy ${preview.toUpperCase()} por query. No cambia tu asignación, no cuenta como visita ni como conversión, y esta vista lleva noindex.`
          : assigned
            ? `Tu variante es ${assigned.toUpperCase()}. Queda guardada en una cookie: recargar no la cambia.`
            : 'Sin asignación (sin cookies o crawler): la landing muestra el control, A, en la misma URL.'}
      </p>
      <Landing variant={variant} preview={preview !== null} converted={converted} />
      <div className="flex flex-wrap gap-2">
        <Link href="/practica?preview=a" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Ver copy A
        </Link>
        <Link href="/practica?preview=b" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Ver copy B
        </Link>
        <Link href="/bitacora" className="rounded-md border border-border px-3 py-1.5 text-sm">
          Bitácora
        </Link>
      </div>
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl">Metadatos publicados en el HTML de esta vista</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 border-b border-border pb-3">
            <dt className="font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
              Title de {variant.toUpperCase()}
            </dt>
            <dd>{copy.seoTitle}</dd>
            <dd className="font-mono text-sm text-muted-foreground">
              {titleLength} caracteres · {inRange(titleLength, TITLE_RANGE) ? 'dentro de 50–60' : 'fuera de rango'}
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-border pb-3">
            <dt className="font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
              Description de {variant.toUpperCase()}
            </dt>
            <dd>{copy.seoDescription}</dd>
            <dd className="font-mono text-sm text-muted-foreground">
              {descriptionLength} caracteres ·{' '}
              {inRange(descriptionLength, DESCRIPTION_RANGE) ? 'dentro de 140–160' : 'fuera de rango'}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
