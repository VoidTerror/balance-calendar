/**
 * Ядро календаря.
 *
 * Здесь нет ни DOM, ни форматирования — только арифметика дней.
 * Любая календарная система описывается объектом config (см. config.js):
 * месяцы, длина недели, дополнительные дни, високосное правило и эпоха.
 *
 * Внутреннее представление — "номер дня": целое число дней от 1970-01-01.
 * Это позволяет свободно переводить даты между григорианским и своим календарём.
 */

const MS_PER_DAY = 86_400_000;
const pad2 = (n) => String(n).padStart(2, "0");

/** Остаток, всегда неотрицательный (важно для дат до эпохи). */
export const mod = (n, m) => ((n % m) + m) % m;

/** Григорианские Y/M/D -> номер дня (может быть отрицательным). */
export function civilToDayIndex(year, month, day) {
  const dt = new Date(0);
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCFullYear(year, month - 1, day);
  return Math.round(dt.getTime() / MS_PER_DAY);
}

/** Номер дня -> григорианские Y/M/D (месяц 1..12). */
export function dayIndexToCivil(dayIndex) {
  const dt = new Date(dayIndex * MS_PER_DAY);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

/** "YYYY-MM-DD" -> номер дня. */
export function isoToDayIndex(iso) {
  const match = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/.exec(String(iso).trim());
  if (!match) throw new Error(`Неверная дата в формате YYYY-MM-DD: ${iso}`);
  return civilToDayIndex(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Григорианские Y/M/D -> "YYYY-MM-DD". */
export function civilToISO({ year, month, day }) {
  const y = year < 0 ? `-${String(-year).padStart(4, "0")}` : String(year).padStart(4, "0");
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

function validate(config) {
  const fail = (message) => {
    throw new Error(`config.js: ${message}`);
  };

  if (!config || typeof config !== "object") fail("конфиг не передан");
  if (!Array.isArray(config.weekdays) || config.weekdays.length < 2) {
    fail("weekdays должен быть массивом минимум из двух названий дней недели");
  }
  if (config.weekends !== undefined) {
    if (!Array.isArray(config.weekends) || config.weekends.length === 0) {
      fail("weekends должен быть непустым массивом номеров дней недели");
    }
    config.weekends.forEach((number) => {
      if (!Number.isInteger(number) || number < 1 || number > config.weekdays.length) {
        fail(`weekends: ${number} вне диапазона 1..${config.weekdays.length}`);
      }
    });
  }
  if (!Array.isArray(config.months) || config.months.length === 0) {
    fail("months должен быть непустым массивом");
  }
  config.months.forEach((month, i) => {
    if (!month || typeof month.name !== "string" || !month.name.trim()) {
      fail(`у месяца №${i + 1} нет названия`);
    }
    if (!Number.isInteger(month.days) || month.days < 1) {
      fail(`у месяца «${month.name}» некорректное число дней: ${month.days}`);
    }
  });
  if (config.extra && !Array.isArray(config.extra.days)) {
    fail("extra.days должен быть массивом (можно пустым)");
  }
  if (config.leap) {
    if (!Number.isInteger(config.leap.every) || config.leap.every < 1) {
      fail("leap.every должен быть целым числом >= 1");
    }
    if (!Array.isArray(config.leap.days) || config.leap.days.length === 0) {
      fail("leap.days должен содержать хотя бы один день");
    }
  }
  if (!config.epoch || !Number.isInteger(config.epoch.year)) {
    fail("epoch.year должен быть целым числом");
  }
  isoToDayIndex(config.epoch.gregorian);
}

/**
 * Собирает календарь из конфига.
 * Возвращает объект с готовыми функциями перевода и разбора дат.
 */
export function createCalendar(config) {
  validate(config);

  const weekdays = config.weekdays.slice();
  const weekLength = weekdays.length;

  // Выходные: по умолчанию последний день недели.
  const weekendIndices = (config.weekends ?? [weekLength]).map((number) =>
    mod(number - 1, weekLength),
  );
  const weekendSet = new Set(weekendIndices);
  const isWeekend = (weekdayIndex) => weekendSet.has(weekdayIndex);
  const weekends = [...weekendSet].sort((a, b) => a - b);
  const weekendDays = weekends.map((index) => weekdays[index]);

  const months = config.months.map((m) => ({ name: m.name, days: m.days }));
  const monthCount = months.length;

  const monthOffsets = [0];
  for (const month of months) {
    monthOffsets.push(monthOffsets[monthOffsets.length - 1] + month.days);
  }
  const monthsDays = monthOffsets[monthCount];

  // Недели считаются внутри каждого месяца: 1-е число — всегда первый день недели.
  // Смещение недель по месяцам нужно, чтобы номер недели в году шёл без разрывов.
  const monthWeekOffsets = [0];
  for (const month of months) {
    monthWeekOffsets.push(
      monthWeekOffsets[monthWeekOffsets.length - 1] + Math.ceil(month.days / weekLength),
    );
  }
  const weeksInYear = monthWeekOffsets[monthCount];

  const extraDays = (config.extra?.days ?? []).map((d) => ({ ...d }));
  const extraLabel = config.extra?.label ?? "Дни вне года";

  const leapEvery = config.leap?.every ?? 0;
  const leapOffset = config.leap?.offset ?? 0;
  const leapDays = (config.leap?.days ?? []).map((d) => ({ ...d }));

  const epochYear = config.epoch.year;
  const epochDayIndex = isoToDayIndex(config.epoch.gregorian);

  /** Високосный ли год по правилу "каждый N-й год". */
  const isLeapYear = (year) =>
    leapEvery > 0 && leapDays.length > 0 && mod(year + leapOffset, leapEvery) === 0;

  /** Полная длина года в днях. */
  const yearLength = (year) =>
    monthsDays + extraDays.length + (isLeapYear(year) ? leapDays.length : 0);

  /** Сколько високосных лет в замкнутом промежутке [fromY, toY]. */
  const leapYearsBetween = (fromY, toY) => {
    if (toY < fromY || leapEvery <= 0 || leapDays.length === 0) return 0;
    const target = mod(-leapOffset, leapEvery);
    const first = fromY + mod(target - fromY, leapEvery);
    if (first > toY) return 0;
    return Math.floor((toY - first) / leapEvery) + 1;
  };

  /** Номер дня, с которого начинается указанный год. */
  const yearStartDay = (year) => {
    const shift = year - epochYear;
    const base = monthsDays + extraDays.length;
    if (shift === 0) return epochDayIndex;
    if (shift > 0) {
      return (
        epochDayIndex +
        base * shift +
        leapDays.length * leapYearsBetween(epochYear, year - 1)
      );
    }
    return (
      epochDayIndex -
      base * -shift -
      leapDays.length * leapYearsBetween(year, epochYear - 1)
    );
  };

  /** Дни вне месяцев указанного года (обычные, затем високосные). */
  const extraDaysFor = (year) =>
    isLeapYear(year) ? [...extraDays, ...leapDays] : extraDays.slice();

  /** Все дни вне месяцев года — с номерами. */
  const extraEntriesFor = (year) =>
    extraDaysFor(year).map((entry, index) => ({
      ...entry,
      index,
      dayIndex: yearStartDay(year) + monthsDays + index,
    }));

  /** Номер дня внутри года (0-based) -> полное описание даты. */
  const fromDayIndex = (dayIndex) => {
    if (!Number.isInteger(dayIndex)) {
      throw new Error(`Номер дня должен быть целым: ${dayIndex}`);
    }

    const averageYear = monthsDays + extraDays.length;
    let year = epochYear + Math.floor((dayIndex - epochDayIndex) / averageYear);

    let guard = 0;
    while (yearStartDay(year) > dayIndex) {
      year -= 1;
      if (++guard > 10000) throw new Error("Не удалось определить год");
    }
    while (yearStartDay(year + 1) <= dayIndex) {
      year += 1;
      if (++guard > 10000) throw new Error("Не удалось определить год");
    }

    const dayOfYearIndex = dayIndex - yearStartDay(year);
    const gregorian = dayIndexToCivil(dayIndex);
    const length = yearLength(year);
    const leap = isLeapYear(year);

    const common = {
      dayIndex,
      year,
      dayOfYear: dayOfYearIndex + 1,
      yearLength: length,
      daysLeftInYear: length - dayOfYearIndex - 1,
      isLeapYear: leap,
      gregorian,
      iso: civilToISO(gregorian),
    };

    if (dayOfYearIndex < monthsDays) {
      let monthIndex = 0;
      while (dayOfYearIndex >= monthOffsets[monthIndex + 1]) monthIndex += 1;
      const day = dayOfYearIndex - monthOffsets[monthIndex] + 1;

      // Неделя начинается заново в каждом месяце: 1-е число — Кон.
      const weekdayIndex = mod(day - 1, weekLength);
      const weekInMonth = Math.floor((day - 1) / weekLength) + 1;

      return {
        ...common,
        isExtra: false,
        monthIndex,
        monthName: months[monthIndex].name,
        day,
        daysInMonth: months[monthIndex].days,
        extraIndex: null,
        extraName: null,
        weekdayIndex,
        weekdayName: weekdays[weekdayIndex],
        isWeekend: isWeekend(weekdayIndex),
        weekInMonth,
        weekOfYear: monthWeekOffsets[monthIndex] + weekInMonth,
      };
    }

    // Дни баланса стоят вне недели: у них нет дня недели.
    const list = extraDaysFor(year);
    const extraIndex = dayOfYearIndex - monthsDays;
    return {
      ...common,
      isExtra: true,
      monthIndex: null,
      monthName: null,
      day: null,
      daysInMonth: null,
      extraIndex,
      extraName: list[extraIndex].name,
      weekdayIndex: null,
      weekdayName: null,
      isWeekend: false,
      weekInMonth: null,
      weekOfYear: null,
    };
  };

  /** Дата внутри месяца (monthIndex 0-based) -> номер дня. */
  const toDayIndex = ({ year, monthIndex, day }) => {
    if (!Number.isInteger(year)) throw new Error("year должен быть целым");
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex >= monthCount) {
      throw new Error(`monthIndex вне диапазона 0..${monthCount - 1}: ${monthIndex}`);
    }
    if (!Number.isInteger(day) || day < 1 || day > months[monthIndex].days) {
      throw new Error(`day вне диапазона 1..${months[monthIndex].days}: ${day}`);
    }
    return yearStartDay(year) + monthOffsets[monthIndex] + day - 1;
  };

  /** Григорианская дата -> описание своей даты. */
  const fromGregorian = ({ year, month, day }) =>
    fromDayIndex(civilToDayIndex(year, month, day));

  /** Григорианские Y/M/D для номера дня. */
  const gregorianOf = (dayIndex) => dayIndexToCivil(dayIndex);

  // "Периоды" — это месяцы + (если есть) один дополнительный период
  // для дней вне месяцев. Мир может жить и без таких дней.
  const hasExtraPeriod = extraDays.length + leapDays.length > 0;
  const EXTRA_PERIOD = hasExtraPeriod ? monthCount : -1;
  const periodCount = monthCount + (hasExtraPeriod ? 1 : 0);

  const periodLength = (year, period) =>
    period === EXTRA_PERIOD ? extraDaysFor(year).length : months[period].days;

  const periodStart = (year, period) =>
    yearStartDay(year) +
    (period === EXTRA_PERIOD ? monthsDays : monthOffsets[period]);

  const periodName = (period) =>
    period === EXTRA_PERIOD ? extraLabel : months[period].name;

  const daysInMonth = (year, monthIndex) => months[monthIndex].days;

  return {
    config,
    world: config.world ?? "",
    weekdays,
    weekLength,
    weekends,
    weekendDays,
    isWeekend,
    months,
    monthCount,
    extraLabel,
    EXTRA_PERIOD,
    hasExtraPeriod,
    periodCount,
    epochYear,
    epochDayIndex,
    monthsDays,
    weeksInYear,
    monthWeekOffsets,
    isLeapYear,
    yearLength,
    yearStartDay,
    extraDaysFor,
    extraEntriesFor,
    fromDayIndex,
    toDayIndex,
    fromGregorian,
    gregorianOf,
    daysInMonth,
    periodLength,
    periodStart,
    periodName,
  };
}
