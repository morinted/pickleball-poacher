import axios from 'axios'
import cheerio from 'cheerio'
import moment from 'moment'
import YAML from 'yaml'
import args from 'args'
import { readFile, writeFile } from 'fs'

// One week          day hr   min  sec  ms
const NEW_TIMESLOT = 7 * 24 * 60 * 60 * 1000
const defaultDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const CAPTION_REGEX =
  /(starting|until|January|February|March|April|May|June|July|August|September|October|November|December)/i

const getPreviousTimes = async () => {
  return new Promise((resolve, reject) => {
    readFile('./cache/date-scraped.json', 'utf8', (err, data) => {
      if (err) reject(err)
      try {
        resolve(JSON.parse(data || '{}'))
      } catch (e) {
        resolve({})
      }
    })
  })
}
const getPreviousSchedule = async () => {
  return new Promise((resolve, reject) => {
    readFile('./cache/schedule.json', 'utf8', (err, data) => {
      if (err) reject(err)
      try {
        resolve(JSON.parse(data || '{}'))
      } catch (e) {
        resolve({})
      }
    })
  })
}

args
  .option('coordinates', 'Fetch coordinates of locations.', false)
  .option(
    'evenings-and-weekends',
    'Only return schedule of times in the evenings and weekends.',
    false
  )
  .option('debug', 'Log debug information.', false)
  .option('format', 'Output final list in JSON or YAML.', 'yaml', (value) => {
    if (value.startsWith('y')) return 'yaml'
    return 'json'
  })
  .option('outfile', 'File to write to, if not provided, log to console', '')

const flags = args.parse(process.argv)

const log = (...messages) => {
  if (!flags.debug) return
  console.log(...messages)
}

const eveningsAndWeekends = (day) => (time) => {
  if (/sat|sun/i.test(day)) return true

  const afternoon = time.includes('pm')
  if (!afternoon) return false

  const startTime = parseInt(time)
  return startTime !== 12 && startTime >= 5 && startTime < 10
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const coordinatesCache = {}
const addressWithoutPostalCode = (address) =>
  address.split(/\s+/).slice(0, -2).join(' ')
const cacheOldCoordinates = async () => {
  const schedule = await getPreviousSchedule()
  Object.keys(schedule).forEach((location) => {
    let { address, coordinates } = schedule[location]
    address = addressWithoutPostalCode(address)
    if (coordinates?.lat) {
      coordinatesCache[address] = coordinates
    }
  })
}
const fetchCoordinates = async (address) => {
  // Remove postal code as OSM has many disagreements with the source.
  address = addressWithoutPostalCode(address)
  if (coordinatesCache[address]) {
    log('using coordinates cache')
    return coordinatesCache[address]
  }
  log('not using coordinates cache')
  const addressQuery = encodeURI(address.replace(/\s+/g, '+'))

  const addressDetails = (
    await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${addressQuery}&format=json`
    )
  ).data

  const { lat, lon } = addressDetails[0]

  // Rate limit is once per second.
  await timeout(1000)
  coordinatesCache[address] = { lat, lon }
  return { lat, lon }
}

const facilityUrl =
  'https://ottawa.ca/en/recreation-and-parks/recreation-facilities/place-listing'
const ottawaCa = 'https://ottawa.ca'
async function main() {
  try {
    await cacheOldCoordinates()
    const centres = []
    let link = `${facilityUrl}?place_facets%5B0%5D=place_type%3A4208&place_facets%5B1%5D=place_type%3A4210`
    while (link) {
      const response = (await axios.get(link)).data
      const $ = cheerio.load(response)
      link = $('[title="Go to next page"]').attr('href')
      if (link) {
        link = `${facilityUrl}${link}`
      }
      centres.push(
        ...$('td.views-field.views-field-title a')
          .toArray()
          .map((el) => $(el).attr('href'))
          .map((link) => (link.startsWith('/') ? `${ottawaCa}${link}` : link))
          .filter((link) => link.includes('recreation-facilities'))
      )
    }
    log('About to scrape', centres.length, 'centres.')
    const results = (
      await Promise.all(
        centres.map(async (centre) => {
          const centreResponse = await axios.get(centre)
          const $ = cheerio.load(centreResponse.data)
          const location = $('h1').text().trim()
          const link = $('a:contains("Reserve")').attr('href')
          const home = centre
          const streetAddress = $('.address-link.address-details').text().trim()
          const addressDetails = $(
            '.address-link.address-details + .address-details'
          )
            .text()
            .trim()
          const address = `${streetAddress} ${addressDetails}`
            .split(/\s+/g)
            .join(' ')

          const activities = $('tr:contains("Pickleball")')
            .toArray()
            .map((element) => {
              const table = $(element).parents('table')
              const getDays = () => {
                const thead = $('thead tr th', table)
                const firstRow = $('tbody tr:first-of-type td', table)
                const dayRow = thead.text().includes('Monday')
                  ? thead
                  : firstRow.text().includes('Monday')
                  ? firstRow
                  : null
                if (!dayRow) return defaultDays
                return dayRow
                  .toArray()
                  .map((el) => $(el).text().trim())
                  .filter((x) => x)
              }
              const days = getDays()
              let caption = table.find('caption').text()

              caption = CAPTION_REGEX.test(caption)
                ? caption.slice(caption.search(CAPTION_REGEX))
                : null
              const headName = $('th', element).text().replace(/\s+/g, ' ')
              const activityIsHead = !!headName
              const activity =
                headName ||
                $('td:first-of-type', element).text().replace(/\s+/g, ' ')

              const schedules = $('td', element)
                .toArray()
                .map((day, index) => {
                  const actualIndex = index - (activityIsHead ? 0 : 1)
                  const schedule = $(day)
                    .text()
                    .toLowerCase()
                    .replace(/noon/g, '12 pm')
                    .replace(/–/g, '-') // Remove endash.
                    .replace(/([^ ])-([^ ])/g, '$1 - $2') // Ensure spaces around time.
                    .split(/(,|\n+|,)/)
                    .map((time) => time.trim())
                    .filter((time) => !isNaN(parseInt(time)))
                    .filter(
                      flags.e
                        ? eveningsAndWeekends(days[actualIndex])
                        : () => true
                    )
                  return { day: days[actualIndex], schedule }
                })
                .reduce((result, current) => {
                  if (current.schedule.length) {
                    result[current.day] = current.schedule
                  }
                  return result
                }, {})
              return {
                location: [location, caption].filter((x) => x).join(' '),
                link,
                home,
                address,
                activity,
                schedules,
              }
            })
            .filter((x) => JSON.stringify(x.schedules) !== '{}')
          return activities
        })
      )
    ).flatMap((x) => x)

    if (flags.coordinates) {
      for (const activitySchedule of results) {
        const coordinates = await fetchCoordinates(activitySchedule.address)
        activitySchedule.coordinates = coordinates
      }
    }

    const resultsByLocation = results.reduce((acc, activitySchedule) => {
      const location = {
        link: activitySchedule.link,
        home: activitySchedule.home,
        address: activitySchedule.address,
        coordinates: activitySchedule.coordinates,
      }
      defaultDays.forEach((day) => {
        const daySchedule = [
          ...(acc[activitySchedule.location]?.[day] || []),
          ...(activitySchedule.schedules[day] || []).map(
            // Fix `2: 45 pm` --> `2:45 pm`
            (time) =>
              `${time.replace(
                / ?: ?/g,
                ':'
              )} (${activitySchedule.activity.trim()})`
          ),
        ].sort((a, b) => {
          const getTime = (x) =>
            moment(
              x
                .split(/[–-]/)[1]
                .substring(0, Math.max(x.indexOf('am'), x.indexOf('pm') + 2))
                .trim(),
              ['h:mm a', 'h a']
            )
          return getTime(a) - getTime(b)
        })
        if (daySchedule.length) {
          location[day] = daySchedule
        }
      })
      acc[activitySchedule.location] = location
      return acc
    }, {})

    const { stringify } =
      flags.format === 'json'
        ? { stringify: (value) => JSON.stringify(value, null, 2) }
        : YAML
    const newTimes = buildDateTable(await getPreviousTimes(), resultsByLocation)
    for (const key in newTimes) {
      if (Date.now() - newTimes[key] < NEW_TIMESLOT) {
        log('new!')
        const [shortLocation, day, time] = key.split('|')
        Object.keys(resultsByLocation).forEach((location) => {
          if (!location.includes(shortLocation))
            return log('does not include short')
          if (!resultsByLocation[location]?.[day]) return log('no day...')
          resultsByLocation[location][day] = resultsByLocation[location][
            day
          ].map((startEnd) => {
            if (startEnd.startsWith(time)) return `${startEnd}*`
            return startEnd
          })
        })
      }
    }
    writeFile(
      './cache/date-scraped.json',
      JSON.stringify(newTimes, null, 2),
      'utf8',
      () => {}
    )
    if (flags.outfile) {
      writeFile(flags.outfile, stringify(resultsByLocation), 'utf8', () => {})
    } else {
      console.log(stringify(resultsByLocation))
    }
  } catch (e) {
    console.error(e)
  }
}

/**
 * Store the time and location pair along with the date it was first scraped. This will make highlighting new entries possible.
 */
export function buildDateTable(previous, current) {
  const result = {}
  for (const locationName in current) {
    const captionIndex = locationName.search(CAPTION_REGEX)
    const name = locationName.slice(0, captionIndex).trim()
    const location = current[locationName]
    for (const day of defaultDays) {
      const times = location[day]
      if (!times) continue
      for (const time of times) {
        const timeWithoutActivity = time.split(' (')[0]
        const key = `${name}|${day}|${timeWithoutActivity}`
        const olderDate = previous[key] || Date.now()
        result[key] = olderDate
      }
    }
  }
  return result
}

main()
