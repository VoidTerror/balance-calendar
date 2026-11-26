/**
 * Интерфейс календаря. Вся календарная математика — в engine.js,
 * описание мира — в config.js. Здесь только DOM и форматирование.
 */

import { CONFIG } from "./config.js";
import { createCalendar, civilToDayIndex, civilToISO } from "./engine.js";

const cal = createCalendar(CONFIG);
const EXTRA = cal.EXTRA_PERIOD;
const DAY_MS = 86_400_000;

/* ── форматирование ─────────────────────────────────── */

const ruFormat = (options) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", ...options });

const fmtLong = ruFormat({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtRange = ruFormat({ day: "numeric", month: "long" });
const fmtRangeYear = ruFormat({ day: "numeric", month: "long", year: "numeric" });
const fmtShort = ruFormat({ day: "numeric", month: "short" });

function plural(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

const daysWord = (n) => `${n} ${plural(n, ["день", "дня", "дней"])}`;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);

const dateOf = (dayIndex) => new Date(dayIndex * DAY_MS);

const yearLabel = (year) => `${year}-й год`;

function formatCustom(info) {
  if (info.isExtra) return `${info.extraName}, ${yearLabel(info.year)}`;
  return `${info.day} ${info.monthName}, ${yearLabel(info.year)}`;
}

/* ── состояние ──────────────────────────────────────── */

function localToday() {
  const now = new Date();
  return civilToDayIndex(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const state = {
  view: "month",
  year: 1,
  period: 0,
  selected: 0,
  today: localToday(),
};

function syncTo(dayIndex) {
  const info = cal.fromDayIndex(dayIndex);
  state.year = info.year;
  state.period = info.isExtra ? EXTRA : info.monthIndex;
}

syncTo(state.today);
state.selected = state.today;

/* ── элементы ───────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const el = {
  tagline: $("tagline"),
  heroKicker: $("hero-kicker"),
  heroDay: $("hero-day"),
  heroMonth: $("hero-month"),
  heroYear: $("hero-year"),
  heroWeekday: $("hero-weekday"),
  heroGregorian: $("hero-gregorian"),
  heroDoy: $("hero-doy"),
  heroWeek: $("hero-week"),
  heroLeft: $("hero-left"),
  heroProgress: $("hero-progress"),
  heroClock: $("hero-clock"),
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
  conv: $("conv"),
  convOut: $("conv-out"),
  footnote: $("footnote"),
};

const weekdayInitials = cal.weekdays.map((name) => name.slice(0, 1).toUpperCase());

/* ── рендер: герой ──────────────────────────────────── */

function renderHero() {
  const info = cal.fromDayIndex(state.selected);
  const isToday = state.selected === state.today;

  el.heroKicker.textContent = isToday ? "Сегодня" : "Выбрано";

  el.heroDay.textContent = info.isExtra ? String(info.extraIndex + 1) : String(info.day);

  const label = info.isExtra ? info.extraName : info.monthName;
  el.heroMonth.textContent = label;
  el.heroMonth.classList.toggle("is-long", label.length > 10);

  el.heroYear.textContent = yearLabel(info.year);
  el.heroWeekday.textContent = info.weekdayName;
  el.heroGregorian.textContent = fmtLong.format(dateOf(info.dayIndex));

  el.heroDoy.textContent = `${info.dayOfYear} / ${info.yearLength}`;

  const weeksInYear = Math.ceil(info.yearLength / cal.weekLength);
  el.heroWeek.textContent = `${info.weekOfYear} / ${weeksInYear}`;

  el.heroLeft.textContent = daysWord(info.daysLeftInYear);

  const percent = (info.dayOfYear / info.yearLength) * 100;
  el.heroProgress.style.width = `${percent.toFixed(2)}%`;
  el.heroProgress.parentElement.setAttribute(
    "aria-label",
    `Год пройден на ${Math.round(percent)} процентов`,
  );

  el.backToday.hidden = isToday;
}

/* ── рендер: месячная сетка ─────────────────────────── */

function renderWeekdays() {
  el.weekdays.innerHTML = cal.weekdays
    .map(
      (name, index) => `
      <div class="wd${index === cal.weekLength - 1 ? " is-rest" : ""}" title="${escapeHtml(name)}">
        <span class="wd-letter">${escapeHtml(weekdayInitials[index])}</span>
        <span class="wd-name">${escapeHtml(name)}</span>
      </div>`,
    )
    .join("");
}

function cellTitle(info) {
  const own = info.isExtra
    ? info.extraName
    : `${info.day} ${info.monthName}`;
  return `${own}, ${yearLabel(info.year)} · ${info.weekdayName} · ${fmtLong.format(
    dateOf(info.dayIndex),
  )}`;
}

function renderMonth() {
  const { year, period } = state;
  const name = cal.periodName(period);
  el.periodTitle.textContent = `${name} · ${yearLabel(year)}`;

  const start = cal.periodStart(year, period);
  const count = cal.periodLength(year, period);
  const blanks = cal.fromDayIndex(start).weekdayIndex;

  const cells = [];
  for (let i = 0; i < blanks; i += 1) {
    cells.push('<div class="cell blank" aria-hidden="true"></div>');
  }

  for (let i = 0; i < count; i += 1) {
    const dayIndex = start + i;
    const info = cal.fromDayIndex(dayIndex);
    const classes = ["cell"];
    if (info.isExtra) classes.push("is-extra");
    if (info.weekdayIndex === cal.weekLength - 1) classes.push("is-rest");
    if (dayIndex === state.today) classes.push("is-today");
    if (dayIndex === state.selected) classes.push("is-selected");

    const title = cellTitle(info);
    const number = info.isExtra ? escapeHtml(info.extraName) : info.day;
    const aria = dayIndex === state.today ? `aria-current="date"` : "";

    cells.push(`
      <button type="button" class="${classes.join(" ")}" data-day="${dayIndex}"
        title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${aria}>
        <span class="cell-num">${number}</span>
        <span class="cell-greg" aria-hidden="true">${escapeHtml(fmtShort.format(dateOf(dayIndex)))}</span>
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

  el.periodNote.textContent =
    period === EXTRA
      ? `${daysWord(count)} между годами · ${rangeText}`
      : `${daysWord(count)} · ${rangeText}`;
}

/* ── рендер: год ────────────────────────────────────── */

function miniWeekdays() {
  return cal.weekdays
    .map(
      (name, index) =>
        `<span class="mini-wd${index === cal.weekLength - 1 ? " is-rest" : ""}" title="${escapeHtml(
          name,
        )}">${escapeHtml(weekdayInitials[index])}</span>`,
    )
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

  const cards = cal.months.map((month, monthIndex) => {
    const start = cal.periodStart(year, monthIndex);
    const count = cal.periodLength(year, monthIndex);
    const blanks = cal.fromDayIndex(start).weekdayIndex;

    const cells = [];
    for (let i = 0; i < blanks; i += 1) {
      cells.push('<span class="mini-cell blank" aria-hidden="true"></span>');
    }
    for (let i = 0; i < count; i += 1) {
      const dayIndex = start + i;
      const info = cal.fromDayIndex(dayIndex);
      const classes = ["mini-cell"];
      if (dayIndex === state.today) classes.push("is-today");
      if (dayIndex === state.selected) classes.push("is-selected");
      cells.push(
        `<button type="button" class="${classes.join(" ")}" data-day="${dayIndex}"
          title="${escapeHtml(cellTitle(info))}" aria-label="${escapeHtml(cellTitle(info))}">${info.day}</button>`,
      );
    }

    const span = `${fmtShort.format(dateOf(start))} — ${fmtShort.format(
      dateOf(start + count - 1),
    )}`;

    return `
      <article class="mini">
        <button type="button" class="mini-title" data-month="${monthIndex}">
          ${escapeHtml(month.name)}<span>${escapeHtml(span)}</span>
        </button>
        <div class="mini-weekdays">${miniWeekdays()}</div>
        <div class="mini-days">${cells.join("")}</div>
      </article>`;
  });

  const extraEntries = cal.extraEntriesFor(year);
  if (extraEntries.length > 0) {
    const chips = extraEntries
      .map((entry) => {
        const classes = entry.dayIndex === state.today ? "is-today" : "";
        return `<button type="button" class="${classes}" data-day="${entry.dayIndex}"
          title="${escapeHtml(cellTitle(cal.fromDayIndex(entry.dayIndex)))}">${escapeHtml(
            entry.name,
          )}</button>`;
      })
      .join("");

    cards.push(`
      <article class="mini">
        <button type="button" class="mini-title" data-month="${EXTRA}">
          ${escapeHtml(cal.extraLabel)}<span>${daysWord(extraEntries.length)}</span>
        </button>
        <div class="mini-extra">${chips}</div>
        <p class="extra-label">${escapeHtml(
          fmtShort.format(dateOf(extraEntries[0].dayIndex)),
        )} — ${escapeHtml(fmtShort.format(dateOf(extraEntries.at(-1).dayIndex)))}</p>
      </article>`);
  }

  el.yearGrid.innerHTML = cards.join("");
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
  document.title = `${todayInfo.day} ${todayInfo.monthName} — Календарь ${cal.world}`;
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

document.addEventListener("keydown", (event) => {
  if (event.target instanceof Element && event.target.matches("input, select, textarea")) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      goPeriod(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      goPeriod(1);
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

/* ── часы и смена суток ─────────────────────────────── */

function tick() {
  const now = new Date();
  el.heroClock.textContent = now.toLocaleTimeString("ru-RU", { hour12: false });

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
  el.convOut.textContent = `${formatCustom(info)} · ${info.weekdayName}`;
}

el.conv.addEventListener("input", updateConverter);

/* ── старт ──────────────────────────────────────────── */

function init() {
  document.documentElement.style.setProperty("--cols", String(cal.weekLength));

  const lengths = new Set();
  const cycle = Math.max(cal.config.leap?.every ?? 0, 4);
  for (let year = 1; year <= cycle; year += 1) lengths.add(cal.yearLength(year));
  const lengthsText = [...lengths].sort((a, b) => a - b).join("/");

  el.tagline.textContent = `${cal.monthCount} месяцев · ${cal.weekLength} дней в неделе · ${lengthsText} дней в году`;

  el.footnote.textContent =
    `${cal.world}. Точка отсчёта: 1 ${cal.months[0].name} ${cal.config.epoch.year} года = ` +
    `${fmtLong.format(dateOf(cal.epochDayIndex))} Дни вне месяцев: ${cal.extraLabel}. ` +
    `Время местное. Стрелки ← → листают месяцы, ↑ ↓ — годы, T — сегодня.`;

  el.conv.value = civilToISO(cal.gregorianOf(state.today));
  updateConverter();

  tick();
  render();
  setInterval(tick, 1000);
}

init();
