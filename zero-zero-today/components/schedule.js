import schedule from '../../cache/schedule.json'

export const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const todayIndex = new Date().getDay()
export const today = days[todayIndex]
export const daysStartingWithToday = [
  ...days.slice(todayIndex),
  ...days.slice(0, todayIndex),
]

const scheduleList = Object.keys(schedule).map((locationName) => ({
  name: locationName,
  ...schedule[locationName],
}))

export const locationsThatHaveDay = (day) => {
  return scheduleList.filter((location) => location[day])
}

export const addDistance = (locations, latitude, longitude, sort) => {
  if (!latitude || !longitude) return locations
  const locationsWithDistance = locations.map((location) => ({
    ...location,
    distance: distance(
      latitude,
      longitude,
      parseFloat(location.coordinates.lat),
      parseFloat(location.coordinates.lon)
    ),
  }))
  if (sort) {
    locationsWithDistance.sort((a, b) => a.distance - b.distance)
  }
  return locationsWithDistance
}

function distance(lat1, lon1, lat2, lon2) {
  var radlat1 = (Math.PI * lat1) / 180
  var radlat2 = (Math.PI * lat2) / 180
  var theta = lon1 - lon2
  var radtheta = (Math.PI * theta) / 180
  var dist =
    Math.sin(radlat1) * Math.sin(radlat2) +
    Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta)
  if (dist > 1) dist = 1
  dist = Math.acos(dist)
  dist *= 180 / Math.PI
  dist *= 60 * 1.1515
  dist *= 1.609344
  return dist
}

export { schedule, scheduleList }
