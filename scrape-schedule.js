import axios from 'axios'
import cheerio from 'cheerio'

const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const returnOnlyEveningsAndWeekends = true

const eveningsAndWeekends = (day) => (time) => {
  if (day >= days.indexOf('Saturday')) return true

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
          const activities = $('tr:contains("Pickleball")')
            .toArray()
            .map((element) => {
              const activity = $('th', element).text().replace(/\s+/g, ' ')
              const schedules = $('td', element)
                .toArray()
                .map((day, index) => {
                  const schedule = $(day)
                    .text()
                    .toLowerCase()
                    .replace(/noon/g, '12 pm')
                    .split(',')
                    .map((time) => time.trim())
                    .filter((time) => !isNaN(parseInt(time)))
                    .filter(
                      returnOnlyEveningsAndWeekends
                        ? eveningsAndWeekends(index)
                        : () => true
                    )
                  return { day: days[index], schedule }
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
    console.log(JSON.stringify(results, null, 2))
  } catch (e) {
    console.error(e.message)
  }
}

main()
