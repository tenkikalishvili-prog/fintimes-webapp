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

/** Верхний отступ под системную зону Telegram (статус-бар + плавающие кнопки ✕/⋯).
 *
 *  НЕ завязываемся на флаг `isFullscreen` — он рассинхронён из-за двух объектов
 *  WebApp (официальный скрипт vs бандл @twa-dev/sdk, который перетирает WebView).
 *  Берём сами инсеты: вне полного экрана они 0 (шапку рисует сам Telegram),
 *  в полном экране равны высоте статус-бара + ряда кнопок. Пишем inline-стилем,
 *  чтобы перебить любые правила из ui.css. */
function applyInsets(): void {
  try {
    const sa = (WebApp.safeAreaInset ?? {}) as { top?: number }
    const csa = (WebApp.contentSafeAreaInset ?? {}) as { top?: number }
    const top = Math.max(0, Number(sa.top) || 0) + Math.max(0, Number(csa.top) || 0)
    const root = document.documentElement
    root.style.setProperty('--ft-safe-top', `${top}px`)
    // Атрибут оставляем для прочих возможных стилей; на отступ он больше не влияет.
    root.toggleAttribute('data-tg-fullscreen', Boolean(WebApp.isFullscreen))
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

    // Верхний safe-area отступ: считаем из инсетов и обновляем по всем событиям,
    // которые их меняют (safe-area прилетает отдельным событием ПОСЛЕ fullscreen).
    applyInsets()
    WebApp.onEvent('fullscreenChanged', applyInsets)
    WebApp.onEvent('fullscreenFailed', applyInsets)
    WebApp.onEvent('safeAreaChanged', applyInsets)
    WebApp.onEvent('contentSafeAreaChanged', applyInsets)

    // Если хост схлопнул вьюпорт (возврат из свёрнутого состояния и т.п.) — снова
    // разворачиваем и пересчитываем отступ.
    WebApp.onEvent('viewportChanged', () => {
      try {
        if (!WebApp.isExpanded) WebApp.expand()
      } catch {
        /* no-op */
      }
      applyInsets()
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
