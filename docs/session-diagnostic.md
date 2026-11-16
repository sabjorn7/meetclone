# Диагностика зависшей сессии MeetGuru

Включение: https://app.meetgu.ru/all_course/?mg_loading_diag=1

Без параметра `mg_loading_diag=1` трасса, панель, Auth/fetch-обёртки и дополнительные router hooks выключены. SPA-переходы сохраняют включённую трассу. Полная загрузка документа без параметра выключает её.

## Три действия пользователя

1. Откройте диагностическую ссылку в браузере, где возникает проблема, и пользуйтесь сайтом.
2. При зависании не обновляйте страницу. Нажмите «Диагностика» справа внизу.
3. Нажмите «Скопировать» и пришлите текст. Если браузер запрещает Clipboard API, скопируйте выделенный текст обычным меню телефона.

Панель вне Vue, не зависит от основного контента, Supabase и доступности сети. Экспорт ручной: автоматической отправки нет.

## Содержимое трассы

Парные begin/end с длительностью для route-transition, page-unload, Auth, HTTP-заголовков, чтения тела, очереди /api и выполнения /api. В основных loaders 11 страниц: page-load, page-await, processing между await и loading-false.

[Карта точек ожидания](session-diagnostic-await-points.json): baselineLine относится к базовому исходнику 312ce95, а point — к номеру ожидания конкретного компонента. Поле sourceBaseline в экспорте не является SHA текущего деплоя.

Экспорт не содержит URL, query/hash, идентификаторов пользователей, email, UA, заголовков, session, ключей, текстов ошибок, содержимого запросов/ответов. Только фиксированные категории, типы ошибок, HTTP-статусы, номера, время UTC и монотонные длительности. Буфер ограничен 240 событиями и 64 активными spans; dropped показывает вытеснение. После перезагрузки данные теряются. Watchdog, повторов, отмены запросов и серверных изменений нет.

## Интерпретация

- route-transition + page-unload pending: новый маршрут ещё не установлен.
- auth/getSession pending без HTTP begin: ожидание SDK до fetch; lock/refresh/initialization уточнять по async stack.
- http pending: заголовки ещё не получены; body pending: чтение тела не закончено.
- api-queue pending: слот общего клиента не получен.
- page-await pending: конкретная строка карты ожиданий.
- processing end=error и page-load end с loading=true: исключение до снятия состояния загрузки.
- loading-false либо loading=false в pending page-load: этот loader уже снял основной индикатор; не приписывать ему любой фоновый pending.

Navigation — группировка по попытке перехода, не строгая связь конкурентных запросов. Существующие errorLogger/beacon/freezeGuard не заменены. Их DB-вставка может ждать тот же Supabase-клиент; поэтому локальный экспорт полезен при отсутствии DB-логов.

## Проверки

- node tests/session-diagnostic.unit.mjs — 11 изолированных тестов; Node 24 для stripTypeScriptTypes.
- node tests/session-diagnostic.browser.mjs — 3 браузерные проверки, включая offline/touch/clipboard fallback.
- npm run build; затем node tests/session-diagnostic.app.browser.mjs — полный dist с подменённым API, обычный/включённый режим и SPA-переход.
- node tests/auth-email-frontend.unit.mjs и node tests/auth-email.browser.mjs — email, обычный вход, autoconfirm и VK на синтетических данных.

Браузерные проверки используют установленный Chrome; пакеты не скачивают. app.browser в обычном режиме обслуживает локальный dist и подменяет API. Переменная MG_SMOKE_ORIGIN включает отдельную read-only smoke-проверку заданного production origin: все запросы кроме разрешённых GET перехватываются, реальные письма и записи не выполняются.

## Ограничения

При остановке всего JS-потока панель тоже не исполнится. Без предварительного включения нет ретроспективной трассы. XHR, потоковый getReader, клонированные Response и другие внешние origin не оборачиваются. Component-processing точки ограничены 11 основными страницами, остальные имеют общую route/Auth/HTTP-трассу. initializationPromise наблюдается для текущего SDK Supabase 2.50.3. Включённые обёртки добавляют microtasks, но не меняют аргументы, результаты, права доступа и правила Auth. Диагностика не исправляет зависание.
