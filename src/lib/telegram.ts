// Тонкая обёртка над Telegram WebApp SDK.
// Работает и вне Telegram (обычный браузер при dev) — все вызовы защищены try/catch.
import WebApp from '@twa-dev/sdk'

/** Официальный объект Telegram (из telegram-web-app.js), если доступен. */
function tgWebApp(): { initData?: string; initDataUnsafe?: { user?: { id?: number; first_name?: string } } } | undefined {
  try {
    const w = window as unknown as { Telegram?: { WebApp?: ReturnType<typeof tgWebApp> } }
    return w.Telegram?.WebApp
  } catch {
    return undefined
  }
}

/** true, если запущено внутри Telegram (есть initData). */
export const isTelegram = Boolean(tgWebApp()?.initData || WebApp?.initData)

/** Проставляет `html[data-tg-fullscreen]` по факту полноэкранного режима —
 *  CSS по этому атрибуту добавляет верхний safe-area отступ (под чёлку/шапку Telegram). */
function syncFullscreenAttr(): void {
  try {
    document.documentElement.toggleAttribute('data-tg-fullscreen', Boolean(WebApp.isFullscreen))
  } catch {
    /* no-op */
  }
}

/** Запрашивает полный экран, если клиент это умеет (Bot API 8.0+). Идемпотентно. */
function tryFullscreen(): void {
  try {
    if (
      WebApp.isVersionAtLeast('8.0') &&
      typeof WebApp.requestFullscreen === 'function' &&
      !WebApp.isFullscreen
    ) {
      WebApp.requestFullscreen()
    }
  } catch {
    /* fullscreenFailed (планшет/десктоп/уже полноэкранно) — тихо остаёмся на expand() */
  }
}

/** Инициализация: разворот + отключение свайпа-сворачивания + полный экран (BL-07).
 *  Цвета шапки/фона задаёт lib/theme. */
export function initTelegram(): void {
  try {
    WebApp.ready()
    WebApp.expand() // базовый разворот и фолбэк для клиентов < Bot API 8.0

    // Свайп вниз больше НЕ сворачивает/не закрывает приложение (Bot API 7.7+).
    // Это отдельный от полноэкранного режима механизм и покрывает больше клиентов.
    try {
      if (WebApp.isVersionAtLeast('7.7') && typeof WebApp.disableVerticalSwipes === 'function') {
        WebApp.disableVerticalSwipes()
      }
    } catch {
      /* не поддерживается — игнорируем */
    }

    // Полноэкранный режим (Bot API 8.0+): приложение занимает весь экран (edge-to-edge).
    // Зовём сразу и повторяем на следующем тике — ранний вызов при инициализации клиент
    // иногда отбрасывает.
    tryFullscreen()
    setTimeout(tryFullscreen, 0)

    syncFullscreenAttr()
    WebApp.onEvent('fullscreenChanged', syncFullscreenAttr)
    WebApp.onEvent('fullscreenFailed', syncFullscreenAttr)

    // Если хост схлопнул вьюпорт (возврат из свёрнутого состояния и т.п.) — снова разворачиваем.
    WebApp.onEvent('viewportChanged', () => {
      try {
        if (!WebApp.isExpanded) WebApp.expand()
      } catch {
        /* no-op */
      }
    })
  } catch {
    // вне Telegram — тихо игнорируем
  }
}

/** Telegram user id — ключ мультипользовательности. null вне Telegram (dev). */
export function getUserId(): number | null {
  try {
    return tgWebApp()?.initDataUnsafe?.user?.id ?? WebApp.initDataUnsafe?.user?.id ?? null
  } catch {
    return null
  }
}

/** Имя пользователя для приветствия. */
export function getUserName(): string {
  try {
    return (
      tgWebApp()?.initDataUnsafe?.user?.first_name ??
      WebApp.initDataUnsafe?.user?.first_name ??
      'друг'
    )
  } catch {
    return 'друг'
  }
}

/** Тактильный отклик (если поддерживается). */
export function haptic(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    WebApp.HapticFeedback.impactOccurred(type)
  } catch {
    /* no-op */
  }
}

export { WebApp }
