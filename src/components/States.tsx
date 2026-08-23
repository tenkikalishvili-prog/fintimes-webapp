// Переиспользуемые состояния экранов: загрузка, ошибка, пусто.

export function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="block">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="txrow" key={i}>
          <div className="sk" style={{ width: 38, height: 38, borderRadius: 11 }} />
          <div className="tmid">
            <div className="sk sk-line" style={{ width: `${70 - i * 8}%` }} />
            <div className="sk sk-line" style={{ width: '40%', marginTop: 7 }} />
          </div>
          <div className="sk sk-line" style={{ width: 46 }} />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="block">
      <div className="empty">
        <div className="em">⚠️</div>
        <div className="et">Не удалось загрузить</div>
        <div className="es">Проверь, что API запущен на localhost:8000</div>
        {onRetry && (
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={onRetry}>
            Повторить
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="empty">
      <div className="em">{emoji}</div>
      <div className="et">{title}</div>
      {sub && <div className="es">{sub}</div>}
    </div>
  )
}
