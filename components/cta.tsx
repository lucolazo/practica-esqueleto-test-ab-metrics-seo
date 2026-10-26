'use client'

import { useState, useTransition } from 'react'
import { recordConversion, type ConversionResult } from '@/app/practica/actions'

const MESSAGES: Record<ConversionResult['status'] | 'idle' | 'preview' | 'already', string> = {
  idle: 'La conversión se anota solo acá. Cargar la página no cuenta.',
  preview: 'Vista previa: el botón no anota nada. La conversión solo cuenta en la variante asignada.',
  already: 'Tu conversión ya está anotada. Un segundo clic no suma otra.',
  recorded: 'Conversión anotada. Un segundo clic no suma otra.',
  duplicate: 'Ya tenías una conversión anotada. Este clic no suma otra.',
  'no-assignment': 'No hay una variante asignada (sin cookies): no se anota nada.',
  error: 'No se pudo anotar la conversión. Probá de nuevo.',
}

export function Cta({
  label,
  preview = false,
  converted = false,
}: {
  label: string
  preview?: boolean
  converted?: boolean
}) {
  const [result, setResult] = useState<ConversionResult['status'] | null>(null)
  const [pending, startTransition] = useTransition()

  const state = preview ? 'preview' : (result ?? (converted ? 'already' : 'idle'))

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          // En la vista previa el clic no llama a la acción: no puede contar.
          if (preview) return
          startTransition(async () => {
            const { status } = await recordConversion()
            setResult(status)
          })
        }}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {label}
      </button>
      <p className="max-w-md text-sm text-muted-foreground" aria-live="polite">
        {MESSAGES[state]}
      </p>
    </div>
  )
}
