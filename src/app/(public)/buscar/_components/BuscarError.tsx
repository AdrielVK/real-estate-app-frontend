interface BuscarErrorProps {
  status: number | null;
  message: string;
}

/**
 * Inline error state for `/buscar` — keeps the filter bar
 * interactive so the user can retry without a full page reload.
 * A thrown error would propagate to the nearest `error.tsx`
 * boundary and unmount the bar.
 */
export function BuscarError({ status, message }: BuscarErrorProps) {
  return (
    <div
      data-testid="results-error"
      role="alert"
      className="flex flex-col items-start gap-3 rounded-3xl border border-border bg-card/60 px-6 py-8"
    >
      <p className="text-base font-semibold text-foreground">No pudimos cargar los resultados</p>
      <p className="text-sm text-muted-foreground">
        {status === null
          ? 'El servicio de búsqueda no está disponible en este momento. Verificá que el backend esté corriendo y que la variable API_BASE_URL esté configurada.'
          : `El backend respondió con un error (${status}). ${message}`}
      </p>
    </div>
  );
}
