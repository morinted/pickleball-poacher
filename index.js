#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import Conf from 'conf'
import moment from 'moment-timezone'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'

const getJobName = (index) => `[${index + 1}]`
const getEventMoment = ({ day, time }) => {
  const event = moment.tz(time, ['h:m A', 'h:m'], 'America/Toronto')
  // Make sure we're always beginning on the same day as today.
  if (event.day() !== moment().day()) event.subtract(1, 'day')
  // Set day.
  event.day(day)
  // If the event is on an "earlier" day of the week *and* is in the past, that means it's next week.
  if (event.day() < moment().day() && event.isBefore(moment())) {
    // Add 1 week if the day is before today in the week so that it's next week's day.
    event.add(1, 'week')
  }
  return event
}
const eventToString = ({ day, location, activity, time, spots }) =>
  `${day} ${time} - ${spots} for ${activity} at ${location}`
const formatEventMoment = (eventMoment) =>
  eventMoment.format('YYYY/MM/DD h:mm a')
const waitFor = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
const timestamp = () => `[${moment().format('HH:mm:ss')}]`

/**
 * If the rollover time for the day is within this many minutes, we will wait before trying to register further.
 */
const CLOSE_MINUTES = 10
/**
 * The events rollover at 6 PM, 2 days before the event.
 */
const ROLLOVER_TIME = 18

yargs(hideBin(process.argv))
  .command('init', 'create a default config file', () => {
    const config = new Conf()
    config.set('events', [
      {
        day: 'Wednesday',
        location: 'hintonburgcc',
        time: '6:00',
        activity: 'Pickleball',
        spots: 1,
      },
    ])
    config.set('identity', {
      email: 'email@example.com',
      phone: '6131231234',
      name: 'Your name',
    })
    config.set('registrations', [])
    config.set('2captcha-token', '')
    console.log(`Config file created! Edit it at ${config.path}`)
  })
  .command('config', 'show the path to the config file', () => {
    console.log(new Conf().path)
  })
  .command(
    'register [interval] [limit]',
    'repeatedly try to register for events',
    (yargs) => {
      return yargs
        .positional('interval', {
          describe: 'the interval in seconds to retry when sessions are filled',
          default: '300',
        })
        .positional('limit', {
          describe: 'the time limit in hours to retry for',
          default: '23.75',
        })
    },
    ({ interval, limit }) => {
      interval = parseFloat(interval)
      limit = parseFloat(limit)
      const scriptStart = moment()
      const config = new Conf()
      const token = config.get('2captcha-token')

      puppeteer.use(StealthPlugin())
      if (token) {
        puppeteer.use(
          RecaptchaPlugin({
            provider: { id: '2captcha', token },
          })
        )
      }

      /** Main recursive loop. */
      const register = async () => {
        // Take a break overnight.
        const now = moment.tz('America/Toronto')

        console.log('----')
        console.log('Time:', now.format('YYYY-MM-DD hh:mm:ss a'))

        const events = config.get('events')
        const identity = config.get('identity')
        const registrations = config.get('registrations', [])

        const afterSix = now.hour() >= ROLLOVER_TIME
        const closeToSix =
          now.clone().add(CLOSE_MINUTES, 'minutes').hour() === ROLLOVER_TIME &&
          now.hour() === ROLLOVER_TIME - 1
        const day = now.day()
        const registerableDays = [
          day,
          day + 1,
          ...(afterSix || closeToSix ? [day + 2] : []),
        ].map((dayNumber) => moment().day(dayNumber).format('dddd'))

        const targetEvents = events.flatMap((event) => {
          const {
            day,
            time,
            location,
            activity,
            spots,
            maxSpots = event.spots,
          } = event
          const validDay = registerableDays.includes(day)
          const eventMoment = getEventMoment({ day, time })
          const date = formatEventMoment(eventMoment)

          if (!validDay || eventMoment.isBefore(now)) return []

          const spotsAlreadyBooked = registrations.reduce(
            (sum, registration) => {
              const eventMatches =
                registration.date === date &&
                registration.location === location &&
                registration.activity === activity
              if (!eventMatches) return sum
              return sum + registration.spots
            },
            0
          )

          const spotsToBook = spots - spotsAlreadyBooked

          // All required spots filled.
          if (spotsToBook <= 0) return []

          const eventCount = Math.ceil(spotsToBook / maxSpots)

          // Split the event into multiple based on what needs remain.
          return Array.from(new Array(eventCount), (_, index) => ({
            ...event,
            spots:
              index < eventCount - 1
                ? maxSpots
                : spotsToBook - maxSpots * index,
          }))
        })
        if (targetEvents.length) {
          console.log('\nRegistering for:\n')
          console.log(
            targetEvents
              .map((event, index) => `[${index + 1}] ${eventToString(event)}`)
              .join('\n')
          )
          console.log('\nGo! 🏁\n')
        } else {
          console.log('No unbooked events found.')
          return
        }

        const browser = await puppeteer.launch()

        // Run one registration per tab.
        const results = await Promise.allSettled(
          targetEvents.map(async (targetEvent, index) => {
            const log = (...messages) =>
              console.log(getJobName(index), timestamp(), ...messages)
            const context = await browser.createIncognitoBrowserContext()
            const page = await context.newPage()
            // Allow up to 2 minutes for slow site.
            await page.setDefaultTimeout(120000)

            async function setValue(selector, value) {
              page.evaluate(
                ({ selector, value }) => {
                  return (document.querySelector(selector).value = value)
                },
                { selector, value }
              )
            }
            try {
              await page.goto(
                `https://reservation.frontdesksuite.ca/rcfs/${targetEvent.location}`,
                { waitUntil: 'networkidle0' }
              )

              const [activityLink] = await page.$x(
                `//a[contains(., '${targetEvent.activity}')]`
              )
              if (!activityLink) {
                throw new Error(
                  `Activity not found ${JSON.stringify(targetEvent)}`
                )
              }

              // If we are near 6 PM but not quite there, delay checking for spots until 6.
              if (closeToSix) {
                while (moment.tz('America/Toronto').hour() < ROLLOVER_TIME) {
                  log('Waiting for 6 PM...')
                  await waitFor(5000)
                }
                log("Happy six o'clock, let's go!")
              }

              log('Clicking activity link')
              await activityLink.click()
              await page.waitForNavigation({ waitUntil: 'networkidle0' })

              // When the input is missing, it means there are no remaining times.
              const inputPresent = !!(await page.$(
                'input#reservationCount[type="number"]'
              ))

              if (!inputPresent) {
                throw new Error('No time left')
              }

              log('Setting group size')
              await setValue('input#reservationCount', targetEvent.spots)
              await page.click('#submit-btn')
              await page.waitForSelector('.date')
              log('Clicking date time')

              const isButtonClicked = await page.evaluate(
                (day, time) => {
                  const targetDay = [
                    ...document.querySelectorAll('.date'),
                  ].find((daySection) => daySection.textContent.includes(day))
                  const targetTime = [
                    ...targetDay.querySelectorAll('.times-list li'),
                  ].find((timeLink) => timeLink.textContent.includes(time))

                  if (!targetTime) {
                    throw new Error(
                      'Could not find time button, maybe the time changed?'
                    )
                  }
                  // Greyed-out button.
                  const isFull = targetTime.classList.contains('reserved')
                  if (isFull) return false

                  // Get nested link and click it.
                  targetTime.querySelector('a').click()
                  return true
                },
                targetEvent.day,
                targetEvent.time
              )
              if (!isButtonClicked) throw new Error('time slot full')

              const inputForm = async ({ phone, email, name }) => {
                log('Waiting for form to load')
                await page.waitForNavigation({ waitUntil: 'networkidle0' })
                await page.waitForSelector('input#telephone')
                log('Filling form')
                await page.focus('input#telephone')
                await page.keyboard.type(phone, { delay: 50 })
                await page.focus('input#email')
                await page.keyboard.type(email, { delay: 50 })
                await page.keyboard.press('Tab')
                await page.keyboard.type(name, { delay: 50 })
                await waitFor(1000)
                if (token) {
                  log('Looking for and solving captchas')
                  await page.solveRecaptchas()
                }
                await page.click('#submit-btn')
                await page.waitForNavigation({ waitUntil: 'networkidle0' })
              }

              await inputForm(identity)

              const url = await page.url()

              // New summary page before confirming.
              if (url.toLowerCase().includes('summarypage')) {
                await page.click('#submit-btn')
                await page.waitForNavigation({ waitUntil: 'networkidle0' })
              }

              const success = !!(await page.$('.confirmed-reservation'))
              if (!success) {
                await page.screenshot({
                  path: moment().format('YYYY-MM-DD_HH-mm') + '-error.png',
                })
                throw new Error('No confirmation page!')
              }
              return { ...targetEvent, phone: identity.phone }
            } finally {
              await page.close()
            }
          })
        )

        console.log('\nResults:\n')
        const newRegistrations = results.flatMap((result, index) => {
          const { status, value, reason } = result
          const jobName = getJobName(index)
          if (status === 'rejected') {
            console.log(
              jobName,
              'Failure:',
              reason.message,
              `(${eventToString(targetEvents[index])})`
            )
            return []
          }
          console.log(jobName, 'Success! Registered for:', eventToString(value))
          return [
            {
              ...value,
              date: formatEventMoment(getEventMoment(value)),
            },
          ]
        })
        config.set('registrations', [...registrations, ...newRegistrations])
        await browser.close()

        // If we didn't register everything, try again.
        const failures = results.filter(
          (result) => result.status === 'rejected'
        )
        if (failures.length) {
          const submitFailed = failures.some((failure) =>
            failure.reason.message.includes('confirmation')
          )
          const timeoutError = failures.some((failure) =>
            failure.reason.message.includes('timeout')
          )
          const retry = submitFailed || timeoutError
          if (retry) {
            console.log(
              timestamp(),
              'Retrying immediately due to failure type.'
            )
            register()
            return
          }

          if (scriptStart.diff(moment(), 'hours', true) > limit) {
            return
          }
          const afterTen = now.hour() >= 22
          const beforeEight = now.hour() < 8
          if (afterTen || beforeEight) {
            const randomInterval = Math.random() * (45 - 15) + 15
            console.log(
              '\nIt is night time, so we will wait',
              Math.round(randomInterval),
              'minutes.\n'
            )
            await waitFor(1000 * 60 * randomInterval)
          } else {
            await waitFor(interval * 1000)
          }
          register()
        }
      }
      register()
    }
  )
  .parse()
