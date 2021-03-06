import axios from 'axios'
import cheerio from 'cheerio'
import moment from 'moment'

const returnOnlyEveningsAndWeekends = true
const defaultDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const eveningsAndWeekends = (day) => (time) => {
  if (/sat|sun/i.test(day)) return true

  const afternoon = time.includes('pm')
  if (!afternoon) return false

  const startTime = parseInt(time)
  return startTime !== 12 && startTime >= 5 && startTime < 10
}

async function main() {
  try {
    const response = await axios.get(
      'https://ottawa.ca/en/recreation-and-parks/recreation-and-cultural-programs/drop-activities'
    )
    let $ = cheerio.load(response.data)
    const centres = $(
      'article:contains("Recreation centres and complexes") ul li a'
    )
      .toArray()
      .map((el) => $(el).attr('href'))
      .map((link) => (link.startsWith('/') ? `https://ottawa.ca${link}` : link))
      .filter((link) => link.includes('recreation-and-parks'))

    const results = (
      await Promise.all(
        centres.map(async (centre) => {
          const centreResponse = await axios.get(centre)
          $ = cheerio.load(centreResponse.data)
          const location = $('h1').text().trim()
          const days = $('thead tr th')
            .toArray()
            .map((el) => $(el).text())

          const activities = $('tr:contains("Pickleball")')
            .toArray()
            .map((element) => {
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
                    .split(',')
                    .map((time) => time.trim())
                    .filter((time) => !isNaN(parseInt(time)))
                    .filter(
                      returnOnlyEveningsAndWeekends
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
              return { location, activity, schedules }
            })
            .filter((x) => JSON.stringify(x.schedules) !== '{}')
          return activities
        })
      )
    ).flatMap((x) => x)

    const resultsByLocation = results.reduce((acc, activitySchedule) => {
      const location = {}
      defaultDays.forEach((day) => {
        const daySchedule = [
          ...(acc[activitySchedule.location]?.[day] || []),
          ...(activitySchedule.schedules[day] || []).map(
            (time) => `${time} (${activitySchedule.activity})`
          ),
        ].sort((a, b) => {
          const getTime = (x) =>
            moment(
              x
                .split(/[???-]/)[1]
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

    console.log(JSON.stringify(resultsByLocation, null, 2))
  } catch (e) {
    console.error(e.message)
  }
}

main()
