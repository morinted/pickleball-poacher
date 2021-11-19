#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import Conf from 'conf'
import moment from 'moment-timezone'
import puppeteer from 'puppeteer'

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
    config.set('identities', [
      {
        uniqueEmail: 'email@example.com',
        uniquePhone: '6131231234',
        name: 'Your name',
      },
    ])
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
    (yargs) => {
      const config = new Conf()
      const register = async () => {
        const events = config.get('events')
        const identities = config.get('identities')
        const registrations = config.get('registrations', [])

        const now = moment.tz('America/Toronto')
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

        const browser = await puppeteer.launch()
        const results = Promise.all(
          targetEvents.map(async (targetEvent) => {
            const page = await browser.newPage()
            await page.goto(
              `https://reservation.frontdesksuite.ca/rcfs/${targetEvent.location}`,
              { waitUntil: 'networkidle0' }
            )

            const [button] = await page.$x(
              `//button[contains(., '${targetEvent.activity}')]`
            )
            if (!button) {
              return `Activity not found ${JSON.stringify(targetEvent)}`
            }
            await button.click()

            function getElementWithText(selector, text, root = document) {
              return [...root.querySelectorAll(selector).values()].find((el) =>
                el.textContent.includes(selector)
              )
            }

            getElementWithText('a', 'Pickleball')
            document.querySelector('input#reservationCount')
            const scheduleForDay = getElementWithText('.date', 'Wednesday')
            getElementWithText('a', '7:45', scheduleForDay) // Disabled: li.reserved
            document.querySelector('input#telephone')
            document.querySelector('input#email')
            const nameContainer = getElementWithText('label', 'Name')
            const nameInput = nameContainer.querySelector('input')
            document.querySelector('#submit-btn')

            await browser.close()
          })
        )
      }
    }
  )
  .parse()
