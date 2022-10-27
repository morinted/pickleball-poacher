import { EveningIcon } from "./EveningIcon"
import { NewIcon } from "./NewIcon"
import { getEndTime } from "./time"

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
  const displayTime = time.replace('(Pickleball)', '').replace(/\(Pickleball[ -]+/, '(').replace('*', '')
  return <span>{isNew && <NewIcon />}{displayTime}{(isEvening) && <EveningIcon />}</span>
}