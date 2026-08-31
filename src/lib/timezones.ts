// Курированный список часовых поясов для селектора настроек.
// Ориентирован на Россию и соседние страны (основная аудитория). IANA-значения
// валидируются на бэкенде через zoneinfo. Если пояс пользователя нет в списке —
// экран настроек добавит его отдельным пунктом, чтобы значение не потерялось.

export interface TzOption {
  value: string // IANA, напр. 'Europe/Moscow'
  label: string // человекочитаемо: город + смещение
}

export const TIMEZONES: TzOption[] = [
  // Россия (с запада на восток)
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва · Санкт-Петербург (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара · Ижевск (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск · Новосибирск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  // Соседи / СНГ
  { value: 'Europe/Kyiv', label: 'Киев (UTC+2)' },
  { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { value: 'Asia/Tbilisi', label: 'Тбилиси (UTC+4)' },
  { value: 'Asia/Yerevan', label: 'Ереван (UTC+4)' },
  { value: 'Asia/Baku', label: 'Баку (UTC+4)' },
  { value: 'Asia/Almaty', label: 'Алматы · Астана (UTC+5)' },
  { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
]

/** Человекочитаемая подпись пояса; для неизвестного — само значение. */
export function tzLabel(value: string): string {
  return TIMEZONES.find((t) => t.value === value)?.label ?? value
}
