// Time helpers for the tournament timezone.
//
// Match datetimes are stored as naive strings ('YYYY-MM-DDTHH:mm:ss') meant as
// Dutch wall-clock time (Europe/Amsterdam, CET/CEST). A Docker/HA container runs
// in UTC by default, so parsing those strings with `new Date()` would shift them
// by 1-2 hours — making prediction locks fire well after kickoff.
//
// To stay correct regardless of the host/container timezone, we never parse the
// stored strings into instants for comparison. Instead we render "now" as a naive
// Amsterdam wall-clock string in the exact same format and compare strings
// lexically (which, for fixed-width zero-padded timestamps, equals chronological
// order). The conversion uses Intl with an explicit timeZone, which relies on
// Node's bundled ICU data — independent of the system TZ.

const TZ = 'Europe/Amsterdam'

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

// Current Amsterdam wall-clock time (plus optional offset) as 'YYYY-MM-DDTHH:mm:ss'.
export function nowNaive(offsetMs = 0) {
  const parts = formatter.formatToParts(new Date(Date.now() + offsetMs))
  const get = (type) => parts.find((p) => p.type === type)?.value
  let hour = get('hour')
  if (hour === '24') hour = '00' // some ICU builds emit 24 for midnight
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`
}

// Naive Amsterdam-day bounds for "today" as { start, end } strings.
export function todayNaiveRange() {
  const day = nowNaive().slice(0, 10) // 'YYYY-MM-DD'
  return { start: `${day}T00:00:00`, end: `${day}T23:59:59` }
}
