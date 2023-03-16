import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import ScheduleForDay from '../components/ScheduleForDay'
import { daysStartingWithToday } from '../components/schedule'
import { usePosition } from 'use-position'
import { dayjs } from '../components/time'
import { NavBar } from '../components/NavBar'
import { AdBanner } from '../components/AdBanner'

export default function Home() {
  const { latitude, longitude, error } = usePosition()
  const locationStatus = latitude ? 'success' : error ? 'error' : 'loading'
  const timezone = dayjs.tz.guess()
  const now = dayjs().tz(timezone)
  return (
    <div className={styles.container}>
      <Head>
        <title>0-0-2day</title>
        <meta
          name="description"
          content="Find City of Ottawa drop-in pickleball near me."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <NavBar />
      <main className={styles.main}>
        <p className={styles.description}>
          Find a game of pickleball in Ottawa, today.
        </p>

        {locationStatus === 'error' && (
          <p>
            <strong>Note:</strong> If you enable location, locations will be
            listed in order closest to you.
          </p>
        )}
        {locationStatus === 'loading' && (
          <p>
            <i>📍 Loading your location&hellip;</i>
          </p>
        )}

        <div className={styles.grid}>
          <AdBanner />
          {daysStartingWithToday.map((day, index) => (
            <ScheduleForDay
              latitude={latitude}
              longitude={longitude}
              key={day}
              day={day}
              daysAway={index}
              now={now}
            />
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  )
}
