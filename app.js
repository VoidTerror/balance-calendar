/**
 * Интерфейс календаря. Вся календарная математика — в engine.js,
 * описание календаря и переводы названий — в config.js.
 */

import { localizedConfig } from "./config.js";
import { createCalendar, civilToDayIndex, civilToISO, mod } from "./engine.js";

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

  return { age, fraction, illumination, index };
}

const moonSvg = (index) =>
  `<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><use href="#moon-${index}"></use></svg>`;

const EQUINOX_DAY = civilToDayIndex(2000, 3, 20);
const TROPICAL_YEAR = 365.2422;

function daylightFraction(dayIndex) {
  const phase = mod(dayIndex - EQUINOX_DAY, TROPICAL_YEAR) / TROPICAL_YEAR;
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
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
    fill = `<circle cx="${c}" cy="${c}" r="${r}" fill="#f2d79b"/>`;
  } else if (value > 0.001) {
    fill = `<path d="M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z" fill="#f2d79b"/>`;
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
    <g stroke="#8a6f33" stroke-width="1" stroke-linecap="round">${rays}</g>
    <circle cx="${c}" cy="${c}" r="${r}" fill="rgba(8, 10, 16, 0.7)"/>
    ${fill}
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#8a6f33" stroke-width="1"/>
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
    gregTitle: "Даты по григорианскому календарю",
    gregIcon: "Г",
    leapTitle: "Правило 128 лет",
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
    gregTitle: "Gregorian dates",
    gregIcon: "G",
    leapTitle: "128-year rule",
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

function getCalendar(lang, use128) {
  const key = `${lang}:${use128 ? "128" : "4"}`;
  if (!calendarCache.has(key)) {
    calendarCache.set(key, createCalendar(localizedConfig(lang, use128)));
  }
  return calendarCache.get(key);
}

const storedLang = readStored("uarza.lang", "ru");
const storedLayer = readStored("uarza.layer", null);
const legacyGreg = readStored("uarza.greg", null);
const layers = ["greg", "moon", "sun", "none"];

const state = {
  lang: ["ru", "en", "slav"].includes(storedLang) ? storedLang : "ru",
  layer: layers.includes(storedLayer) ? storedLayer : legacyGreg === "0" ? "none" : "greg",
  use128: readStored("uarza.leap128", "1") === "1",
  year: 1,
  period: 0,
  selected: 0,
  today: localToday(),
};

let cal = getCalendar(state.lang, state.use128);
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
  yearGrid: $("year-grid"),
  gregBtn: $("greg-btn"),
  leapBtn: $("leap-btn"),
  moonBtn: $("moon-btn"),
  sunBtn: $("sun-btn"),
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
  if (info.isExtra) {
    return `${info.extraName}, ${yearLabel(info.year)} · ${fmtLong.format(dateOf(info.dayIndex))}`;
  }
  return `${info.day} ${info.monthName}, ${yearLabel(info.year)} · ${info.weekdayName} · ${fmtLong.format(
    dateOf(info.dayIndex),
  )}`;
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

  const start = cal.periodStart(year, period);
  const count = cal.periodLength(year, period);
  const blanks = isBalance ? 0 : cal.fromDayIndex(start).weekdayIndex;

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

  el.periodNote.textContent = isBalance
    ? `${daysWord(count)} ${t("betweenYears")} · ${rangeText}`
    : `${daysWord(count)} · ${rangeText}`;
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

function miniMonthCard(year, monthIndex) {
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
      return `<button type="button" class="${classes}" data-balance="1" data-balance-day="${entry.dayIndex}"
        title="${escapeHtml(cellTitle(cal.fromDayIndex(entry.dayIndex)))}">${escapeHtml(
          entry.name,
        )}</button>`;
    })
    .join("");

  const range = `${fmtShort.format(dateOf(entries[0].dayIndex))} — ${fmtShort.format(
    dateOf(entries.at(-1).dayIndex),
  )}`;

  return `
    <div class="balance-strip">
      <button type="button" class="balance-label" data-balance="1">${escapeHtml(
        cal.extraLabel,
      )}</button>
      <span class="balance-range">${daysWord(entries.length)} · ${escapeHtml(range)}</span>
      <div class="balance-chips">${chips}</div>
    </div>`;
}

function renderBalance() {
  const year = state.year;
  const entries = cal.extraEntriesFor(year);

  el.balanceTitle.textContent = `${cal.extraLabel} · ${yearLabel(year)}`;
  el.balanceList.innerHTML = entries
    .map((entry) => {
      const classes = ["balance-card"];
      if (entry.dayIndex === state.today) classes.push("is-today");
      if (entry.dayIndex === state.selected) classes.push("is-selected");
      return `<button type="button" class="${classes.join(" ")}" data-balance-day="${entry.dayIndex}">
        <span class="balance-card-name">${escapeHtml(entry.name)}</span>
        <span class="balance-card-date">${escapeHtml(
          fmtLong.format(dateOf(entry.dayIndex)),
        )}</span>
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

  const months = cal.months.map((_, monthIndex) => miniMonthCard(year, monthIndex)).join("");

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

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", t("metaDescription"));

  el.convBtn.dataset.icon = t("convIcon");
  el.gregBtn.dataset.icon = t("gregIcon");
  el.gregBtn.setAttribute("aria-pressed", String(state.layer === "greg"));
  el.moonBtn.setAttribute("aria-pressed", String(state.layer === "moon"));
  el.sunBtn.setAttribute("aria-pressed", String(state.layer === "sun"));
  el.leapBtn.setAttribute("aria-pressed", String(state.use128));
}

function setLang(lang) {
  if (!["ru", "en", "slav"].includes(lang)) return;

  state.lang = lang;
  cal = getCalendar(state.lang, state.use128);
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

function setLeap128(on) {
  state.use128 = on;
  store("uarza.leap128", on ? "1" : "0");
  cal = getCalendar(state.lang, state.use128);
  syncTo(state.selected);
  applyStatic();
  render();
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
el.leapBtn.addEventListener("click", () => setLeap128(!state.use128));
el.moonBtn.addEventListener("click", () => setLayer("moon"));
el.sunBtn.addEventListener("click", () => setLayer("sun"));
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
