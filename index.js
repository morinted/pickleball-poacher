#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import Conf from 'conf'
import moment from 'moment-timezone'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'

const getEventMoment = ({ day, time }) =>
  moment.tz(time, ['h:m A', 'h:m'], 'America/Toronto').day(day)
const formatEventMoment = (eventMoment) =>
  eventMoment.format('YYYY/MM/DD h:mm a')
const waitFor = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

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
  .command(
    'register [interval] [limit]',
    'repeatedly try to register for events',
    (yargs) => {
      return yargs
        .positional('interval', {
          describe: 'the interval in seconds to retry when sessions are filled',
          default: 300,
        })
        .positional('limit', {
          describe: 'the time limit in hours to retry for',
          default: 23.75,
        })
    },
    ({ interval, limit }) => {
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
        const afterTen = now.hour() >= 22
        const beforeEight = now.hour() < 8
        if (afterTen || beforeEight) {
          return setTimeout(register, 1000 * 60 * 30)
        }

        const events = config.get('events')
        const identity = config.get('identity')
        const registrations = config.get('registrations', [])

        const afterSix = now.hour() >= 18
        console.log('now hour', now.hour())
        const day = now.day()
        const registerableDays = [
          day,
          day + 1,
          ...(afterSix ? [day + 2] : []),
        ].map((dayNumber) => moment().day(dayNumber).format('dddd'))

        const targetEvents = events.filter(
          ({ day, time, location, activity }) => {
            const validDay = registerableDays.includes(day)
            const eventMoment = getEventMoment({ day, time })
            const date = formatEventMoment(eventMoment)
            const eventAlreadyBooked = registrations.some(
              (registration) =>
                registration.date === date &&
                registration.location === location &&
                registration.activity === activity
            )
            return validDay && eventMoment.isAfter(now) && !eventAlreadyBooked
          }
        )
        console.log('registering', targetEvents)

        const browser = await puppeteer.launch()

        // Run one registration per tab.
        const results = await Promise.allSettled(
          targetEvents.map(async (targetEvent) => {
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
              await activityLink.click()
              await page.waitForNavigation({ waitUntil: 'networkidle0' })

              // When the input is missing, it means there are no remaining times.
              const inputPresent = !!(await page.$(
                'input#reservationCount[type="number"]'
              ))
              console.log('reservation count input?', inputPresent)
              if (!inputPresent) {
                throw new Error('No time left')
              }

              await setValue('input#reservationCount', targetEvent.spots)
              await page.click('#submit-btn')
              await page.waitForSelector('.date')

              const isButtonClicked = await page.evaluate(
                (day, time) => {
                  const targetDay = [
                    ...document.querySelectorAll('.date'),
                  ].find((daySection) => daySection.textContent.includes(day))
                  const targetTime = [
                    ...targetDay.querySelectorAll('.times-list li'),
                  ].find((timeLink) => timeLink.textContent.includes(time))

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
                await page.waitForSelector('input#telephone')

                if (token) {
                  console.log('solving captchas with token:', token)
                  await page.solveRecaptchas()
                }

                await page.focus('input#telephone')
                await page.keyboard.type(phone, { delay: 50 })
                await page.focus('input#email')
                await page.keyboard.type(email, { delay: 50 })
                await page.keyboard.press('Tab')
                await page.keyboard.type(name, { delay: 50 })
                await waitFor(1000)

                await page.click('#submit-btn')
                await page.waitForNavigation({ waitUntil: 'networkidle0' })
              }

              // TODO: handle duped email and resubmit.
              await inputForm(identity)

              const url = await page.url()
              const success = url.toLowerCase().includes('confirmationpage')
              if (!success) {
                throw new Error('No confirmation page!')
              }
              return { ...targetEvent, phone: identity.phone }
            } finally {
              await page.close()
            }
          })
        )

        const newRegistrations = results.flatMap((result) => {
          const { status, value, reason } = result
          if (status === 'rejected') {
            console.log('Failure:', reason)
            return []
          }
          console.log('saving', value)
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
        if (results.some((result) => result.status === 'rejected')) {
          if (scriptStart.diff(moment(), 'hours', true) > limit) {
            return
          }
          setTimeout(() => register(), interval * 1000)
        }
      }
      register()
    }
  )
  .parse()
