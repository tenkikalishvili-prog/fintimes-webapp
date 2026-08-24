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

/** Инициализация: развернуть на весь экран, зафиксировать цвета под нашу тёмную тему. */
export function initTelegram(): void {
  try {
    WebApp.ready()
    WebApp.expand()
    WebApp.setHeaderColor('#141210')
    WebApp.setBackgroundColor('#141210')
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
