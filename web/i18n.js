/* i18n.js — every user-facing string lives here. English is the source
   language; Russian, Ukrainian and Spanish are locales on top of it. The
   locale is picked from the browser, can be overridden with ?lang=uk and is
   remembered afterwards. Missing keys fall back to English. */
const I18N = (() => {

  const EN = {
    'app.name': 'Beer iSpindel',
    'app.description': 'Gravity, temperature and battery from an iSpindel while the beer ferments.',

    'ui.refresh': 'Refresh',
    'ui.settings': 'Settings',
    'ui.device': 'Device',
    'ui.language': 'Language',

    'status.loading': 'Loading…',
    'status.notConnected': 'Not connected',
    'status.noData': 'No data yet',
    'status.noConnection': 'No connection to the worker',
    'status.lastReading': 'Last reading {ago}',
    'status.stale': ' — the sensor has been quiet longer than usual',

    'notice.setApi': 'Set the worker address in <b>settings</b> to see readings.',
    'notice.noReadings': 'The server is running, but nothing has arrived with this token yet. See “How to set up the iSpindel” in the settings.',
    'notice.implausible': 'No plausible gravity in this period: the iSpindel seems to be lying down or standing, not floating.',
    'notice.offline': 'No connection — showing data saved {ago}.',

    'err.workerStatus': 'The worker answered {status}.',
    'err.fetch': 'Could not fetch the data: {message}',
    'err.formulaChars': 'A formula may only contain numbers, tilt and + − * / ^ ( )',
    'err.formulaProbe': 'The formula does not evaluate at tilt = 25',
    'err.formulaFallback': ' The gravity from the iSpindel is used for now.',

    'hero.noGravity': 'No plausible gravity',
    'state.notFloating': 'Lower the iSpindel into the wort — gravity appears once it floats.',
    'state.tooSoon': 'Less than a day of data — the fermentation rate appears later.',
    'state.fermenting': '<b>Fermentation is running.</b> Gravity fell by {delta} °P over the last day.',
    'state.stalled': '<b>Fermentation has gone quiet.</b> The change over the last day is {delta} °P. If it holds for 2–3 days, the beer has most likely finished.',

    'batch.og': 'Original',
    'batch.attenuation': 'Attenuation',
    'batch.abv': 'Alcohol',
    'batch.running': 'The batch has been running {days} days since {date}. Alcohol is a hydrometer estimate.',
    'batch.waiting': 'Batch from {date}: the original gravity appears after the first readings in the wort.',
    'batch.none': 'Mark the start of a batch to see original gravity, attenuation and alcohol.',
    'batch.startNow': 'Start a batch now',
    'stem.og': 'OG',

    'device.temperature': 'Temperature',
    'device.battery': 'Battery',
    'device.tilt': 'Tilt',
    'device.wifi': 'Wi-Fi',
    'device.interval': 'Interval',

    'wifi.excellent': 'excellent',
    'wifi.good': 'good',
    'wifi.weak': 'weak',
    'wifi.veryWeak': 'very weak',

    'unit.volt': 'V',
    'unit.min': 'min',

    'time.justNow': 'just now',
    'time.minAgo': '{m} min ago',
    'time.hourMinAgo': '{h} h {m} min ago',

    'charts.history': 'History',
    'charts.period': 'Period',
    'charts.gravity': 'Gravity, °P',
    'charts.temperature': 'Temperature',
    'charts.smooth': 'smooth',
    'charts.raw': 'raw',
    'range.6h': '6 h',
    'range.24h': '24 h',
    'range.3d': '3 days',
    'range.7d': '7 days',
    'range.batch': 'Batch',

    'settings.title': 'Settings',
    'settings.apiPlaceholder': 'https://ispindel.name.workers.dev',
    'settings.batchStart': 'Batch start',
    'settings.now': 'Now',
    'settings.formula': 'Custom gravity formula',
    'settings.formulaHint': 'Empty — the gravity computed by the iSpindel itself is used. If filled in, gravity is recomputed from the tilt for the whole history.',
    'ui.copy': 'Copy',
    'ui.copied': 'Copied',
    'notice.setToken': 'Choose a device token in the <b>settings</b> — the app and your iSpindel both use it.',
    'err.unknownToken': 'The server does not know this token — open the settings and save it again.',
    'err.tokenShort': 'The token must be at least {n} characters.',
    'err.tokenLong': 'The token must be at most {n} characters.',
    'err.tokenChars': 'Use letters, digits and symbols — no spaces, quotes or backslashes.',
    'err.register': 'Could not save the token on the server: {message}',
    'err.badUrl': 'Enter a full address starting with https://',
    'settings.token': 'Device token',
    'settings.tokenHint': 'Enter the same token in the Token field of your iSpindel. Each token is a separate space: you see only the devices that send with it.',
    'settings.show': 'Show',
    'settings.hide': 'Hide',
    'settings.generate': 'Generate',
    'settings.server': 'Server',
    'settings.serverDefault': '(default)',
    'settings.serverCustom': 'Use another server',
    'settings.serverAddress': 'Server address',
    'settings.serverReset': 'Reset to default',
    'guide.title': 'How to set up the iSpindel',
    'guide.step1': 'Put the iSpindel into configuration mode: press reset twice within a couple of seconds. It opens a Wi-Fi network named “iSpindel”.',
    'guide.step2': 'Connect your phone to that network — the setup page opens by itself (otherwise open 192.168.4.1). Choose your Wi-Fi and enter its password.',
    'guide.step3': 'In the same form, fill in:',
    'guide.serviceType': 'Service Type',
    'guide.serverUrl': 'Server URL',
    'guide.token': 'Token',
    'guide.interval': 'Interval',
    'guide.intervalValue': '900 (60 while testing)',
    'guide.tokenUnset': 'set a token above',
    'guide.step4': 'Use a gravity polynomial that returns degrees Plato (°P) — the app works in °P. If the iSpindel sends SG (≈1.050), put a °P formula into “Custom gravity formula” instead.',
    'guide.step5': 'Press Save. The iSpindel restarts and sends its first reading within a minute.',
    'guide.fallback': 'If nothing arrives over HTTPS, choose Service Type HTTP: Server Address {host}, Port 80, Path /ingest and the same Token.',
    'settings.cancel': 'Cancel',
    'settings.save': 'Save'
  };

  const RU = {
    'app.name': 'Брожение',
    'app.description': 'Плотность, температура и заряд iSpindel во время брожения.',

    'ui.refresh': 'Обновить',
    'ui.settings': 'Настройки',
    'ui.device': 'Устройство',
    'ui.language': 'Язык',

    'status.loading': 'Загрузка…',
    'status.notConnected': 'Не подключено',
    'status.noData': 'Данных пока нет',
    'status.noConnection': 'Нет связи с воркером',
    'status.lastReading': 'Последнее показание {ago}',
    'status.stale': ' — датчик молчит дольше обычного',

    'notice.setApi': 'Укажи адрес воркера в <b>настройках</b>, чтобы увидеть показания.',
    'notice.noReadings': 'Сервер работает, но с этим токеном ещё ничего не приходило. Смотри «Как настроить iSpindel» в настройках.',
    'notice.implausible': 'За этот период нет правдоподобной плотности: похоже, iSpindel лежит или стоит, а не плавает в жидкости.',
    'notice.offline': 'Нет связи — показаны данные, сохранённые {ago}.',

    'err.workerStatus': 'Воркер ответил {status}.',
    'err.fetch': 'Не удалось получить данные: {message}',
    'err.formulaChars': 'В формуле допустимы только числа, tilt и + − * / ^ ( )',
    'err.formulaProbe': 'Формула не считается при tilt = 25',
    'err.formulaFallback': ' Пока используется плотность из iSpindel.',

    'hero.noGravity': 'Нет правдоподобной плотности',
    'state.notFloating': 'Опусти iSpindel в сусло — плотность появится, когда он будет плавать.',
    'state.tooSoon': 'Данных меньше суток — скорость брожения появится позже.',
    'state.fermenting': '<b>Брожение идёт.</b> За сутки плотность упала на {delta} °P.',
    'state.stalled': '<b>Брожение затихло.</b> За сутки изменение {delta} °P. Если так держится 2–3 дня, пиво, скорее всего, добродило.',

    'batch.og': 'Начальная',
    'batch.attenuation': 'Сброжено',
    'batch.abv': 'Алкоголь',
    'batch.running': 'Партия идёт {days} дн. с {date}. Алкоголь — оценка по ареометру.',
    'batch.waiting': 'Партия с {date}: начальная плотность появится после первых показаний в сусле.',
    'batch.none': 'Отметь начало партии, чтобы видеть начальную плотность, степень сбраживания и алкоголь.',
    'batch.startNow': 'Начать партию сейчас',
    'stem.og': 'НП',

    'device.temperature': 'Температура',
    'device.battery': 'Батарея',
    'device.tilt': 'Наклон',
    'device.wifi': 'Wi-Fi',
    'device.interval': 'Интервал',

    'wifi.excellent': 'отличный',
    'wifi.good': 'хороший',
    'wifi.weak': 'слабый',
    'wifi.veryWeak': 'очень слабый',

    'unit.volt': 'В',
    'unit.min': 'мин',

    'time.justNow': 'только что',
    'time.minAgo': '{m} мин назад',
    'time.hourMinAgo': '{h} ч {m} мин назад',

    'charts.history': 'История',
    'charts.period': 'Период',
    'charts.gravity': 'Плотность, °P',
    'charts.temperature': 'Температура',
    'charts.smooth': 'сглаживать',
    'charts.raw': 'сырые',
    'range.6h': '6 ч',
    'range.24h': '24 ч',
    'range.3d': '3 дня',
    'range.7d': '7 дней',
    'range.batch': 'Партия',

    'settings.title': 'Настройки',
    'settings.apiPlaceholder': 'https://ispindel.имя.workers.dev',
    'settings.batchStart': 'Начало партии',
    'settings.now': 'Сейчас',
    'settings.formula': 'Своя формула плотности',
    'settings.formulaHint': 'Пусто — берётся плотность, посчитанная самим iSpindel. Если заполнить, плотность пересчитается по наклону для всей истории.',
    'ui.copy': 'Копировать',
    'ui.copied': 'Скопировано',
    'notice.setToken': 'Задай токен устройства в <b>настройках</b> — его используют и приложение, и твой iSpindel.',
    'err.unknownToken': 'Сервер не знает этот токен — открой настройки и сохрани его ещё раз.',
    'err.tokenShort': 'Токен должен быть не короче {n} символов.',
    'err.tokenLong': 'Токен должен быть не длиннее {n} символов.',
    'err.tokenChars': 'Используй буквы, цифры и знаки — без пробелов, кавычек и обратной косой черты.',
    'err.register': 'Не удалось сохранить токен на сервере: {message}',
    'err.badUrl': 'Введи полный адрес, начиная с https://',
    'settings.token': 'Токен устройства',
    'settings.tokenHint': 'Тот же токен введи в поле Token в iSpindel. Каждый токен — отдельное пространство: видны только устройства, которые шлют с ним.',
    'settings.show': 'Показать',
    'settings.hide': 'Скрыть',
    'settings.generate': 'Создать',
    'settings.server': 'Сервер',
    'settings.serverDefault': '(по умолчанию)',
    'settings.serverCustom': 'Указать другой сервер',
    'settings.serverAddress': 'Адрес сервера',
    'settings.serverReset': 'Сбросить по умолчанию',
    'guide.title': 'Как настроить iSpindel',
    'guide.step1': 'Переведи iSpindel в режим настройки: дважды нажми reset в течение пары секунд. Он поднимет Wi-Fi-сеть «iSpindel».',
    'guide.step2': 'Подключи телефон к этой сети — страница настройки откроется сама (если нет, открой 192.168.4.1). Выбери свой Wi-Fi и введи пароль.',
    'guide.step3': 'В той же форме заполни:',
    'guide.serviceType': 'Service Type',
    'guide.serverUrl': 'Server URL',
    'guide.token': 'Token',
    'guide.interval': 'Interval',
    'guide.intervalValue': '900 (60 для проверки)',
    'guide.tokenUnset': 'задай токен выше',
    'guide.step4': 'Для плотности используй полином, который выдаёт градусы Плато (°P) — приложение считает в °P. Если iSpindel шлёт SG (≈1,050), впиши формулу в °P в поле «Своя формула плотности».',
    'guide.step5': 'Нажми Save. iSpindel перезагрузится и пришлёт первое показание в течение минуты.',
    'guide.fallback': 'Если по HTTPS ничего не приходит, выбери Service Type HTTP: Server Address {host}, Port 80, Path /ingest и тот же Token.',
    'settings.cancel': 'Отмена',
    'settings.save': 'Сохранить'
  };

  const UK = {
    'app.name': 'Бродіння',
    'app.description': 'Густина, температура та заряд iSpindel під час бродіння.',

    'ui.refresh': 'Оновити',
    'ui.settings': 'Налаштування',
    'ui.device': 'Пристрій',
    'ui.language': 'Мова',

    'status.loading': 'Завантаження…',
    'status.notConnected': 'Не підключено',
    'status.noData': 'Даних поки немає',
    'status.noConnection': 'Немає зв’язку з воркером',
    'status.lastReading': 'Останнє показання {ago}',
    'status.stale': ' — датчик мовчить довше, ніж зазвичай',

    'notice.setApi': 'Вкажи адресу воркера в <b>налаштуваннях</b>, щоб побачити показання.',
    'notice.noReadings': 'Сервер працює, але з цим токеном ще нічого не надходило. Дивись «Як налаштувати iSpindel» у налаштуваннях.',
    'notice.implausible': 'За цей період немає правдоподібної густини: схоже, iSpindel лежить або стоїть, а не плаває в рідині.',
    'notice.offline': 'Немає зв’язку — показано дані, збережені {ago}.',

    'err.workerStatus': 'Воркер відповів {status}.',
    'err.fetch': 'Не вдалося отримати дані: {message}',
    'err.formulaChars': 'У формулі дозволені лише числа, tilt і + − * / ^ ( )',
    'err.formulaProbe': 'Формула не обчислюється за tilt = 25',
    'err.formulaFallback': ' Поки використовується густина з iSpindel.',

    'hero.noGravity': 'Немає правдоподібної густини',
    'state.notFloating': 'Опусти iSpindel у сусло — густина з’явиться, коли він плаватиме.',
    'state.tooSoon': 'Даних менше ніж за добу — швидкість бродіння з’явиться пізніше.',
    'state.fermenting': '<b>Бродіння триває.</b> За добу густина впала на {delta} °P.',
    'state.stalled': '<b>Бродіння затихло.</b> За добу зміна {delta} °P. Якщо так триватиме 2–3 дні, пиво, найімовірніше, доброїло.',

    'batch.og': 'Початкова',
    'batch.attenuation': 'Зброджено',
    'batch.abv': 'Алкоголь',
    'batch.running': 'Партія триває {days} дн. з {date}. Алкоголь — оцінка за ареометром.',
    'batch.waiting': 'Партія з {date}: початкова густина з’явиться після перших показань у суслі.',
    'batch.none': 'Познач початок партії, щоб бачити початкову густину, ступінь зброджування та алкоголь.',
    'batch.startNow': 'Почати партію зараз',
    'stem.og': 'ПГ',

    'device.temperature': 'Температура',
    'device.battery': 'Батарея',
    'device.tilt': 'Нахил',
    'device.wifi': 'Wi-Fi',
    'device.interval': 'Інтервал',

    'wifi.excellent': 'відмінний',
    'wifi.good': 'добрий',
    'wifi.weak': 'слабкий',
    'wifi.veryWeak': 'дуже слабкий',

    'unit.volt': 'В',
    'unit.min': 'хв',

    'time.justNow': 'щойно',
    'time.minAgo': '{m} хв тому',
    'time.hourMinAgo': '{h} год {m} хв тому',

    'charts.history': 'Історія',
    'charts.period': 'Період',
    'charts.gravity': 'Густина, °P',
    'charts.temperature': 'Температура',
    'charts.smooth': 'згладжувати',
    'charts.raw': 'сирі',
    'range.6h': '6 год',
    'range.24h': '24 год',
    'range.3d': '3 дні',
    'range.7d': '7 днів',
    'range.batch': 'Партія',

    'settings.title': 'Налаштування',
    'settings.apiPlaceholder': 'https://ispindel.назва.workers.dev',
    'settings.batchStart': 'Початок партії',
    'settings.now': 'Зараз',
    'settings.formula': 'Власна формула густини',
    'settings.formulaHint': 'Порожньо — береться густина, порахована самим iSpindel. Якщо заповнити, густина перерахується за нахилом для всієї історії.',
    'ui.copy': 'Копіювати',
    'ui.copied': 'Скопійовано',
    'notice.setToken': 'Задай токен пристрою в <b>налаштуваннях</b> — його використовують і застосунок, і твій iSpindel.',
    'err.unknownToken': 'Сервер не знає цього токена — відкрий налаштування й збережи його ще раз.',
    'err.tokenShort': 'Токен має бути не коротшим за {n} символів.',
    'err.tokenLong': 'Токен має бути не довшим за {n} символів.',
    'err.tokenChars': 'Використовуй літери, цифри та знаки — без пробілів, лапок і зворотної косої риски.',
    'err.register': 'Не вдалося зберегти токен на сервері: {message}',
    'err.badUrl': 'Введи повну адресу, що починається з https://',
    'settings.token': 'Токен пристрою',
    'settings.tokenHint': 'Той самий токен введи в поле Token в iSpindel. Кожен токен — окремий простір: видно лише пристрої, які надсилають з ним.',
    'settings.show': 'Показати',
    'settings.hide': 'Сховати',
    'settings.generate': 'Створити',
    'settings.server': 'Сервер',
    'settings.serverDefault': '(за замовчуванням)',
    'settings.serverCustom': 'Вказати інший сервер',
    'settings.serverAddress': 'Адреса сервера',
    'settings.serverReset': 'Скинути за замовчуванням',
    'guide.title': 'Як налаштувати iSpindel',
    'guide.step1': 'Переведи iSpindel у режим налаштування: двічі натисни reset протягом кількох секунд. Він підніме Wi-Fi-мережу «iSpindel».',
    'guide.step2': 'Підключи телефон до цієї мережі — сторінка налаштування відкриється сама (якщо ні, відкрий 192.168.4.1). Вибери свій Wi-Fi і введи пароль.',
    'guide.step3': 'У тій самій формі заповни:',
    'guide.serviceType': 'Service Type',
    'guide.serverUrl': 'Server URL',
    'guide.token': 'Token',
    'guide.interval': 'Interval',
    'guide.intervalValue': '900 (60 для перевірки)',
    'guide.tokenUnset': 'задай токен вище',
    'guide.step4': 'Для густини використовуй поліном, що повертає градуси Плато (°P) — застосунок рахує в °P. Якщо iSpindel надсилає SG (≈1,050), впиши формулу в °P у поле «Власна формула густини».',
    'guide.step5': 'Натисни Save. iSpindel перезавантажиться й надішле перше показання протягом хвилини.',
    'guide.fallback': 'Якщо через HTTPS нічого не надходить, вибери Service Type HTTP: Server Address {host}, Port 80, Path /ingest і той самий Token.',
    'settings.cancel': 'Скасувати',
    'settings.save': 'Зберегти'
  };

  const ES = {
    'app.name': 'Fermentación',
    'app.description': 'Densidad, temperatura y batería del iSpindel durante la fermentación.',

    'ui.refresh': 'Actualizar',
    'ui.settings': 'Ajustes',
    'ui.device': 'Dispositivo',
    'ui.language': 'Idioma',

    'status.loading': 'Cargando…',
    'status.notConnected': 'Sin conectar',
    'status.noData': 'Todavía no hay datos',
    'status.noConnection': 'Sin conexión con el worker',
    'status.lastReading': 'Última lectura {ago}',
    'status.stale': ' — el sensor lleva callado más de lo normal',

    'notice.setApi': 'Indica la dirección del worker en los <b>ajustes</b> para ver las lecturas.',
    'notice.noReadings': 'El servidor funciona, pero todavía no ha llegado nada con este token. Consulta «Cómo configurar el iSpindel» en los ajustes.',
    'notice.implausible': 'No hay densidad plausible en este periodo: parece que el iSpindel está tumbado o de pie, no flotando.',
    'notice.offline': 'Sin conexión — se muestran los datos guardados {ago}.',

    'err.workerStatus': 'El worker respondió {status}.',
    'err.fetch': 'No se han podido obtener los datos: {message}',
    'err.formulaChars': 'Una fórmula solo admite números, tilt y + − * / ^ ( )',
    'err.formulaProbe': 'La fórmula no se calcula con tilt = 25',
    'err.formulaFallback': ' De momento se usa la densidad del iSpindel.',

    'hero.noGravity': 'Sin densidad plausible',
    'state.notFloating': 'Mete el iSpindel en el mosto — la densidad aparece cuando flote.',
    'state.tooSoon': 'Menos de un día de datos — la velocidad de fermentación aparecerá más tarde.',
    'state.fermenting': '<b>La fermentación avanza.</b> La densidad ha bajado {delta} °P en el último día.',
    'state.stalled': '<b>La fermentación se ha parado.</b> El cambio del último día es de {delta} °P. Si sigue así 2–3 días, la cerveza seguramente ha terminado.',

    'batch.og': 'Inicial',
    'batch.attenuation': 'Atenuación',
    'batch.abv': 'Alcohol',
    'batch.running': 'El lote lleva {days} días desde {date}. El alcohol es una estimación del densímetro.',
    'batch.waiting': 'Lote desde {date}: la densidad inicial aparecerá tras las primeras lecturas en el mosto.',
    'batch.none': 'Marca el inicio de un lote para ver densidad inicial, atenuación y alcohol.',
    'batch.startNow': 'Empezar un lote ahora',
    'stem.og': 'OG',

    'device.temperature': 'Temperatura',
    'device.battery': 'Batería',
    'device.tilt': 'Inclinación',
    'device.wifi': 'Wi-Fi',
    'device.interval': 'Intervalo',

    'wifi.excellent': 'excelente',
    'wifi.good': 'buena',
    'wifi.weak': 'débil',
    'wifi.veryWeak': 'muy débil',

    'unit.volt': 'V',
    'unit.min': 'min',

    'time.justNow': 'ahora mismo',
    'time.minAgo': 'hace {m} min',
    'time.hourMinAgo': 'hace {h} h {m} min',

    'charts.history': 'Historial',
    'charts.period': 'Periodo',
    'charts.gravity': 'Densidad, °P',
    'charts.temperature': 'Temperatura',
    'charts.smooth': 'suavizar',
    'charts.raw': 'brutos',
    'range.6h': '6 h',
    'range.24h': '24 h',
    'range.3d': '3 días',
    'range.7d': '7 días',
    'range.batch': 'Lote',

    'settings.title': 'Ajustes',
    'settings.apiPlaceholder': 'https://ispindel.nombre.workers.dev',
    'settings.batchStart': 'Inicio del lote',
    'settings.now': 'Ahora',
    'settings.formula': 'Fórmula de densidad propia',
    'settings.formulaHint': 'Vacío — se usa la densidad calculada por el propio iSpindel. Si se rellena, la densidad se recalcula a partir de la inclinación para todo el historial.',
    'ui.copy': 'Copiar',
    'ui.copied': 'Copiado',
    'notice.setToken': 'Elige un token de dispositivo en los <b>ajustes</b>: lo usan tanto la app como tu iSpindel.',
    'err.unknownToken': 'El servidor no conoce este token: abre los ajustes y guárdalo de nuevo.',
    'err.tokenShort': 'El token debe tener al menos {n} caracteres.',
    'err.tokenLong': 'El token debe tener como máximo {n} caracteres.',
    'err.tokenChars': 'Usa letras, cifras y símbolos, sin espacios, comillas ni barras invertidas.',
    'err.register': 'No se ha podido guardar el token en el servidor: {message}',
    'err.badUrl': 'Escribe una dirección completa que empiece por https://',
    'settings.token': 'Token del dispositivo',
    'settings.tokenHint': 'Escribe el mismo token en el campo Token del iSpindel. Cada token es un espacio aparte: solo ves los dispositivos que envían con él.',
    'settings.show': 'Mostrar',
    'settings.hide': 'Ocultar',
    'settings.generate': 'Generar',
    'settings.server': 'Servidor',
    'settings.serverDefault': '(predeterminado)',
    'settings.serverCustom': 'Usar otro servidor',
    'settings.serverAddress': 'Dirección del servidor',
    'settings.serverReset': 'Restablecer',
    'guide.title': 'Cómo configurar el iSpindel',
    'guide.step1': 'Pon el iSpindel en modo configuración: pulsa reset dos veces en un par de segundos. Abrirá una red Wi-Fi llamada «iSpindel».',
    'guide.step2': 'Conecta el móvil a esa red: la página de configuración se abre sola (si no, abre 192.168.4.1). Elige tu Wi-Fi y escribe la contraseña.',
    'guide.step3': 'En el mismo formulario, rellena:',
    'guide.serviceType': 'Service Type',
    'guide.serverUrl': 'Server URL',
    'guide.token': 'Token',
    'guide.interval': 'Interval',
    'guide.intervalValue': '900 (60 para probar)',
    'guide.tokenUnset': 'elige un token arriba',
    'guide.step4': 'Para la densidad, usa un polinomio que devuelva grados Plato (°P): la app trabaja en °P. Si el iSpindel envía SG (≈1,050), pon una fórmula en °P en «Fórmula de densidad propia».',
    'guide.step5': 'Pulsa Save. El iSpindel se reinicia y envía la primera lectura en menos de un minuto.',
    'guide.fallback': 'Si por HTTPS no llega nada, elige Service Type HTTP: Server Address {host}, Port 80, Path /ingest y el mismo Token.',
    'settings.cancel': 'Cancelar',
    'settings.save': 'Guardar'
  };

  const DICTS = { en: EN, ru: RU, uk: UK, es: ES };
  const order = ['en', 'ru', 'uk', 'es'];
  const NAMES = { en: 'English', ru: 'Русский', uk: 'Українська', es: 'Español' };
  /* Numbers and dates follow the chosen language, not the browser. */
  const LOCALES = { en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA', es: 'es-ES' };
  const STORE = 'ispindel.lang';

  let current = 'en';

  function detect() {
    const q = /[?&]lang=([a-z]{2})/.exec(location.search);
    if (q && DICTS[q[1]]) return q[1];
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch { /* private mode */ }
    if (saved && DICTS[saved]) return saved;
    const nav = (navigator.language || 'en').toLowerCase();
    for (const code of order) {
      if (nav.indexOf(code) === 0) return code;
    }
    return 'en';
  }

  function use(lang, remember) {
    current = DICTS[lang] ? lang : 'en';
    if (remember) {
      try { localStorage.setItem(STORE, current); } catch { /* private mode */ }
    }
    return current;
  }

  function lang() { return current; }
  function locale() { return LOCALES[current] || 'en-GB'; }
  function name(code) { return NAMES[code] || code; }

  function t(key, params) {
    let s = DICTS[current][key];
    if (s === undefined) s = EN[key];
    if (s === undefined) return key;
    if (params) {
      for (const k of Object.keys(params)) {
        s = s.split('{' + k + '}').join(String(params[k]));
      }
    }
    return s;
  }

  return { t, use, lang, locale, name, detect, languages: order };
})();
