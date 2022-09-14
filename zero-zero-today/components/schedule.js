import schedule from '../../cache/schedule.json'

export const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const todayIndex = (new Date()).getDay()
export const today = days[todayIndex]
export const daysStartingWithToday = [
  ...days.slice(todayIndex),
  ...days.slice(0, todayIndex)
]

const scheduleList = Object.keys(schedule).map(locationName => ({
  name: locationName,
  ...schedule[locationName]
}))

export const locationsThatHaveDay = (day) => {
  return scheduleList.filter(location => location[day])
}

export { schedule, scheduleList }