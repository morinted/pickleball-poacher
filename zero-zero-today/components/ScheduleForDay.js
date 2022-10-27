import React from 'react'
import { addDistance, days, locationsThatHaveDay, today } from './schedule'
import styles from './ScheduleForDay.module.css'
import { getEndTime, dayjs } from './time'
import { TimeFormatter } from './TimeFormatter'
import { useRefresh } from './useRefresh'

export default function ScheduleForDay({ day, daysAway, latitude, longitude }) {
  useRefresh()
  const timezone = dayjs.tz.guess()
  const isToday = day === today
  const now = dayjs().tz(timezone)
  const locationsWithDistance = addDistance(
    locationsThatHaveDay(day),
    latitude,
    longitude,
    true
  )
  const warnRegistration = daysAway > 2 || daysAway === 2 && now.hour() < 18
  const registrationDay = days[(days.indexOf(day) + 7 - 2) % 7]
  const isWeekend = day === 'Saturday' || day === 'Sunday'
  return (
    <div className={`${styles.card} ${isWeekend ? styles.weekend : ''}`}>
      <h2>{day} in Ottawa</h2>
      {warnRegistration && (
        <div>
          *Registration only opens up 2 days before the event, at 6 p.m.
        </div>
      )}
      <div className={styles.container}>
        {locationsWithDistance.map((location) => {
          const [name, startDate] = location.name.split('starting')
          return (
            <div key={location.name} className={styles.location}>
              <h3>{name}</h3>
              {location.distance && (
                <p className={styles.distance}>
                  {location.distance.toFixed(1)} km
                </p>
              )}
              <note className={styles.caption}>{day}{startDate && ` (Starting ${startDate.trim()})`}</note>
              <ul>
                {location[day].map((time) => {
                  const { past, inProgress } = (() => {
                    if (!isToday) return { past: false, inProgress: false }
                    const endTime = getEndTime(time)
                    const past = endTime.isBefore(now)
                    const inProgress =
                      !past && endTime.isBefore(now.add(1, 'hour'))
                    return {
                      past,
                      inProgress,
                    }
                  })()
                  const className = `${inProgress ? styles.inprogress : ''} ${
                    past ? styles.past : ''
                  }`
                  return (
                    <li key={time + className} className={className}>
                      <TimeFormatter time={time} day={day} />
                      {/* This div forces an update which fixes a bug with SSR where time styles are no longer dynamic. */}
                      <div style={{ display: 'none' }}>{className}</div>
                    </li>
                  )
                })}
              </ul>
              <a
                className={styles.button}
                href={location.link}
                rel="noreferrer noopener"
                target="_blank"
              >
                Register {warnRegistration && <>at 6 pm {registrationDay === today ? 'today' : registrationDay}*</>}
              </a>
              <a
                className={styles.button}
                href={`https://google.com/maps?q=${location.address.replace(
                  /\s+/g,
                  '+'
                )}`}
                rel="noreferrer noopener"
                target="_blank"
              >
                Directions
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
