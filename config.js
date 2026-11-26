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
 *    дополнительные дни leap.days; offset сдвигает фазу правила.
 *  • epoch — точка отсчёта: какой григорианской дате соответствует
 *    первый день первого месяца epoch.year.
 *
 * Всё остальное (сетка, навигация, конвертация, подсветка «сегодня»)
 * считается автоматически.
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

  // Каждый 4-й год длиннее на один день.
  leap: {
    every: 4,
    offset: 0,
    days: [{ name: "День баланса VI" }],
  },

  // 1 Пролетник 1 года = 20 марта 2000 (весеннее равноденствие).
  epoch: {
    year: 1,
    gregorian: "2000-03-20",
  },
};

/**
 * Английские названия. В PDF их не было, поэтому это транслитерация —
 * правьте свободно, структура календаря от этого не зависит.
 */
const EN = {
  world: "Uarza",
  weekdays: [
    "Kon",
    "Delnik",
    "Vtornik",
    "Tretnik",
    "Sereda",
    "Chetverg",
    "Pyatnitsa",
    "Shestnitsa",
    "Osmitza",
  ],
  months: [
    "Proletnik",
    "Traven",
    "Kresten",
    "Serpen",
    "Veresen",
    "Gruden",
    "Studen",
    "Lyuten",
  ],
  extraLabel: "Balance days",
  extraDays: [
    "Balance Day I",
    "Balance Day II",
    "Balance Day III",
    "Balance Day IV",
    "Balance Day V",
  ],
  leapDays: ["Balance Day VI"],
};

/** Конфиг календаря для выбранного языка. */
export function localizedConfig(lang) {
  if (lang !== "en") return CONFIG;

  return {
    ...CONFIG,
    world: EN.world,
    weekdays: EN.weekdays.slice(),
    months: CONFIG.months.map((month, index) => ({ ...month, name: EN.months[index] })),
    extra: {
      label: EN.extraLabel,
      days: CONFIG.extra.days.map((day, index) => ({ name: EN.extraDays[index] })),
    },
    leap: {
      ...CONFIG.leap,
      days: CONFIG.leap.days.map((day, index) => ({ name: EN.leapDays[index] })),
    },
  };
}
