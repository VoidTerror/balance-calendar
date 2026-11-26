/**
 * Интерфейс календаря. Вся календарная математика — в engine.js,
 * описание календаря и переводы названий — в config.js.
 */

import { CONFIG, localizedConfig } from "./config.js";
import { createCalendar, civilToDayIndex, civilToISO } from "./engine.js";

const DAY_MS = 86_400_000;

const calendars = {
  ru: createCalendar(localizedConfig("ru")),
  en: createCalendar(localizedConfig("en")),
};

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
    viewSwitchLabel: "Вид календаря",
    langLabel: "Язык",
    infoTitle: "О календаре",
    convTitle: "Конвертер",
    moonTitle: "Лунные фазы",
    gregTitle: "Показать даты по григорианскому календарю",
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
      "Календарь Уарза: 8 месяцев по 45 дней, 9-дневная неделя, выходные 1/5/9 и дни баланса. Григорианская дата рядом с каждой датой.",
  },
  en: {
    appTitle: "Uarza Calendar",
    docTitle: "Calendar",
    today: "Today",
    selected: "Selected",
    outsideWeek: "outside the week",
    backToToday: "back to today",
    viewYear: "Year",
    viewMonth: "Month",
    viewSwitchLabel: "Calendar view",
    langLabel: "Language",
    infoTitle: "About the calendar",
    convTitle: "Converter",
    moonTitle: "Moon phases",
    gregTitle: "Show Gregorian dates",
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
      "Uarza Calendar: 8 months of 45 days, a 9-day week, weekends 1/5/9 and balance days. Gregorian date next to every date.",
  },
};

const t = (key) => STRINGS[state.lang][key] ?? key;

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

const state = {
  lang: readStored("uarza.lang", "ru") === "en" ? "en" : "ru",
  showGreg: readStored("uarza.greg", "0") === "1",
  view: "year",
  year: 1,
  period: 0,
  selected: 0,
  today: localToday(),
};

let cal = calendars[state.lang];
const EXTRA = cal.EXTRA_PERIOD;

let fmtLong;
let fmtRange;
let fmtRangeYear;
let fmtShort;

function buildFormatters() {
  const locale = state.lang === "en" ? "en-GB" : "ru-RU";
  const make = (options) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options });

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
  panelMonth: $("panel-month"),
  panelYear: $("panel-year"),
  yearTitle: $("year-title"),
  yearRange: $("year-range"),
  yearGrid: $("year-grid"),
  gregBtn: $("greg-btn"),
  moonBtn: $("moon-btn"),
  infoBtn: $("info-btn"),
  convBtn: $("conv-btn"),
  langRu: document.querySelector('.lang-switch button[data-lang="ru"]'),
  langEn: document.querySelector('.lang-switch button[data-lang="en"]'),
  infoDialog: $("info-dialog"),
  convDialog: $("conv-dialog"),
  moonDialog: $("moon-dialog"),
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

function renderMonth() {
  const { year, period } = state;
  const isBalance = period === EXTRA;
  const name = cal.periodName(period);
  el.periodTitle.textContent = `${name} · ${yearLabel(year)}`;

  el.weekdays.hidden = isBalance;
  el.days.classList.toggle("is-balance", isBalance);

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
        <span class="cell-num">${number}</span>
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
        title="${escapeHtml(cellTitle(info))}" aria-label="${escapeHtml(cellTitle(info))}">${info.day}</button>`,
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
      return `<button type="button" class="${classes}" data-day="${entry.dayIndex}"
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
      <button type="button" class="balance-label" data-month="${EXTRA}">${escapeHtml(
        cal.extraLabel,
      )}</button>
      <span class="balance-range">${daysWord(entries.length)} · ${escapeHtml(range)}</span>
      <div class="balance-chips">${chips}</div>
    </div>`;
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

  el.yearGrid.classList.toggle("show-greg", state.showGreg);
  el.yearGrid.innerHTML = `
    <div class="year-months">${months}</div>
    ${balanceStrip(year)}`;
}

/* ── общий рендер ───────────────────────────────────── */

function render() {
  el.panelMonth.hidden = state.view !== "month";
  el.panelYear.hidden = state.view !== "year";

  renderHero();
  if (state.view === "month") {
    renderWeekdays();
    renderMonth();
  } else {
    renderYear();
  }

  document.querySelectorAll(".view-switch button").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.view === state.view));
  });

  const todayInfo = cal.fromDayIndex(state.today);
  document.title = `${todayInfo.day} ${todayInfo.monthName} — ${t("docTitle")}`;
}

/* ── язык и настройки ───────────────────────────────── */

function applyStatic() {
  document.documentElement.lang = state.lang;
  document.documentElement.dataset.lang = state.lang;

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
  el.gregBtn.setAttribute("aria-pressed", String(state.showGreg));
}

function setLang(lang) {
  if (lang !== "ru" && lang !== "en") return;

  state.lang = lang;
  cal = calendars[lang];
  buildFormatters();
  store("uarza.lang", lang);
  applyStatic();
  render();
  if (el.convDialog.open) updateConverter();
}

function setGregorian(on) {
  state.showGreg = on;
  store("uarza.greg", on ? "1" : "0");
  el.gregBtn.setAttribute("aria-pressed", String(on));
  render();
}

/* ── диалоги ────────────────────────────────────────── */

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

/* ── навигация ──────────────────────────────────────── */

function goPeriod(delta) {
  state.view = "month";
  let { year, period } = state;
  period += delta;
  if (period >= cal.periodCount) {
    period = 0;
    year += 1;
  } else if (period < 0) {
    period = cal.periodCount - 1;
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
  state.view = "month";
  render();
  focusSelected();
}

function selectDay(dayIndex) {
  state.selected = dayIndex;
  syncTo(dayIndex);
}

function focusSelected() {
  const node = el.days.querySelector(`.cell[data-day="${state.selected}"]`);
  node?.focus({ preventScroll: true });
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

document.querySelectorAll(".view-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    render();
  });
});

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
  el.days.querySelectorAll(".cell.is-selected").forEach((node) => {
    node.classList.remove("is-selected");
  });
  cell.classList.add("is-selected");
  renderHero();
});

el.yearGrid.addEventListener("click", (event) => {
  const dayButton = event.target.closest("button[data-day]");
  if (dayButton) {
    selectDay(Number(dayButton.dataset.day));
    state.view = "month";
    render();
    focusSelected();
    return;
  }

  const monthButton = event.target.closest("button[data-month]");
  if (monthButton) {
    state.period = Number(monthButton.dataset.month);
    state.view = "month";
    render();
  }
});

el.langRu.addEventListener("click", () => setLang("ru"));
el.langEn.addEventListener("click", () => setLang("en"));

el.gregBtn.addEventListener("click", () => setGregorian(!state.showGreg));
el.infoBtn.addEventListener("click", () => openDialog(el.infoDialog));
el.moonBtn.addEventListener("click", () => openDialog(el.moonDialog));

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
      if (state.view === "year") goYear(-1);
      else goPeriod(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      if (state.view === "year") goYear(1);
      else goPeriod(1);
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
