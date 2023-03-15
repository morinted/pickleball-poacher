import { EveningIcon } from './EveningIcon'
import { NewIcon } from './NewIcon'
import { getEndTime } from './time'

/**
 * Time is stored in the format:
 *     1 - 2 pm (Pickleball - Intermediate)
 *
 * This function:
 *
 * - Strips (Pickleball)
 * - Leaves skill-level, age, etc.
 */
export const TimeFormatter = ({ time }) => {
  const endTime = getEndTime(time)
  const isEvening = endTime.hour() >= 17
  const isNew = time.includes('*')
  const displayTime = time.split(' (', 1)[0]
  const description = time
    .match(/\((.+)\)/)[1]
    .replace(/Pickleball([ -]+)?/, '')
  return (
    <span>
      <style jsx>{`
        note {
          font-size: 0.9rem;
          font-style: italic;
          font-weight: normal;
          opacity: 0.7;
          display: block;
          margin-bottom: 0.3rem;
        }
      `}</style>
      {isNew && <NewIcon />}
      {displayTime.trim()}
      {isEvening && <EveningIcon />}
      {description ? <note>Note: {description}</note> : null}
    </span>
  )
}
