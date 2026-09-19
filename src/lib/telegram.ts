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

/** Статус иконки Mini App на рабочем столе (Bot API 8.0+).
 *  'added' — уже есть; 'missed' — можно добавить; 'unknown' — клиент не знает
 *  (тоже можно предложить); 'unsupported' — клиент/платформа не умеют. */
export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed'

/** Реальный объект Telegram (A), сохранённый inline-скриптом ДО того, как
 *  @twa-dev/sdk перезапишет window.Telegram.WebApp своим бандлом (B). У B версия
 *  иногда сваливается в дефолт → используем A как резерв для проверок/вызовов. */
function realTg(): {
  isVersionAtLeast?: (v: string) => boolean
  addToHomeScreen?: () => void
  platform?: string
} | undefined {
  try {
    return (window as unknown as { __ftTgReal?: ReturnType<typeof realTg> }).__ftTgReal
  } catch {
    return undefined
  }
}

/** Платформы Telegram, где иконки Mini App на рабочем столе НЕ поддерживаются
 *  (десктоп/веб). Значение платформы приходит в launch-параметрах и надёжно. */
const NON_HOME_PLATFORMS = new Set([
  'tdesktop',
  'macos',
  'weba',
  'webk',
  'web',
  'unigram',
])

/** Умеет ли клиент добавлять иконку на рабочий стол (Bot API 8.0+). Синхронно.
 *
 *  Гейт устойчив к «грабле двух объектов WebApp»: версия в бандле @twa-dev/sdk (B)
 *  и платформа берутся из одного источника launch-параметров и вместе «сваливаются»
 *  в дефолт (`6.0`/`unknown`), если бандл не поймал параметры — поэтому НЕ полагаемся
 *  только на версию B. Логика: вне Telegram (dev-браузер) — нет; если есть любой
 *  ПОЗИТИВНЫЙ признак 8.0+ (реальный объект A, флаг __ftHomeOK, версия любого из
 *  объектов) — да; иначе показываем ВЕЗДЕ, КРОМЕ заведомо десктоп/веб-платформ.
 *  Ошибаемся в сторону показа: кнопка при тапе всё равно падает на рабочий объект,
 *  а на десктопе платформа известна точно и блок скрыт. */
export function isHomeScreenSupported(): boolean {
  if (!isTelegram) return false
  if (typeof WebApp?.addToHomeScreen !== 'function') return false

  const platform = (() => {
    try {
      return String(realTg()?.platform ?? (WebApp as unknown as { platform?: string }).platform ?? '').toLowerCase()
    } catch {
      return ''
    }
  })()

  // Позитивные признаки поддержки «на экран Домой» (Bot API 8.0+).
  try {
    if ((window as unknown as { __ftHomeOK?: boolean }).__ftHomeOK) return true
  } catch {
    /* no-op */
  }
  try {
    if (WebApp.isVersionAtLeast('8.0')) return true
  } catch {
    /* пробуем ниже */
  }
  try {
    if (realTg()?.isVersionAtLeast?.('8.0')) return true
  } catch {
    /* no-op */
  }

  // Явно десктоп/веб — не поддерживается.
  if (platform && NON_HOME_PLATFORMS.has(platform)) return false

  // Мобильный или неизвестный клиент внутри Telegram: показываем. Версия в бандле
  // могла не считаться, но метод есть, а при тапе addToHomeScreen() падает на
  // реальный объект A. Ложный показ на редком старом клиенте безвреден (no-op).
  return true
}

/** Спрашивает у клиента, добавлена ли иконка на рабочий стол (BL-08).
 *  Резолвит 'unsupported' на клиентах < 8.0; 'unknown' — если метод есть, но хост
 *  не ответил за отведённое время (тогда кнопку всё равно показываем). */
export function checkHomeScreenStatus(): Promise<HomeScreenStatus> {
  return new Promise((resolve) => {
    if (!isHomeScreenSupported() || typeof WebApp.checkHomeScreenStatus !== 'function') {
      resolve('unsupported')
      return
    }
    let done = false
    const finish = (s: HomeScreenStatus) => {
      if (done) return
      done = true
      resolve(s)
    }
    // Хост иногда не отвечает на web_app_check_home_screen — не зависаем.
    const timer = setTimeout(() => finish('unknown'), 2500)
    try {
      WebApp.checkHomeScreenStatus((status) => {
        clearTimeout(timer)
        finish((status as HomeScreenStatus) || 'unknown')
      })
    } catch {
      clearTimeout(timer)
      finish('unknown')
    }
  })
}

/** Просит клиент добавить иконку Mini App на рабочий стол (BL-08).
 *  Показывает нативный диалог Telegram; результат приходит событием homeScreenAdded.
 *  Если вызов на объекте SDK (B) бросит из-за рассинхрона версии — пробуем реальный A. */
export function addToHomeScreen(): void {
  try {
    WebApp.addToHomeScreen()
    return
  } catch {
    /* падаем на резерв ниже */
  }
  try {
    realTg()?.addToHomeScreen?.()
  } catch {
    /* не поддерживается — тихо игнорируем */
  }
}

/** Подписка на успешное добавление иконки. Возвращает функцию отписки. */
export function onHomeScreenAdded(cb: () => void): () => void {
  try {
    WebApp.onEvent('homeScreenAdded', cb)
    return () => {
      try {
        WebApp.offEvent('homeScreenAdded', cb)
      } catch {
        /* no-op */
      }
    }
  } catch {
    return () => {}
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
