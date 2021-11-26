#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import Conf from 'conf'
import moment from 'moment-timezone'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const getEventMoment = ({ day, time }) =>
  moment.tz(time, ['h:m a', 'H:m'], 'America/Toronto').day(day)
const formatEventMoment = (eventMoment) =>
  eventMoment.format('YYYY/MM/DD h:mm a')

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
      puppeteer.use(StealthPlugin())
      const config = new Conf()

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
            const page = await browser.newPage()

            async function setValue(selector, value) {
              page.evaluate(
                ({ selector, value }) => {
                  return (document.querySelector(selector).value = value)
                },
                { selector, value }
              )
            }

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
            await page.waitForNavigation()

            await setValue('input#reservationCount', targetEvent.spots)
            await page.click('#submit-btn')
            await page.waitForNavigation()

            await page.evaluate(
              (day, time) =>
                [
                  ...[...document.querySelectorAll('.date')]
                    .find((daySection) => daySection.textContent.includes(day))
                    .querySelectorAll('.times-list a'),
                ]
                  .find((timeLink) => timeLink.textContent.includes(time))
                  .click(),
              targetEvent.day,
              targetEvent.time
            )
            await page.waitForNavigation()

            const inputForm = async ({ phone, email, name }) => {
              await page.waitForSelector('input#telephone')
              await page.focus('input#telephone')
              await page.keyboard.type(phone)
              await page.focus('input#email')
              await page.keyboard.type(email)
              await page.keyboard.press('Tab')
              await page.keyboard.type(name)
              await page.click('#submit-btn')
              await page.waitForNavigation()
            }

            // TODO: handle duped email and resubmit.
            await inputForm(identity)

            const url = await page.url()
            const success = url.toLowerCase().includes('confirmationpage')
            await page.close()
            return { ...targetEvent, success, phone: identity.phone }
          })
        )

        const newRegistrations = results.flatMap((result) => {
          const { success, ...targetEvent } = result
          if (!success) {
            return []
          }
          return [
            {
              ...targetEvent,
              date: formatEventMoment(getEventMoment(targetEvent)),
            },
          ]
        })
        config.set('registrations', [...registrations, ...newRegistrations])
        await browser.close()

        // If we didn't register everything, try again.
        if (results.length > newRegistrations) {
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
