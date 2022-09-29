import { EveningIcon } from "./EveningIcon"
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
  const displayTime = time.replace('(Pickleball)', '').replace(/\(Pickleball[ -]+/, '(')
  return <span>{displayTime}{(isEvening) && <EveningIcon />}</span>
}