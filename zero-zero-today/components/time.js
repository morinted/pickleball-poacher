import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

// 11:15 am - 12:15 pm (Pickleball 50+) → dayjs('12:15 pm')
const getEndTime = (time) => {
  const endTimeString =
    time
      .split(/-/)?.[1]
      ?.trim()
      .replace(/\(.*\)/, '')
  return dayjs(endTimeString, ['h:mm a', 'h a']).tz('America/New_York')
}

export { dayjs, getEndTime }