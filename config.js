/**
 * ОПИСАНИЕ КАЛЕНДАРЯ — единственный файл, который нужно править,
 * чтобы изменить мир.
 *
 * Правила:
 *  • weekdays — названия дней недели; их количество = длина недели.
 *  • weekends — номера выходных дней (с 1), например [1, 5, 9].
 *  • months — месяцы по порядку; days = сколько дней в месяце.
 *  • extra — дни вне месяцев в конце года (label — общее название).
 *  • leap — високосное правило: каждый leap.every-й год получает
 *    дополнительные дни leap.days; offset сдвигает фазу правила,
 *    exceptEvery исключает годы, кратные этому числу (правило 128 лет).
 *  • epoch — точка отсчёта: какой григорианской дате соответствует
 *    первый день первого месяца epoch.year.
 *
 * Нумерация годов — как в спецификации: год 2001 начинается
 * 20 марта 2000 и заканчивается 19 марта 2001.
 */

export const CONFIG = {
  world: "Уарза",

  // 9 дней в неделе.
  weekdays: [
    "Кон",
    "Дельник",
    "Вторник",
    "Третник",
    "Середа",
    "Четверг",
    "Пятница",
    "Шестница",
    "Осьмица",
  ],

  // Выходные: 1-й, 5-й и 9-й дни недели.
  weekends: [1, 5, 9],

  // 8 месяцев по 45 дней = 360 дней + 5 дней баланса.
  months: [
    { name: "Пролетник", days: 45 },
    { name: "Травень", days: 45 },
    { name: "Крестень", days: 45 },
    { name: "Серпень", days: 45 },
    { name: "Вересень", days: 45 },
    { name: "Грудень", days: 45 },
    { name: "Студень", days: 45 },
    { name: "Лютень", days: 45 },
  ],

  // Дни между годами — они не принадлежат ни одному месяцу.
  extra: {
    label: "Дни баланса",
    days: [
      { name: "День баланса I" },
      { name: "День баланса II" },
      { name: "День баланса III" },
      { name: "День баланса IV" },
      { name: "День баланса V" },
    ],
  },

  // Каждый 4-й год длиннее на один день, кроме кратных 128.
  leap: {
    every: 4,
    offset: 0,
    exceptEvery: 128,
    days: [{ name: "День баланса VI" }],
  },

  // 1 Пролетник 2001 года = 20 марта 2000 (весеннее равноденствие).
  epoch: {
    year: 2001,
    gregorian: "2000-03-20",
  },
};

/* ── названия для трёх режимов ──────────────────────── */

const SLAVIC_WEEKDAYS = [
  "Кон",
  "Дельник",
  "Вторник",
  "Третник",
  "Середа",
  "Четверг",
  "Пятница",
  "Шестница",
  "Осьмица",
];

const EN_WEEKDAYS = [
  "Kon",
  "Delnik",
  "Vtornik",
  "Tretnik",
  "Sereda",
  "Chetverg",
  "Pyatnitsa",
  "Shestnitsa",
  "Osmitza",
];

const NAMES = {
  // Русские метрические названия из спецификации.
  ru: {
    world: "Уарза",
    weekdays: SLAVIC_WEEKDAYS,
    months: ["Унар", "Бинар", "Тернар", "Квартер", "Квинтер", "Секстер", "Септер", "Октар"],
    extraLabel: "Дни баланса",
    extraDays: [
      "День баланса I",
      "День баланса II",
      "День баланса III",
      "День баланса IV",
      "День баланса V",
    ],
    leapDays: ["День баланса VI"],
  },

  // Международные коды.
  en: {
    world: "Uarzian Calendar",
    weekdays: EN_WEEKDAYS,
    months: ["Unar", "Binar", "Ternar", "Quarter", "Quinter", "Sexter", "Septer", "Octar"],
    extraLabel: "Balance days",
    extraDays: [
      "Balance Day I",
      "Balance Day II",
      "Balance Day III",
      "Balance Day IV",
      "Balance Day V",
    ],
    leapDays: ["Balance Day VI"],
  },

  // Славянский ряд.
  slav: {
    world: "Уарза",
    weekdays: SLAVIC_WEEKDAYS,
    months: ["Пролетник", "Травень", "Крестень", "Серпень", "Вересень", "Грудень", "Студень", "Лютень"],
    extraLabel: "Дни баланса",
    extraDays: [
      "День баланса I",
      "День баланса II",
      "День баланса III",
      "День баланса IV",
      "День баланса V",
    ],
    leapDays: ["День баланса VI"],
  },
};

/** Конфиг календаря для выбранного ряда названий и правила 128 лет. */
export function localizedConfig(mode, use128 = true) {
  const names = NAMES[mode] ?? NAMES.ru;
  const leap = { ...CONFIG.leap };

  if (!use128) delete leap.exceptEvery;

  return {
    ...CONFIG,
    world: names.world,
    weekdays: names.weekdays.slice(),
    months: CONFIG.months.map((month, index) => ({ ...month, name: names.months[index] })),
    extra: {
      label: names.extraLabel,
      days: names.extraDays.map((name) => ({ name })),
    },
    leap: {
      ...leap,
      days: names.leapDays.map((name) => ({ name })),
    },
  };
}
