import test from "node:test";
import assert from "node:assert/strict";

import { createCalendar, isoToDayIndex, civilToDayIndex, dayIndexToCivil } from "../engine.js";
import { CONFIG } from "../config.js";

const cal = createCalendar(CONFIG);

test("эпоха: 1 Пролетник 1 года — это 2000-03-20", () => {
  const epoch = cal.toDayIndex({ year: 1, monthIndex: 0, day: 1 });
  assert.equal(epoch, isoToDayIndex("2000-03-20"));

  const date = cal.fromDayIndex(epoch);
  assert.equal(date.year, 1);
  assert.equal(date.monthIndex, 0);
  assert.equal(date.monthName, "Пролетник");
  assert.equal(date.day, 1);
  assert.equal(date.isExtra, false);
  assert.equal(date.weekdayIndex, 0);
  assert.equal(date.weekdayName, "Кон");
  assert.equal(date.isWeekend, true);
  assert.equal(date.dayOfYear, 1);
  assert.equal(date.iso, "2000-03-20");
});

test("восемь месяцев по 45 дней, по два на квартал", () => {
  assert.deepEqual(
    cal.months.map((month) => month.name),
    ["Пролетник", "Травень", "Крестень", "Серпень", "Вересень", "Грудень", "Студень", "Лютень"],
  );
  cal.months.forEach((month) => assert.equal(month.days, 45));

  assert.deepEqual(cal.quarters, ["I квартал", "II квартал", "III квартал", "IV квартал"]);
  assert.equal(cal.monthsPerQuarter, 2);
  assert.equal(cal.quarterName(0), "I квартал");
  assert.equal(cal.quarterName(1), "I квартал");
  assert.equal(cal.quarterName(2), "II квартал");
  assert.equal(cal.quarterName(6), "IV квартал");
  assert.equal(cal.quarterName(7), "IV квартал");
});

test("неделя из 9 дней, выходные — 1-й, 5-й и 9-й", () => {
  assert.equal(cal.weekLength, 9);
  assert.deepEqual(cal.weekdays, [
    "Кон",
    "Дельник",
    "Вторник",
    "Третник",
    "Середа",
    "Четверг",
    "Пятница",
    "Шестница",
    "Осьмица",
  ]);
  assert.deepEqual(cal.weekendDays, ["Кон", "Середа", "Осьмица"]);
  assert.deepEqual(
    cal.weekdays.map((_, index) => cal.isWeekend(index)),
    [true, false, false, false, true, false, false, false, true],
  );
});

test("длины годов: 365 дней, каждый 4-й — 366", () => {
  assert.equal(cal.yearLength(1), 365);
  assert.equal(cal.yearLength(2), 365);
  assert.equal(cal.yearLength(3), 365);
  assert.equal(cal.yearLength(4), 366);
  assert.equal(cal.yearLength(8), 366);
  assert.equal(cal.yearLength(27), 365);
  assert.equal(cal.yearStartDay(5) - cal.yearStartDay(1), 1461);
});

test("в конце года пять дней баланса, в високосный — шесть", () => {
  assert.equal(cal.extraDaysFor(3).length, 5);
  assert.deepEqual(
    cal.extraDaysFor(3).map((day) => day.name),
    ["День баланса I", "День баланса II", "День баланса III", "День баланса IV", "День баланса V"],
  );

  assert.equal(cal.extraDaysFor(4).length, 6);
  const extra = cal.extraEntriesFor(4);
  assert.equal(extra.at(-1).name, "День баланса VI");
  assert.equal(extra.at(-1).dayIndex, cal.yearStartDay(5) - 1);

  const lastMonthDay = cal.toDayIndex({ year: 1, monthIndex: 7, day: 45 });
  assert.equal(cal.fromDayIndex(lastMonthDay).monthName, "Лютень");
  assert.equal(cal.fromDayIndex(lastMonthDay + 1).isExtra, true);
});

test("сегодня: 26 ноября 2026 — 27 Грудня 27-го года", () => {
  const date = cal.fromGregorian({ year: 2026, month: 11, day: 26 });
  assert.equal(date.year, 27);
  assert.equal(date.monthName, "Грудень");
  assert.equal(date.monthIndex, 5);
  assert.equal(cal.quarterName(date.monthIndex), "III квартал");
  assert.equal(date.day, 27);
  assert.equal(date.dayOfYear, 252);
  assert.equal(date.daysLeftInYear, 113);
  assert.equal(date.weekdayName, "Кон");
  assert.equal(date.isWeekend, true);
  assert.equal(date.isLeapYear, false);
});

test("перевод туда и обратно совпадает на широком диапазоне", () => {
  for (let dayIndex = -40000; dayIndex <= 40000; dayIndex += 7) {
    const date = cal.fromDayIndex(dayIndex);
    assert.equal(date.dayIndex, dayIndex);
    if (date.isExtra) continue;
    const back = cal.toDayIndex({
      year: date.year,
      monthIndex: date.monthIndex,
      day: date.day,
    });
    assert.equal(back, dayIndex, `сломалось на ${date.iso}`);
  }
});

test("даты до эпохи считаются корректно", () => {
  const before = cal.fromDayIndex(isoToDayIndex("2000-03-19"));
  assert.equal(before.year, 0);
  assert.equal(before.isExtra, true);
  assert.equal(before.yearLength, 366); // год 0 делится на 4
  assert.equal(cal.fromDayIndex(before.dayIndex).iso, "2000-03-19");
});

test("день недели идёт непрерывно с периодом 9", () => {
  const base = cal.fromDayIndex(0).weekdayIndex;
  for (let i = 0; i < 300; i += 1) {
    const date = cal.fromDayIndex(i);
    assert.equal(date.weekdayIndex, (base + i) % 9);
  }
});

test("каждый год начинается 20 марта, пока совпадает високосный ритм", () => {
  for (let year = 1; year <= 97; year += 1) {
    const start = cal.fromDayIndex(cal.yearStartDay(year));
    assert.equal(start.monthIndex, 0);
    assert.equal(start.day, 1);
    assert.equal(cal.gregorianOf(start.dayIndex).month, 3);
    assert.equal(cal.gregorianOf(start.dayIndex).day, 20);
  }
});

test("номер дня григорианского календаря согласован с Date.UTC", () => {
  const cases = [
    [1970, 1, 1],
    [2000, 2, 29],
    [2026, 11, 26],
    [1969, 12, 31],
  ];
  for (const [year, month, day] of cases) {
    const expected = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
    assert.equal(civilToDayIndex(year, month, day), expected);
    assert.deepEqual(dayIndexToCivil(expected), { year, month, day });
  }
});

test("движок работает с другим календарём: 5-дневная неделя и неровные месяцы", () => {
  const odd = createCalendar({
    weekdays: ["А", "Б", "В", "Г", "Д"],
    months: [
      { name: "Первый", days: 13 },
      { name: "Второй", days: 29 },
      { name: "Третий", days: 1 },
    ],
    extra: { label: "Щель", days: [{ name: "День X" }, { name: "День Y" }] },
    leap: { every: 3, offset: 1, days: [{ name: "День Z" }] },
    epoch: { year: 7, gregorian: "1999-12-31" },
  });

  assert.equal(odd.weekLength, 5);
  assert.equal(odd.periodCount, 4);
  assert.deepEqual(odd.weekendDays, ["Д"]); // по умолчанию отдыхает последний день
  assert.equal(odd.yearLength(7), 45); // 43 + 2
  assert.equal(odd.yearLength(8), 46); // 43 + 2 + 1 (год 8: 8+1 делится на 3)
  assert.equal(odd.yearStartDay(7), isoToDayIndex("1999-12-31"));

  let extras = 0;
  for (let offset = 0; offset < odd.yearLength(8); offset += 1) {
    const date = odd.fromDayIndex(odd.yearStartDay(8) + offset);
    assert.equal(date.dayIndex, odd.yearStartDay(8) + offset);
    if (date.isExtra) extras += 1;
  }
  assert.equal(extras, 3);

  for (let dayIndex = -3000; dayIndex <= 3000; dayIndex += 5) {
    const date = odd.fromDayIndex(dayIndex);
    assert.equal(date.dayIndex, dayIndex);
    if (!date.isExtra) {
      assert.equal(
        odd.toDayIndex({ year: date.year, monthIndex: date.monthIndex, day: date.day }),
        dayIndex,
      );
    }
  }
});

test("календарь без дней вне месяцев обходится без лишнего периода", () => {
  const plain = createCalendar({
    weekdays: ["1", "2", "3"],
    months: [
      { name: "А", days: 10 },
      { name: "Б", days: 10 },
    ],
    extra: { days: [] },
    epoch: { year: 1, gregorian: "2020-01-01" },
  });

  assert.equal(plain.hasExtraPeriod, false);
  assert.equal(plain.periodCount, 2);
  assert.equal(plain.EXTRA_PERIOD, -1);
  assert.equal(plain.yearLength(1), 20);

  for (let dayIndex = -500; dayIndex <= 500; dayIndex += 3) {
    const date = plain.fromDayIndex(dayIndex);
    assert.equal(date.isExtra, false);
    assert.equal(
      plain.toDayIndex({ year: date.year, monthIndex: date.monthIndex, day: date.day }),
      dayIndex,
    );
  }
});
