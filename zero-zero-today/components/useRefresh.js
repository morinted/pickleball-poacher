import { useEffect, useState } from "react"

/**
 * Cause rerenders once a minute.
 */
export const useRefresh = (interval = 60000) => {
  const [updates, setUpdate] = useState(0)
  useEffect(() => {
    const intervalId = setInterval(
      () => setUpdate(update => update + 1), interval
    )
    return () => clearInterval(intervalId)
  })
  return [updates]
}