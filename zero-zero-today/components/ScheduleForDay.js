import React from 'react'
import { addDistance, locationsThatHaveDay, today } from './schedule'
import styles from './ScheduleForDay.module.css'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

export default function ScheduleForDay({ day, daysAway, latitude, longitude }) {
  const timezone = dayjs.tz.guess()
  const isToday = day === today
  const now = dayjs().tz(timezone)
  const locationsWithDistance = addDistance(
    locationsThatHaveDay(day),
    latitude,
    longitude,
    true
  )
  const warnRegistration = daysAway >= 2
  return (
    <div className={styles.card}>
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
              {startDate && (
                <note className={styles.caption}>Starting {startDate}</note>
              )}
              <ul>
                {location[day].map((time) => {
                  const endTimeString =
                    isToday &&
                    time
                      .split(/-/)?.[1]
                      ?.trim()
                      .replace(/\(.*\)/, '')
                  const endTime =
                    isToday && dayjs(endTimeString, ['h:mm a', 'h a']).tz('America/New_York')
                  const past = isToday && endTime.isBefore(now)
                  const inProgress =
                    isToday && !past && endTime.isBefore(now.add(1, 'hour'))
                  //if (isToday) console.log(time, { endTime, past, inProgress, now })
                  const className = `${inProgress ? styles.inprogress : ''} ${
                    past ? styles.past : ''
                  }`
                  //console.log(className)
                  return (
                    <li
                      key={time + className}
                      className={className}
                    >
                      {time.replace('(Pickleball)', '')}{className}
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
                Register{warnRegistration && '*'}
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
