import { daysStartingWithToday } from './schedule'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export const NavBar = () => {
  const router = useRouter()

  const [activeDay, setActiveDay] = useState('')
  useEffect(() => {
    setActiveDay(router.asPath.split('#')?.[1] ?? '')
  }, [router.asPath])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    let lastValue = null
    function handleResize() {
      const isMobile = window.innerWidth < 760
      if (isMobile !== lastValue) {
        setIsMobile(isMobile)
        lastValue = isMobile
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    var observer = new IntersectionObserver(onIntersection, {
      root: null,
      rootMargin: '-45% 0% -45% 0%',
      threshold: 0,
    })

    function onIntersection(entries) {
      if (entries[0].intersectionRatio <= 0) return
      const day = entries[0].target.getAttribute('id')
      setActiveDay(day)
    }

    // Use the observer to observe an element
    document
      .querySelectorAll('.day-card')
      .forEach((card) => observer.observe(card))
  }, [])
  return (
    <>
      <style jsx>
        {`
          nav {
            width: 100%;
            height: 3rem;
            display: flex;
            align-items: center;
            position: fixed;
            z-index: 1000;

            background: #1454b5;
            color: white;
          }

          @media (prefers-color-scheme: dark) {
            nav {
              background: #092f69;
              color: #e8e8e8;
            }
          }

          .spacer {
            height: 3rem;
            display: hidden;
          }

          h1 {
            margin: 0 1rem;
            padding: 0;
          }

          .day.active {
            border-bottom: 2px solid white;
            margin-bottom: -2px;
            text-shadow: 0px 0px 1px white;
          }
          .day {
            cursor: pointer;
            margin: 0 0.25rem;
          }
        `}
      </style>
      <nav>
        <h1>0-0-2day</h1>
        {daysStartingWithToday.map((day) => (
          <Link key={day} href={`/#${day}`} replace shallow>
            <div className={`day ${activeDay === day ? 'active' : ''}`}>
              {isMobile ? day.substring(0, 3) : day}
            </div>
          </Link>
        ))}
      </nav>
      <div className="spacer" />
    </>
  )
}
