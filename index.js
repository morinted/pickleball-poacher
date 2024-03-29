#!/usr/bin/env node

import yargs from 'yargs'
import fetch from 'node-fetch'
import { hideBin } from 'yargs/helpers'
import Conf from 'conf'
import moment from 'moment-timezone'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'
import _ from 'lodash'

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
    config.set('identities', [
      {
        email: 'email@example.com',
        phone: '6131231234',
        name: 'Your name',
      },
    ])
    config.set('registrations', [])
    config.set('2captcha-token', '')
    config.set('telegram-bot', '')
    config.set('telegram-channel', '')
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
        const identities = config.get('identities')
        const registrations = config.get('registrations', [])
        const telegramBotKey = config.get('telegram-bot')
        const telegramChannel = config.get('telegram-channel')

        const afterSix = now.hour() >= ROLLOVER_TIME
        const almostSix =
          now.clone().add(CLOSE_MINUTES, 'minutes').hour() === ROLLOVER_TIME &&
          now.hour() === ROLLOVER_TIME - 1

        const timeSinceSix = now.diff(
          moment().hour(ROLLOVER_TIME).minute(0).second(0),
          'minutes'
        )
        const justAfterSix = 0 <= timeSinceSix && timeSinceSix <= 5

        const day = now.day()
        const registerableDays = [
          day,
          day + 1,
          ...(afterSix || almostSix ? [day + 2] : []),
        ].map((dayNumber) => moment().day(dayNumber).format('dddd'))

        const telegramQueue = []
        const sendToTelegram = _.debounce(() => {
          // Clear the queue and get the removed elements to send.
          const message = telegramQueue
            .splice(0, telegramQueue.length)
            .join('\n')

          fetch(
            `https://api.telegram.org/bot${telegramBotKey}/sendMessage?chat_id=${encodeURIComponent(
              telegramChannel
            )}&text=${encodeURIComponent(message)}`
          )
        }, 500)
        const logToTelegram = (...messages) => {
          const toSend = messages.join(' ')
          if ((almostSix || justAfterSix) && telegramBotKey) {
            telegramQueue.push(toSend)
            sendToTelegram()
          }
          return toSend
        }

        const targetEvents = events.flatMap((event) => {
          const {
            day,
            time,
            location,
            activity,
            spots,
            name,
            phone,
            email,
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
                registration.activity === activity &&
                registration.name === name &&
                registration.phone === phone &&
                registration.email === email
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
          let registerString = []
          registerString.push('\nRegistering for:\n')
          registerString.push(
            targetEvents
              .map((event, index) => `[${index + 1}] ${eventToString(event)}`)
              .join('\n')
          )
          registerString.push('\nGo! 🏁\n')
          registerString = registerString.join('\n')
          console.log(logToTelegram(registerString))
        } else {
          console.log(logToTelegram('No unbooked events found.'))
          return
        }

        const browser = await puppeteer.launch()

        // Run one registration per tab.
        const results = await Promise.allSettled(
          targetEvents.map(async (targetEvent, index) => {
            const log = (...messages) => {
              const output = [getJobName(index), timestamp(), ...messages]
              console.log(...output)
            }
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
              if (almostSix) {
                while (moment.tz('America/Toronto').hour() < ROLLOVER_TIME) {
                  log('Waiting for 6 PM...')
                  await waitFor(5000)
                }
                log("Happy six o'clock, let's go!")
                logToTelegram('It is six, time to go!')
              }

              log('Clicking activity link')
              await activityLink.click()
              await page.waitForNavigation({ waitUntil: 'networkidle0' })

              // maxSpots of 1 means that we won't be asked for group size, so skip this page.
              if (targetEvent.maxSpots !== 1) {
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
              }

              await page.waitForSelector('.date')
              log('Clicking date time')

              const isButtonClicked = await page.evaluate(
                (day, time) => {
                  const targetDay = [
                    ...document.querySelectorAll('.date'),
                  ].find((daySection) => daySection.textContent.includes(day))
                  const targetTime = [
                    ...targetDay.querySelectorAll('.times-list li'),
                  ]
                    .reverse()
                    .find((timeLink) => timeLink.textContent.includes(time))

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
                await page.keyboard.type(targetEvent.phone || phone, {
                  delay: 50,
                })
                await page.focus('input#email')
                await page.keyboard.type(targetEvent.email || email, {
                  delay: 50,
                })
                await page.keyboard.press('Tab')
                await page.keyboard.type(targetEvent.name || name, {
                  delay: 50,
                })
                await waitFor(1000)
                if (token) {
                  log('Looking for and solving captchas')
                  await page.solveRecaptchas()
                }
                await page.click('#submit-btn')
                await page.waitForNavigation({ waitUntil: 'networkidle0' })
              }

              await inputForm(identities[index % identities.length])

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
              return targetEvent
            } finally {
              await page.close()
            }
          })
        )

        const resultsString = []
        resultsString.push('\nResults:\n')
        const newRegistrations = results.flatMap((result, index) => {
          const { status, value, reason } = result
          const jobName = getJobName(index)
          if (status === 'rejected') {
            resultsString.push(
              [
                jobName,
                'Failure:',
                reason.message,
                `(${eventToString(targetEvents[index])})`,
              ].join(' ')
            )
            return []
          }
          resultsString.push(
            [jobName, 'Success! Registered for:', eventToString(value)].join(
              ' '
            )
          )
          return [
            {
              ...value,
              date: formatEventMoment(getEventMoment(value)),
            },
          ]
        })

        console.log(logToTelegram(resultsString.join('\n')))
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

          if (moment().diff(scriptStart, 'hours', true) > limit) {
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
