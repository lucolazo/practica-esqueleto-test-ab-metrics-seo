import type { Metadata } from 'next'
import Link from 'next/link'
import { getStore } from '@/lib/db'
import {
  HASH_EXAMPLE_ID,
  HASH_NAME,
  TEST_CASE,
  VARIANTS,
  conversionRate,
  formatCount,
  formatPoints,
  formatRate,
  rateGap,
  assignVariant,
  emptyLog,
  type ExperimentLog,
  type Variant,
} from '@/lib/experiment'

// Los eventos viven en una base: se lee en cada request, no en el build.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bitácora',
  robots: { index: false, follow: false },
}

const ROWS: Variant[] = ['a', 'b']

async function loadLive(): Promise<{ log: ExperimentLog; label: string; error: string | null }> {
  try {
    const store = getStore()
    return { log: await store.readLog(), label: store.label, error: null }
  } catch (error) {
    console.error('No se pudo leer la base', error)
    return { log: emptyLog(), label: 'sin conexión', error: 'No se pudo leer la base de eventos.' }
  }
}

function RatesTable({ log, caption }: { log: ExperimentLog; caption: string }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="mb-3 text-left text-muted-foreground">{caption}</caption>
      <thead>
        <tr className="border-b border-border">
          <th className="py-2 font-medium">Variante</th>
          <th className="py-2 font-medium">Impresiones</th>
          <th className="py-2 font-medium">Conversiones</th>
          <th className="py-2 font-medium">Tasa</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((variant) => (
          <tr key={variant} className="border-b border-border">
            <td className="py-3">
              {variant.toUpperCase()} · {VARIANTS[variant].name}
            </td>
            <td className="py-3 font-mono">{formatCount(log[variant].impressions)}</td>
            <td className="py-3 font-mono">{formatCount(log[variant].conversions)}</td>
            <td className="py-3 font-mono">{formatRate(conversionRate(log[variant]))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default async function BitacoraPage() {
  const live = await loadLive()
  // Repetir el mismo id da siempre lo mismo: se muestra la prueba, no se afirma.
  const demo = [1, 2, 3].map(() => assignVariant(HASH_EXAMPLE_ID).toUpperCase())

  return (
    <main id="contenido" className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 md:py-14">
      <h1 className="max-w-2xl font-serif text-4xl tracking-tight text-balance md:text-5xl">
        Bitácora del experimento
      </h1>
      <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Tasa = conversiones / impresiones. Sin impresiones, la tasa no existe. Una diferencia entre tasas no es una prueba: acá no se declara ganador.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl">Caso de prueba fijo</h2>
        <RatesTable
          log={TEST_CASE}
          caption="Cohorte fija, no sale de ninguna sesión. Los porcentajes se calculan con la fórmula: 18 / 240 = 7,50% y 31 / 236 = 13,14%."
        />
        <p className="font-mono text-sm">
          B − A = {formatPoints(rateGap(TEST_CASE))}
          <span className="text-muted-foreground"> (13,14 − 7,50 en puntos porcentuales)</span>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl">Eventos reales</h2>
        {live.error ? <p className="text-sm font-medium text-foreground">{live.error}</p> : null}
        <RatesTable
          log={live.log}
          caption={`Leído de la base (${live.label}). Una impresión por sesión de 30 minutos; una conversión por visitante.`}
        />
        <p className="font-mono text-sm">B − A = {formatPoints(rateGap(live.log))}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl">Asignación estable</h2>
        <p className="text-sm text-muted-foreground">Función: {HASH_NAME}.</p>
        <p className="font-mono text-sm">
          assignVariant({`'${HASH_EXAMPLE_ID}'`}) → {demo.join(' · ')}
          <span className="text-muted-foreground"> (tres llamadas, mismo resultado: {new Set(demo).size === 1 ? 'sí' : 'no'})</span>
        </p>
      </section>

      <Link href="/practica" className="text-sm text-muted-foreground underline">
        Volver a la landing
      </Link>
    </main>
  )
}
