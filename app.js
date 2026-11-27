/**
 * Интерфейс календаря. Вся календарная математика — в engine.js,
 * описание календаря и переводы названий — в config.js.
 */

import { localizedConfig } from "./config.js";
import { createCalendar, civilToDayIndex, civilToISO, dayIndexToCivil, mod } from "./engine.js";

const DAY_MS = 86_400_000;

/* ── лунный слой ────────────────────────────────────── */

const SYNODIC_MONTH = 29.530588853;
// Новолуние 6 января 2000, 18:14 UTC.
const MOON_EPOCH = civilToDayIndex(2000, 1, 6) + (18 + 14 / 60) / 24;

function moonPhase(dayIndex) {
  const age = mod(dayIndex + 0.5 - MOON_EPOCH, SYNODIC_MONTH);
  const fraction = age / SYNODIC_MONTH;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const index = Math.round(fraction * 8) % 8;
  const isNew = age < 0.5 || age > SYNODIC_MONTH - 0.5;
  const isFull = Math.abs(age - SYNODIC_MONTH / 2) < 0.5;

  return { age, fraction, illumination, index, isNew, isFull };
}

const moonSvg = (index) =>
  `<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><use href="#moon-${index}"></use></svg>`;

// В книге 2027 год — это лист №13 из 19.
const MOON_CYCLE = 19;
const MOON_SHEET_ANCHOR_YEAR = 2027;
const MOON_SHEET_ANCHOR_INDEX = 13;

function moonSheet(year) {
  return mod(year - MOON_SHEET_ANCHOR_YEAR + MOON_SHEET_ANCHOR_INDEX - 1, MOON_CYCLE) + 1;
}

function moonPhaseName(dayIndex) {
  const phase = moonPhase(dayIndex);
  const names = t("moonPhases");
  return `${names[phase.index]} · ${Math.round(phase.illumination * 100)}%`;
}

/* ── солнечный слой ─────────────────────────────────── */

// Даты равноденствий и солнцестояний считаются по алгоритму Миуса
// (Astronomical Algorithms, гл. 27): сезонные точки — глобальные события,
// но их календарная дата зависит от часового пояса наблюдателя.
const DEG = Math.PI / 180;
const SEASON_KEYS = ["springEquinox", "summerSolstice", "autumnEquinox", "winterSolstice"];
const SEASON_VALUES = [0.5, 1, 0.5, 0];

const SEASON_POLY = [
  (Y) => 2451623.80984 + Y * (365242.37404 + Y * (0.05169 + Y * (-0.00411 - 0.00057 * Y))),
  (Y) => 2451716.56767 + Y * (365241.62603 + Y * (0.00325 + Y * (0.00888 - 0.0003 * Y))),
  (Y) => 2451810.21715 + Y * (365242.01767 + Y * (-0.11575 + Y * (0.00337 + Y * 0.00078))),
  (Y) => 2451900.05952 + Y * (365242.74049 + Y * (-0.06223 + Y * (-0.00823 + Y * 0.00032))),
];

const SEASON_TERMS = [
  [485, 324.96, 1934.136],
  [203, 337.23, 32964.467],
  [199, 342.08, 20.186],
  [182, 27.85, 445267.112],
  [156, 73.14, 45036.886],
  [136, 171.52, 22518.443],
  [77, 222.54, 65928.934],
  [74, 296.72, 3034.906],
  [70, 243.58, 9037.513],
  [58, 119.81, 33718.147],
  [52, 297.17, 150.678],
  [50, 21.02, 2281.226],
  [45, 247.54, 29929.562],
  [44, 325.15, 31555.956],
  [29, 60.93, 4443.417],
  [18, 155.12, 67555.328],
  [17, 288.79, 4562.452],
  [16, 198.04, 62894.029],
  [14, 199.76, 31436.921],
  [12, 95.39, 14577.848],
  [12, 287.11, 31931.756],
  [12, 320.81, 34777.259],
  [9, 227.73, 1222.114],
  [8, 15.45, 16859.074],
];

// Разница TT и UT в секундах (приближение NASA для 1986–2150).
function deltaTSeconds(year) {
  if (year >= 2005 && year < 2050) {
    const t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  if (year >= 1986 && year < 2005) {
    const t = year - 2000;
    return 63.86 + t * (0.3345 + t * (-0.060374 + t * (0.0017275 + t * (0.000651814 + t * 0.00002373599))));
  }
  if (year >= 2050 && year < 2150) {
    return -20 + 32 * ((year - 1820) / 100) ** 2 - 0.5628 * (2150 - year);
  }
  return -20 + 32 * ((year - 1820) / 100) ** 2;
}

function seasonDate(gregorianYear, index) {
  const Y = (gregorianYear - 2000) / 1000;
  const jde0 = SEASON_POLY[index](Y);
  const T = (jde0 - 2451545) / 36525;
  const W = (35999.373 * T - 2.47) * DEG;
  const dLambda = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);

  let S = 0;
  for (const [a, b, c] of SEASON_TERMS) S += a * Math.cos((b + c * T) * DEG);

  const jde = jde0 + (0.00001 * S) / dLambda;
  const ms = (jde - 2440587.5) * DAY_MS - deltaTSeconds(gregorianYear) * 1000;
  return new Date(ms);
}

const solarEventsCache = new Map();

function solarEvents(gregorianYear) {
  if (solarEventsCache.has(gregorianYear)) return solarEventsCache.get(gregorianYear);

  const events = SEASON_KEYS.map((key, index) => {
    const date = seasonDate(gregorianYear, index);
    return {
      key,
      value: SEASON_VALUES[index],
      dayIndex: civilToDayIndex(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    };
  });

  solarEventsCache.set(gregorianYear, events);
  return events;
}

const solarKeyCache = new Map();

function solarKeyMap(year) {
  if (solarKeyCache.has(year)) return solarKeyCache.get(year);

  const start = cal.yearStartDay(year);
  const end = cal.yearStartDay(year + 1) - 1;
  const map = new Map();
  const firstYear = dayIndexToCivil(start).year;
  const lastYear = dayIndexToCivil(end).year;

  for (let gregorianYear = firstYear; gregorianYear <= lastYear; gregorianYear += 1) {
    for (const event of solarEvents(gregorianYear)) {
      if (event.dayIndex >= start && event.dayIndex <= end) map.set(event.dayIndex, event);
    }
  }

  solarKeyCache.set(year, map);
  return map;
}

function solarDayLabel(dayIndex, event) {
  const percent = Math.round(daylightFraction(dayIndex) * 100);
  const name = event ? t(event.key) : "";
  return `${name ? `${name} · ` : ""}${t("daylight")} ${percent}%`;
}

function daylightFraction(dayIndex) {
  const gregorianYear = dayIndexToCivil(dayIndex).year;
  const points = [];

  for (let year = gregorianYear - 1; year <= gregorianYear + 1; year += 1) {
    for (const event of solarEvents(year)) {
      points.push({ day: event.dayIndex, value: event.value });
    }
  }

  points.sort((a, b) => a.day - b.day);

  let index = points.length - 2;
  for (let i = 0; i < points.length - 1; i += 1) {
    if (dayIndex >= points[i].day && dayIndex < points[i + 1].day) {
      index = i;
      break;
    }
  }

  const start = points[index];
  const end = points[index + 1];
  const span = end.day - start.day;
  if (span <= 0) return start.value;

  const t = (dayIndex - start.day) / span;
  const smooth = (1 - Math.cos(Math.PI * t)) / 2;

  return start.value + (end.value - start.value) * smooth;
}

function sunSvg(fraction) {
  const value = Math.min(1, Math.max(0, fraction));
  const c = 12;
  const r = 6.5;
  const angle = value * Math.PI * 2 - Math.PI / 2;
  const x = (c + r * Math.cos(angle)).toFixed(2);
  const y = (c + r * Math.sin(angle)).toFixed(2);
  const large = value > 0.5 ? 1 : 0;

  let fill = "";
  if (value >= 0.999) {
    fill = `<circle cx="${c}" cy="${c}" r="${r}" style="fill: var(--sun-fill, #f2d79b)"/>`;
  } else if (value > 0.001) {
    fill = `<path d="M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z" style="fill: var(--sun-fill, #f2d79b)"/>`;
  }

  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = (c + 8.2 * Math.cos(a)).toFixed(1);
    const y1 = (c + 8.2 * Math.sin(a)).toFixed(1);
    const x2 = (c + 10.4 * Math.cos(a)).toFixed(1);
    const y2 = (c + 10.4 * Math.sin(a)).toFixed(1);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");

  return `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g style="stroke: var(--sun-line, #8a6f33)" stroke-width="1" stroke-linecap="round">${rays}</g>
    <circle cx="${c}" cy="${c}" r="${r}" style="fill: var(--sun-base, rgba(8, 10, 16, 0.7))"/>
    ${fill}
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" style="stroke: var(--sun-line, #8a6f33)" stroke-width="1"/>
  </svg>`;
}

/* ── строки интерфейса ──────────────────────────────── */

const STRINGS = {
  ru: {
    appTitle: "Календарь Уарза",
    docTitle: "Календарь",
    today: "Сегодня",
    selected: "Выбрано",
    outsideWeek: "вне недели",
    backToToday: "вернуться к сегодня",
    viewYear: "Год",
    viewMonth: "Месяц",
    langLabel: "Язык",
    infoTitle: "О календаре",
    convTitle: "Конвертер",
    moonTitle: "Лунные фазы",
    sunTitle: "Долгота дня",
    moonSheet: "лист",
    themeToDark: "Тёмная тема",
    themeToLight: "Светлая тема",
    gregTitle: "Даты по григорианскому календарю",
    gregIcon: "Г",
    convIcon: "к",
    convLabel: "Григорианская дата",
    close: "Закрыть",
    prevYear: "Предыдущий год",
    nextYear: "Следующий год",
    prevMonth: "Предыдущий месяц",
    nextMonth: "Следующий месяц",
    monthPanelLabel: "Месяц",
    yearPanelLabel: "Год",
    betweenYears: "между годами",
    moonPhases: [
      "новолуние",
      "растущий серп",
      "первая четверть",
      "растущая Луна",
      "полнолуние",
      "убывающая Луна",
      "последняя четверть",
      "убывающий серп",
    ],
    daylight: "доля дня",
    springEquinox: "весеннее равноденствие",
    summerSolstice: "летнее солнцестояние",
    autumnEquinox: "осеннее равноденствие",
    winterSolstice: "зимнее солнцестояние",
    metaDescription:
      "Уарзианский календарь: 8 месяцев по 45 дней, 9-дневная неделя, выходные 1/5/9 и дни баланса. Григорианская дата рядом с каждой датой.",
  },
  en: {
    appTitle: "Uarzian Calendar",
    docTitle: "Calendar",
    today: "Today",
    selected: "Selected",
    outsideWeek: "outside the week",
    backToToday: "back to today",
    viewYear: "Year",
    viewMonth: "Month",
    langLabel: "Language",
    infoTitle: "About the calendar",
    convTitle: "Converter",
    moonTitle: "Moon phases",
    sunTitle: "Daylight",
    moonSheet: "sheet",
    themeToDark: "Dark theme",
    themeToLight: "Light theme",
    gregTitle: "Gregorian dates",
    gregIcon: "G",
    convIcon: "c",
    convLabel: "Gregorian date",
    close: "Close",
    prevYear: "Previous year",
    nextYear: "Next year",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    monthPanelLabel: "Month",
    yearPanelLabel: "Year",
    betweenYears: "between years",
    moonPhases: [
      "new moon",
      "waxing crescent",
      "first quarter",
      "waxing gibbous",
      "full moon",
      "waning gibbous",
      "last quarter",
      "waning crescent",
    ],
    daylight: "daylight",
    springEquinox: "spring equinox",
    summerSolstice: "summer solstice",
    autumnEquinox: "autumn equinox",
    winterSolstice: "winter solstice",
    metaDescription:
      "The Uarzian Calendar: 8 months of 45 days, a 9-day week, weekends 1/5/9 and balance days. Gregorian date next to every date.",
  },
};

const t = (key) => STRINGS[state.lang === "en" ? "en" : "ru"][key] ?? key;

/* ── настройки и состояние ──────────────────────────── */

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

function localToday() {
  const now = new Date();
  return civilToDayIndex(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const calendarCache = new Map();

function getCalendar(lang) {
  if (!calendarCache.has(lang)) {
    calendarCache.set(lang, createCalendar(localizedConfig(lang, true)));
  }
  return calendarCache.get(lang);
}

const storedLang = readStored("uarza.lang", "ru");
const storedLayer = readStored("uarza.layer", null);
const storedTheme = readStored("uarza.theme", "light");
const legacyGreg = readStored("uarza.greg", null);
const layers = ["greg", "moon", "sun", "none"];

const state = {
  lang: ["ru", "en", "slav"].includes(storedLang) ? storedLang : "ru",
  layer: layers.includes(storedLayer) ? storedLayer : legacyGreg === "0" ? "none" : "greg",
  theme: storedTheme === "dark" ? "dark" : "light",
  year: 1,
  period: 0,
  selected: 0,
  today: localToday(),
};

let cal = getCalendar(state.lang);
const EXTRA = cal.EXTRA_PERIOD;

let fmtLong;
let fmtRange;
let fmtRangeYear;
let fmtShort;

function buildFormatters() {
  const locale = state.lang === "en" ? "en-GB" : "ru-RU";  const make = (options) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options });

  fmtLong = make({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
  fmtRange = make({ day: "numeric", month: "long" });
  fmtRangeYear = make({ day: "numeric", month: "long", year: "numeric" });
  fmtShort = make({ day: "numeric", month: "short" });
}

/* ── форматирование ─────────────────────────────────── */

function plural(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function daysWord(n) {
  if (state.lang === "en") return `${n} ${n === 1 ? "day" : "days"}`;
  return `${n} ${plural(n, ["день", "дня", "дней"])}`;
}

const yearLabel = (year) => (state.lang === "en" ? `Year ${year}` : `${year}-й год`);

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);

const dateOf = (dayIndex) => new Date(dayIndex * DAY_MS);

function formatCustom(info) {
  const head = info.isExtra ? info.extraName : `${info.day} ${info.monthName}`;
  return `${head}, ${yearLabel(info.year)}`;
}

/* ── элементы ───────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const el = {
  appTitle: $("app-title"),
  heroKicker: $("hero-kicker"),
  heroDay: $("hero-day"),
  heroMonth: $("hero-month"),
  heroWeekday: $("hero-weekday"),
  heroGregorian: $("hero-gregorian"),
  backToday: $("back-today"),
  weekdays: $("weekdays"),
  days: $("days"),
  periodTitle: $("period-title"),
  periodNote: $("period-note"),
  yearTitle: $("year-title"),
  yearRange: $("year-range"),
  moonSheet: $("moon-sheet"),
  yearGrid: $("year-grid"),
  gregBtn: $("greg-btn"),
  moonBtn: $("moon-btn"),
  sunBtn: $("sun-btn"),
  themeBtn: $("theme-btn"),
  infoBtn: $("info-btn"),
  convBtn: $("conv-btn"),
  monthDialog: $("month-dialog"),
  balanceDialog: $("balance-dialog"),
  balanceTitle: $("balance-title"),
  balanceList: $("balance-list"),
  infoDialog: $("info-dialog"),
  convDialog: $("conv-dialog"),
  conv: $("conv"),
  convOut: $("conv-out"),
};

const weekdayInitials = () => cal.weekdays.map((name) => name.slice(0, 1).toUpperCase());

/* ── инициализация даты ─────────────────────────────── */

function syncTo(dayIndex) {
  const info = cal.fromDayIndex(dayIndex);
  state.year = info.year;
  state.period = info.isExtra ? EXTRA : info.monthIndex;
}

syncTo(state.today);
state.selected = state.today;

/* ── рендер: плашка «сегодня» ───────────────────────── */

function renderHero() {
  const info = cal.fromDayIndex(state.selected);
  const isToday = state.selected === state.today;

  el.heroKicker.textContent = t(isToday ? "today" : "selected");

  el.heroDay.textContent = info.isExtra ? String(info.extraIndex + 1) : String(info.day);

  const label = info.isExtra ? info.extraName : info.monthName;
  el.heroMonth.textContent = label;
  el.heroMonth.classList.toggle("is-long", label.length > 10);

  el.heroWeekday.textContent = info.isExtra ? t("outsideWeek") : info.weekdayName;
  el.heroWeekday.classList.toggle("is-off", info.isExtra);
  el.heroWeekday.classList.toggle("is-rest", !info.isExtra && info.isWeekend);
  el.heroGregorian.textContent = fmtLong.format(dateOf(info.dayIndex));
  el.backToday.textContent = t("backToToday");

  el.backToday.hidden = isToday;
}

/* ── рендер: месячная сетка ─────────────────────────── */

function renderWeekdays() {
  const initials = weekdayInitials();
  el.weekdays.innerHTML = cal.weekdays
    .map(
      (name, index) => `
      <div class="wd${cal.isWeekend(index) ? " is-rest" : ""}" title="${escapeHtml(name)}">
        <span class="wd-letter">${escapeHtml(initials[index])}</span>
        <span class="wd-name">${escapeHtml(name)}</span>
      </div>`,
    )
    .join("");
}

function cellTitle(info) {
  let title;
  if (info.isExtra) {
    title = `${info.extraName}, ${yearLabel(info.year)} · ${fmtLong.format(dateOf(info.dayIndex))}`;
  } else {
    title = `${info.day} ${info.monthName}, ${yearLabel(info.year)} · ${info.weekdayName} · ${fmtLong.format(
      dateOf(info.dayIndex),
    )}`;
  }

  if (state.layer === "moon") title += ` · ${moonPhaseName(info.dayIndex)}`;
  if (state.layer === "sun") {
    title += ` · ${solarDayLabel(info.dayIndex, solarKeyMap(info.year).get(info.dayIndex))}`;
  }

  return title;
}

function cellGlyph(dayIndex) {
  if (state.layer === "moon") {
    return `<span class="cell-glyph" aria-hidden="true">${moonSvg(
      moonPhase(dayIndex).index,
    )}</span>`;
  }
  if (state.layer === "sun") {
    return `<span class="cell-glyph" aria-hidden="true">${sunSvg(daylightFraction(dayIndex))}</span>`;
  }
  return "";
}

function renderMonth() {
  const { year, period } = state;
  const isBalance = period === EXTRA;
  const name = cal.periodName(period);
  el.periodTitle.textContent = `${name} · ${yearLabel(year)}`;

  renderWeekdays();
  el.weekdays.hidden = isBalance;
  el.days.classList.toggle("is-balance", isBalance);
  el.days.classList.toggle("has-glyph", state.layer === "moon" || state.layer === "sun");
  el.days.classList.toggle("show-moon", state.layer === "moon");
  el.days.classList.toggle("show-sun", state.layer === "sun");

  const start = cal.periodStart(year, period);
  const count = cal.periodLength(year, period);
  const blanks = isBalance ? 0 : cal.fromDayIndex(start).weekdayIndex;
  const solarKeys = solarKeyMap(year);

  const cells = [];
  for (let i = 0; i < blanks; i += 1) {
    cells.push('<div class="cell blank" aria-hidden="true"></div>');
  }

  for (let i = 0; i < count; i += 1) {
    const dayIndex = start + i;
    const info = cal.fromDayIndex(dayIndex);
    const classes = ["cell"];
    if (info.isExtra) classes.push("is-extra");
    if (info.isWeekend) classes.push("is-rest");
    const phase = moonPhase(dayIndex);
    if (phase.isNew) classes.push("is-newmoon");
    if (phase.isFull) classes.push("is-fullmoon");
    if (solarKeys.has(dayIndex)) classes.push("is-solar-key");
    if (dayIndex === state.today) classes.push("is-today");
    if (dayIndex === state.selected) classes.push("is-selected");

    const title = cellTitle(info);
    const number = info.isExtra ? escapeHtml(info.extraName) : info.day;
    const aria = dayIndex === state.today ? `aria-current="date"` : "";

    cells.push(`
      <button type="button" class="${classes.join(" ")}" data-day="${dayIndex}"
        data-greg="${escapeHtml(fmtShort.format(dateOf(dayIndex)))}"
        title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${aria}>
        <span class="cell-num">${number}</span>${cellGlyph(dayIndex)}
      </button>`);
  }

  el.days.innerHTML = cells.join("");

  const lastIndex = start + count - 1;
  const g1 = cal.gregorianOf(start);
  const g2 = cal.gregorianOf(lastIndex);
  const sameYear = g1.year === g2.year;
  const rangeText = sameYear
    ? `${fmtRange.format(dateOf(start))} — ${fmtRangeYear.format(dateOf(lastIndex))}`
    : `${fmtRangeYear.format(dateOf(start))} — ${fmtRangeYear.format(dateOf(lastIndex))}`;

  const showRange = state.layer === "greg";
  el.periodNote.textContent = isBalance
    ? `${daysWord(count)} ${t("betweenYears")}${showRange ? ` · ${rangeText}` : ""}`
    : `${daysWord(count)}${showRange ? ` · ${rangeText}` : ""}`;
}

/* ── рендер: год ────────────────────────────────────── */

function miniWeekdays() {
  const initials = weekdayInitials();
  return cal.weekdays
    .map(
      (name, index) =>
        `<span class="mini-wd${cal.isWeekend(index) ? " is-rest" : ""}" title="${escapeHtml(
          name,
        )}">${escapeHtml(initials[index])}</span>`,
    )
    .join("");
}

function miniMonthCard(year, monthIndex, solarKeys) {
  const month = cal.months[monthIndex];
  const start = cal.periodStart(year, monthIndex);
  const count = cal.periodLength(year, monthIndex);
  const blanks = cal.fromDayIndex(start).weekdayIndex;
  const todayInfo = cal.fromDayIndex(state.today);
  const isCurrent = todayInfo.year === year && todayInfo.monthIndex === monthIndex;

  const cells = [];
  for (let i = 0; i < blanks; i += 1) {
    cells.push('<span class="mini-cell blank" aria-hidden="true"></span>');
  }
  for (let i = 0; i < count; i += 1) {
    const dayIndex = start + i;
    const info = cal.fromDayIndex(dayIndex);
    const classes = ["mini-cell"];
    if (info.isWeekend) classes.push("is-rest");
    const phase = moonPhase(dayIndex);
    if (phase.isNew) classes.push("is-newmoon");
    if (phase.isFull) classes.push("is-fullmoon");
    if (solarKeys.has(dayIndex)) classes.push("is-solar-key");
    if (dayIndex === state.today) classes.push("is-today");
    if (dayIndex === state.selected) classes.push("is-selected");
    cells.push(
      `<button type="button" class="${classes.join(" ")}" data-day="${dayIndex}"
        data-greg="${escapeHtml(fmtShort.format(dateOf(dayIndex)))}"
        title="${escapeHtml(cellTitle(info))}" aria-label="${escapeHtml(cellTitle(info))}">${info.day}${cellGlyph(dayIndex)}</button>`,
    );
  }

  const span = `${fmtShort.format(dateOf(start))} — ${fmtShort.format(
    dateOf(start + count - 1),
  )}`;

  return `
    <article class="mini${isCurrent ? " is-current" : ""}">
      <button type="button" class="mini-title" data-month="${monthIndex}">
        <span class="mini-name">${escapeHtml(month.name)}</span>
        <span class="mini-range">${escapeHtml(span)}</span>
      </button>
      <div class="mini-weekdays">${miniWeekdays()}</div>
      <div class="mini-days">${cells.join("")}</div>
    </article>`;
}

function balanceStrip(year) {
  const entries = cal.extraEntriesFor(year);
  if (entries.length === 0) return "";

  const chips = entries
    .map((entry) => {
      const classes = entry.dayIndex === state.today ? "is-today" : "";
      const glyph =
        state.layer === "moon"
          ? moonSvg(moonPhase(entry.dayIndex).index)
          : state.layer === "sun"
            ? sunSvg(daylightFraction(entry.dayIndex))
            : "";
      const date =
        state.layer === "greg"
          ? `<span class="balance-chip-date">${escapeHtml(fmtShort.format(dateOf(entry.dayIndex)))}</span>`
          : "";
      return `<button type="button" class="${classes}" data-balance="1" data-balance-day="${entry.dayIndex}"
        title="${escapeHtml(cellTitle(cal.fromDayIndex(entry.dayIndex)))}"><span class="balance-chip-text"><span class="balance-chip-name">${escapeHtml(
          entry.name,
        )}</span>${date}</span>${glyph ? `<span class="balance-chip-glyph" aria-hidden="true">${glyph}</span>` : ""}</button>`;
    })
    .join("");

  const range = `${fmtShort.format(dateOf(entries[0].dayIndex))} — ${fmtShort.format(
    dateOf(entries.at(-1).dayIndex),
  )}`;
  const showRange = state.layer === "greg";

  return `
    <div class="balance-strip">
      <button type="button" class="balance-label" data-balance="1">${escapeHtml(
        cal.extraLabel,
      )}</button>
      <span class="balance-range">${daysWord(entries.length)}${
        showRange ? ` · ${escapeHtml(range)}` : ""
      }</span>
      <div class="balance-chips">${chips}</div>
    </div>`;
}

function renderBalance() {
  const year = state.year;
  const entries = cal.extraEntriesFor(year);

  el.balanceTitle.textContent = `${cal.extraLabel} · ${yearLabel(year)}`;
  el.balanceList.innerHTML = entries
    .map((entry) => {
      const info = cal.fromDayIndex(entry.dayIndex);
      const classes = ["balance-card"];
      if (entry.dayIndex === state.today) classes.push("is-today");
      if (entry.dayIndex === state.selected) classes.push("is-selected");

      let meta = "";
      if (state.layer === "greg") {
        meta = `<span class="balance-card-date">${escapeHtml(
          fmtLong.format(dateOf(entry.dayIndex)),
        )}</span>`;
      } else if (state.layer === "moon") {
        meta = `<span class="balance-card-meta" aria-hidden="true">${moonSvg(
          moonPhase(entry.dayIndex).index,
        )}<span>${escapeHtml(moonPhaseName(entry.dayIndex))}</span></span>`;
      } else if (state.layer === "sun") {
        meta = `<span class="balance-card-meta" aria-hidden="true">${sunSvg(
          daylightFraction(entry.dayIndex),
        )}<span>${escapeHtml(
          solarDayLabel(entry.dayIndex, solarKeyMap(year).get(entry.dayIndex)),
        )}</span></span>`;
      }

      const label = cellTitle(info);
      return `<button type="button" class="${classes.join(" ")}" data-balance-day="${
        entry.dayIndex
      }" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <span class="balance-card-name">${escapeHtml(entry.name)}</span>${meta}
      </button>`;
    })
    .join("");
}

function renderYear() {
  const { year } = state;
  el.yearTitle.textContent = yearLabel(year);

  const yearStart = cal.yearStartDay(year);
  const yearEnd = cal.yearStartDay(year + 1) - 1;
  el.yearRange.textContent = `${fmtRangeYear.format(dateOf(yearStart))} — ${fmtRangeYear.format(
    dateOf(yearEnd),
  )}`;

  el.moonSheet.hidden = state.layer !== "moon";
  if (state.layer === "moon") {
    el.moonSheet.textContent = `${t("moonSheet")} ${moonSheet(year)}/${MOON_CYCLE}`;
  }

  const solarKeys = solarKeyMap(year);
  const months = cal.months
    .map((_, monthIndex) => miniMonthCard(year, monthIndex, solarKeys))
    .join("");
  el.yearGrid.classList.toggle("show-greg", state.layer === "greg");
  el.yearGrid.classList.toggle("show-moon", state.layer === "moon");
  el.yearGrid.classList.toggle("show-sun", state.layer === "sun");
  el.yearGrid.innerHTML = `
    <div class="year-months">${months}</div>
    ${balanceStrip(year)}`;
}

/* ── общий рендер ───────────────────────────────────── */

function render() {
  renderHero();
  renderYear();
  if (el.monthDialog.open) renderMonth();
  if (el.balanceDialog.open) renderBalance();

  const todayInfo = cal.fromDayIndex(state.today);
  document.title = `${todayInfo.day} ${todayInfo.monthName} — ${t("docTitle")}`;
}

/* ── язык и настройки ───────────────────────────────── */

function applyStatic() {
  const uiLang = state.lang === "en" ? "en" : "ru";

  document.documentElement.lang = uiLang;
  document.documentElement.dataset.lang = uiLang;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const text = t(node.dataset.i18nTitle);
    node.title = text;
    node.setAttribute("aria-label", text);
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });

  document.querySelectorAll(".lang-switch button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === state.lang));
  });

  const themeLabel = t(state.theme === "light" ? "themeToDark" : "themeToLight");
  document.documentElement.dataset.theme = state.theme;
  el.themeBtn.title = themeLabel;
  el.themeBtn.setAttribute("aria-label", themeLabel);
  el.themeBtn.dataset.theme = state.theme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", state.theme === "light" ? "#f4efe4" : "#070910");
  }

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", t("metaDescription"));

  el.convBtn.dataset.icon = t("convIcon");
  el.gregBtn.dataset.icon = t("gregIcon");
  el.gregBtn.setAttribute("aria-pressed", String(state.layer === "greg"));
  el.moonBtn.setAttribute("aria-pressed", String(state.layer === "moon"));
  el.sunBtn.setAttribute("aria-pressed", String(state.layer === "sun"));
}

function setLang(lang) {
  if (!["ru", "en", "slav"].includes(lang)) return;

  state.lang = lang;
  cal = getCalendar(state.lang);
  buildFormatters();
  store("uarza.lang", lang);
  applyStatic();
  render();
  if (el.convDialog.open) updateConverter();
}

function setLayer(layer) {
  if (!layers.includes(layer)) return;

  state.layer = state.layer === layer ? "none" : layer;
  store("uarza.layer", state.layer);
  applyStatic();
  render();
}

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  store("uarza.theme", state.theme);
  applyStatic();
}

/* ── диалоги ────────────────────────────────────────── */

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

/* ── навигация ──────────────────────────────────────── */

function goPeriod(delta) {
  let { year, period } = state;
  if (period >= cal.monthCount || period < 0) period = 0;
  period += delta;
  if (period >= cal.monthCount) {
    period = 0;
    year += 1;
  } else if (period < 0) {
    period = cal.monthCount - 1;
    year -= 1;
  }
  state.year = year;
  state.period = period;
  render();
}

function goYear(delta) {
  state.year += delta;
  render();
}

function goToday() {
  state.today = localToday();
  state.selected = state.today;
  syncTo(state.selected);
  render();
}

function selectDay(dayIndex) {
  state.selected = dayIndex;
  syncTo(dayIndex);
}

function openMonth(monthIndex) {
  state.period = monthIndex;
  renderMonth();
  openDialog(el.monthDialog);
}

function openBalance(dayIndex = null) {
  if (dayIndex !== null) {
    state.selected = dayIndex;
    syncTo(dayIndex);
  }
  renderBalance();
  openDialog(el.balanceDialog);
}

/* ── конвертер ──────────────────────────────────────── */

function updateConverter() {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(el.conv.value);
  if (!match) {
    el.convOut.textContent = "—";
    return;
  }
  const info = cal.fromGregorian({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
  const weekday = info.isExtra ? t("outsideWeek") : info.weekdayName;
  el.convOut.textContent = `${formatCustom(info)} · ${weekday}`;
}

/* ── события ────────────────────────────────────────── */

$("prev-period").addEventListener("click", () => goPeriod(-1));
$("next-period").addEventListener("click", () => goPeriod(1));
$("prev-year").addEventListener("click", () => goYear(-1));
$("next-year").addEventListener("click", () => goYear(1));
$("year-prev").addEventListener("click", () => goYear(-1));
$("year-next").addEventListener("click", () => goYear(1));
el.backToday.addEventListener("click", goToday);

el.days.addEventListener("click", (event) => {
  const cell = event.target.closest("button.cell[data-day]");
  if (!cell) return;
  selectDay(Number(cell.dataset.day));
  render();
});

el.yearGrid.addEventListener("click", (event) => {
  const monthButton = event.target.closest("button[data-month]");
  if (monthButton) {
    openMonth(Number(monthButton.dataset.month));
    return;
  }

  const balanceButton = event.target.closest("[data-balance]");
  if (balanceButton) {
    const dayIndex = balanceButton.dataset.balanceDay;
    openBalance(dayIndex ? Number(dayIndex) : null);
    return;
  }

  const dayButton = event.target.closest("button[data-day]");
  if (dayButton) {
    selectDay(Number(dayButton.dataset.day));
    render();
  }
});

el.balanceList.addEventListener("click", (event) => {
  const card = event.target.closest("button[data-balance-day]");
  if (!card) return;
  selectDay(Number(card.dataset.balanceDay));
  el.balanceDialog.close();
  render();
});

document.querySelectorAll(".lang-switch button").forEach((button) => {
  button.addEventListener("click", () => setLang(button.dataset.lang));
});

el.gregBtn.addEventListener("click", () => setLayer("greg"));
el.moonBtn.addEventListener("click", () => setLayer("moon"));
el.sunBtn.addEventListener("click", () => setLayer("sun"));
el.themeBtn.addEventListener("click", () => setTheme(state.theme === "light" ? "dark" : "light"));
el.infoBtn.addEventListener("click", () => openDialog(el.infoDialog));

el.convBtn.addEventListener("click", () => {
  el.conv.value = civilToISO(cal.gregorianOf(state.today));
  updateConverter();
  openDialog(el.convDialog);
});
el.conv.addEventListener("input", updateConverter);

document.querySelectorAll("dialog.modal").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
});

document.addEventListener("keydown", (event) => {
  if (document.querySelector("dialog[open]")) return;
  if (event.target instanceof Element && event.target.matches("input, select, textarea")) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      goYear(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      goYear(1);
      break;
    case "ArrowUp":
      event.preventDefault();
      goYear(-1);
      break;
    case "ArrowDown":
      event.preventDefault();
      goYear(1);
      break;
    case "Home":
    case "t":
    case "T":
    case "е":
    case "Е":
      event.preventDefault();
      goToday();
      break;
    default:
      break;
  }
});

/* ── смена суток ────────────────────────────────────── */

function tick() {
  const today = localToday();
  if (today !== state.today) {
    const wasToday = state.selected === state.today;
    state.today = today;
    if (wasToday) {
      state.selected = today;
      syncTo(today);
    }
    render();
  }
}

/* ── старт ──────────────────────────────────────────── */

function init() {
  document.documentElement.style.setProperty("--cols", String(cal.weekLength));
  buildFormatters();
  applyStatic();
  tick();
  render();
  setInterval(tick, 30000);
}

init();
