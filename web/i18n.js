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
    'notice.noReadings': 'The worker is running, but the iSpindel has not sent anything yet. Check the service and the token in the iSpindel portal.',
    'notice.implausible': 'No plausible gravity in this period: the iSpindel seems to be lying down or standing, not floating.',
    'notice.offline': 'No connection — showing data saved {ago}.',

    'err.needKey': 'The worker wants a read key — set it in the settings.',
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
    'settings.api': 'Worker address',
    'settings.apiPlaceholder': 'https://ispindel.name.workers.dev',
    'settings.key': 'Read key',
    'settings.keyHint': 'Only needed if READ_TOKEN is set on the worker.',
    'settings.batchStart': 'Batch start',
    'settings.now': 'Now',
    'settings.formula': 'Custom gravity formula',
    'settings.formulaHint': 'Empty — the gravity computed by the iSpindel itself is used. If filled in, gravity is recomputed from the tilt for the whole history.',
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
    'notice.noReadings': 'Воркер работает, но iSpindel ещё ничего не прислал. Проверь сервис и токен в портале iSpindel.',
    'notice.implausible': 'За этот период нет правдоподобной плотности: похоже, iSpindel лежит или стоит, а не плавает в жидкости.',
    'notice.offline': 'Нет связи — показаны данные, сохранённые {ago}.',

    'err.needKey': 'Воркер просит ключ чтения — укажи его в настройках.',
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
    'settings.api': 'Адрес воркера',
    'settings.apiPlaceholder': 'https://ispindel.имя.workers.dev',
    'settings.key': 'Ключ чтения',
    'settings.keyHint': 'Нужен, только если на воркере задан READ_TOKEN.',
    'settings.batchStart': 'Начало партии',
    'settings.now': 'Сейчас',
    'settings.formula': 'Своя формула плотности',
    'settings.formulaHint': 'Пусто — берётся плотность, посчитанная самим iSpindel. Если заполнить, плотность пересчитается по наклону для всей истории.',
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
    'notice.noReadings': 'Воркер працює, але iSpindel ще нічого не надіслав. Перевір сервіс і токен у порталі iSpindel.',
    'notice.implausible': 'За цей період немає правдоподібної густини: схоже, iSpindel лежить або стоїть, а не плаває в рідині.',
    'notice.offline': 'Немає зв’язку — показано дані, збережені {ago}.',

    'err.needKey': 'Воркер просить ключ читання — вкажи його в налаштуваннях.',
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
    'settings.api': 'Адреса воркера',
    'settings.apiPlaceholder': 'https://ispindel.назва.workers.dev',
    'settings.key': 'Ключ читання',
    'settings.keyHint': 'Потрібен, лише якщо на воркері задано READ_TOKEN.',
    'settings.batchStart': 'Початок партії',
    'settings.now': 'Зараз',
    'settings.formula': 'Власна формула густини',
    'settings.formulaHint': 'Порожньо — береться густина, порахована самим iSpindel. Якщо заповнити, густина перерахується за нахилом для всієї історії.',
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
    'notice.noReadings': 'El worker funciona, pero el iSpindel aún no ha enviado nada. Revisa el servicio y el token en el portal del iSpindel.',
    'notice.implausible': 'No hay densidad plausible en este periodo: parece que el iSpindel está tumbado o de pie, no flotando.',
    'notice.offline': 'Sin conexión — se muestran los datos guardados {ago}.',

    'err.needKey': 'El worker pide una clave de lectura — indícala en los ajustes.',
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
    'settings.api': 'Dirección del worker',
    'settings.apiPlaceholder': 'https://ispindel.nombre.workers.dev',
    'settings.key': 'Clave de lectura',
    'settings.keyHint': 'Solo hace falta si el worker tiene READ_TOKEN.',
    'settings.batchStart': 'Inicio del lote',
    'settings.now': 'Ahora',
    'settings.formula': 'Fórmula de densidad propia',
    'settings.formulaHint': 'Vacío — se usa la densidad calculada por el propio iSpindel. Si se rellena, la densidad se recalcula a partir de la inclinación para todo el historial.',
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
