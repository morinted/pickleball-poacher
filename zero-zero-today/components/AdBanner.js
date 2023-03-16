import styles from './ScheduleForDay.module.css'

export function AdBanner() {
  return (
    <div className={styles.card}>
      <h2>News</h2>
      <p>Do you organize social pickleball play?</p>
      <p>
        I've made another <em>completely free</em> site to fairly shuffle
        players between games.
      </p>
      <p>
        <a
          style={{ marginTop: '0.5rem' }}
          className={styles.button}
          href="https://jumbleddoubles.com"
          rel="noreferrer noopener"
          target="_blank"
        >
          Try Jumbled Doubles 🎉
        </a>
      </p>
    </div>
  )
}
