const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

const formatterCache = new Map()

function getFormatter(cacheKey, options) {
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.DateTimeFormat('en-CA', options))
  }

  return formatterCache.get(cacheKey)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number)

  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`)
  }

  return { year, month, day }
}

function buildDateKey({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function isPlainDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function toDateKey(input, timeZone = DEFAULT_TIME_ZONE) {
  if (isPlainDateKey(input)) {
    return String(input)
  }

  return getDateKeyInTimeZone(input, timeZone)
}

function getDateTimeParts(date, timeZone = DEFAULT_TIME_ZONE) {
  const normalizedTimeZone = normalizeTimeZone(timeZone)
  const formatter = getFormatter(`datetime:${normalizedTimeZone}`, {
    timeZone: normalizedTimeZone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const parts = formatter.formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') {
      result[part.type] = part.value
    }

    return result
  }, {})

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  }
}

function getTimeZoneOffsetMs(date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = getDateTimeParts(date, timeZone)
  const zonedUtcTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return zonedUtcTimestamp - (date.getTime() - date.getMilliseconds())
}

export function normalizeTimeZone(timeZone = DEFAULT_TIME_ZONE) {
  const candidate = String(timeZone || '').trim() || DEFAULT_TIME_ZONE

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export function getDateKeyInTimeZone(date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = getDateTimeParts(new Date(date), timeZone)
  return buildDateKey(parts)
}

export function addDaysToDateKey(dateKey, days) {
  const parts = parseDateKey(dateKey)
  const calendarDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  calendarDate.setUTCDate(calendarDate.getUTCDate() + days)

  return buildDateKey({
    year: calendarDate.getUTCFullYear(),
    month: calendarDate.getUTCMonth() + 1,
    day: calendarDate.getUTCDate()
  })
}

export function compareDateKeys(left, right) {
  if (left === right) return 0
  return left < right ? -1 : 1
}

export function getStartOfWeekDateKey(input, timeZone = DEFAULT_TIME_ZONE) {
  const dateKey = toDateKey(input, timeZone)
  const parts = parseDateKey(dateKey)
  const calendarDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const dayOfWeek = calendarDate.getUTCDay()
  const offset = (dayOfWeek + 6) % 7

  return addDaysToDateKey(dateKey, -offset)
}

export function zonedDateTimeToUtc(
  dateKey,
  timeZone = DEFAULT_TIME_ZONE,
  { hour = 0, minute = 0, second = 0, millisecond = 0 } = {}
) {
  const normalizedTimeZone = normalizeTimeZone(timeZone)
  const parts = parseDateKey(dateKey)
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second, millisecond)
  const firstDate = new Date(utcGuess)
  const firstOffset = getTimeZoneOffsetMs(firstDate, normalizedTimeZone)
  let resolvedDate = new Date(utcGuess - firstOffset)
  const resolvedOffset = getTimeZoneOffsetMs(resolvedDate, normalizedTimeZone)

  if (resolvedOffset !== firstOffset) {
    resolvedDate = new Date(utcGuess - resolvedOffset)
  }

  return resolvedDate
}

export function isSameDateInTimeZone(left, right, timeZone = DEFAULT_TIME_ZONE) {
  return getDateKeyInTimeZone(left, timeZone) === getDateKeyInTimeZone(right, timeZone)
}

export function buildWeekWindow(referenceDate = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const normalizedTimeZone = normalizeTimeZone(timeZone)
  const dateKey = toDateKey(referenceDate, normalizedTimeZone)
  const startKey = getStartOfWeekDateKey(dateKey, normalizedTimeZone)
  const nextStartKey = addDaysToDateKey(startKey, 7)

  return {
    timeZone: normalizedTimeZone,
    dateKey,
    startKey,
    endKey: addDaysToDateKey(nextStartKey, -1),
    startAt: zonedDateTimeToUtc(startKey, normalizedTimeZone),
    nextStartAt: zonedDateTimeToUtc(nextStartKey, normalizedTimeZone)
  }
}
