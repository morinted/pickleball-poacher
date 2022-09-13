import React from 'react'
import { locationsThatHaveDay } from './schedule'
import styles from './ScheduleForDay.module.css'

export default function ScheduleForDay({ day, daysAway }) {
  const warnRegistration = daysAway >= 2
  return (
    <div className={styles.card}>
      <h2>{day} in Ottawa</h2>
      {warnRegistration && <div>*Registration only opens up 2 days before the event, at 6 p.m.</div>}
      <div className={styles.container}>
        {locationsThatHaveDay(day).map((location) => {
          const [name, startDate] = location.name.split('starting')
          return (
            <div key={location.name} className={styles.location}>
              <h3>{name}</h3>
              {startDate && <note className={styles.caption}>Starting {startDate}</note>}
              <ul>
                {location[day].map((time) => (
                  <li key={time}>{time.replace('(Pickleball)', '')}</li>
                ))}
              </ul>
              <a className={styles.button} href={location.link} rel='noreferrer noopener' target='_blank'>Register{warnRegistration && '*'}</a>
              <a className={styles.button} href={`https://google.com/maps?q=${location.address.replace(/\s+/g, '+')}`} rel='noreferrer noopener' target='_blank'>Directions</a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
