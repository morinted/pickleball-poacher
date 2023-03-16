import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

// 11:15 am - 12:15 pm (Pickleball 50+) → dayjs('12:15 pm')
const getEndTime = (time) => {
  const endTimeString = time.split(/-/)?.[1]?.trim()?.split('(')[0]

  return dayjs(endTimeString, ['h:mm a', 'h a']).tz('America/New_York')
}

// Given "December 12", return the closest December 12 (looking at last year, this year, and next year).
const parseDay = (dateString, endOfDay) => {
  const now = dayjs()
  const date = dayjs(dateString, 'MMMM D')
  const years = [
    dayjs(date).subtract(1, 'year'),
    date,
    dayjs(date).add(1, 'year'),
  ]
  const nearest = years.reduce((nearest, candidate) => {
    const timeSinceNearest = Math.abs(now.diff(nearest))
    const timeSinceCandidate = Math.abs(now.diff(candidate))
    if (timeSinceCandidate < timeSinceNearest) return candidate
    return nearest
  })
  if (!endOfDay) return nearest
  return nearest.hour(23).minute(59)
}

export { dayjs, getEndTime, parseDay }
