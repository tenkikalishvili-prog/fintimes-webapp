// Управление темой оформления (S15): светлая / тёмная / системная.
// Предпочтение хранится локально (это чисто визуальная настройка устройства).
// «Системная» следует за темой Telegram (WebApp.colorScheme), а вне Telegram —
// за prefers-color-scheme браузера.
import { WebApp } from './telegram'

export type ThemePref = 'light' | 'dark' | 'system'
/** Фактически применённая (разрешённая) тема. */
export type Scheme = 'light' | 'dark'

const STORAGE_KEY = 'ft-theme'

/** Цвета шапки/фона Telegram под каждую тему (чуть теплее самого фона приложения).
 *  Тип `#${string}` — этого ждут setHeaderColor/setBackgroundColor из @twa-dev/sdk. */
const TG_CHROME: Record<Scheme, `#${string}`> = {
  dark: '#141210',
  light: '#f2f0f7',
}

/** Сохранённое предпочтение; по умолчанию — «системная». */
export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* приватный режим / заблокированный storage */
  }
  return 'system'
}

/** Тема окружения (Telegram, иначе браузер). */
function envScheme(): Scheme {
  try {
    const tg = WebApp?.colorScheme
    if (tg === 'light' || tg === 'dark') return tg
  } catch {
    /* вне Telegram */
  }
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
  } catch {
    /* нет matchMedia */
  }
  return 'dark'
}

/** Разрешить предпочтение в конкретную тему. */
export function resolveScheme(pref: ThemePref = getThemePref()): Scheme {
  return pref === 'system' ? envScheme() : pref
}

/** Применить тему к документу и подстроить хром Telegram. */
function applyScheme(scheme: Scheme): void {
  document.documentElement.setAttribute('data-theme', scheme)
  try {
    WebApp.setHeaderColor(TG_CHROME[scheme])
    WebApp.setBackgroundColor(TG_CHROME[scheme])
  } catch {
    /* вне Telegram — тихо игнорируем */
  }
}

/** Сохранить предпочтение и сразу применить. */
export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    /* storage недоступен — тема применится, но не запомнится */
  }
  applyScheme(resolveScheme(pref))
}

/**
 * Инициализация при старте: применить сохранённое предпочтение и подписаться
 * на смену темы Telegram (актуально только в режиме «системная»).
 */
export function initTheme(): void {
  applyScheme(resolveScheme())
  try {
    WebApp.onEvent('themeChanged', () => {
      if (getThemePref() === 'system') applyScheme(envScheme())
    })
  } catch {
    /* вне Telegram */
  }
}
