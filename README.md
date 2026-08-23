# Financial Times — Mini App (frontend)

React + Vite + TypeScript. Telegram Mini App для управления личными финансами.
Деплой — Vercel. Дизайн-система — `../UI-Kit.html` (токены и компоненты).

## Запуск (локально)

Node ставится через **nvm** (уже настроен в `~/.zshrc`). В новом терминале:

```bash
cd webapp
npm install     # только первый раз
npm run dev     # http://localhost:5173
```

- `npm run build` — прод-сборка (tsc + vite) в `dist/`
- `npm run preview` — предпросмотр собранного
- `npm run lint` — oxlint

## Структура

```
src/
  main.tsx            providers: QueryClient, Router, initTelegram()
  App.tsx             роуты (Layout + 4 таба, /add — модальный)
  types.ts            доменные типы (Article, Transaction, BudgetLine…)
  styles/
    tokens.css        дизайн-токены (:root) — из UI-Kit.html
    ui.css            база + классы компонентов (совпадают с UI-Kit)
  lib/
    telegram.ts       обёртка @twa-dev/sdk (работает и вне Telegram)
    api.ts            fetch-клиент, база из VITE_API_URL
    format.ts         money(), compact(), budgetStatus() — светофор
    mock.ts           временные данные (заменить на api.get)
  components/         Layout (оболочка+FAB), TabBar
  screens/           Home, Analytics, Budget, More, AddTransaction
```

## Конфиг

`.env` → `VITE_API_URL` — база HTTP-API backend (локально `http://localhost:8000`).
Данные тянутся через React Query (`src/lib/queries.ts`); нужен запущенный API (см. `../app`).

## Статус

Подключено к HTTP-API (React Query): Главная (обзor+топ трат), Аналитика (donut),
Бюджет (список + редактирование лимита), Ещё (история + удаление), двухшаговый ввод (создание).
Состояния загрузки/ошибки/пусто — есть. Проверено end-to-end локально.
**Дальше:** деплой API на Railway (web-сервис) + фронта на Vercel, регистрация Mini App в BotFather (нужен https).
