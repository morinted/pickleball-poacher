import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import ScheduleForDay from '../components/ScheduleForDay'
import { daysStartingWithToday } from '../components/schedule'

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>0-0-2day</title>
        <meta name="description" content="Find City of Ottawa drop-in pickleball near me." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Zero zero today
        </h1>

        <p className={styles.description}>
          Find a game of pickleball in Ottawa, today.
        </p>

        <div className={styles.grid}>
          {daysStartingWithToday.map((day, index) => <ScheduleForDay key={day} day={day} daysAway={index} />)}
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
