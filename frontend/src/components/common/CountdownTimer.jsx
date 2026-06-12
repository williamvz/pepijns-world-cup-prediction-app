import React, { useState, useEffect } from 'react'

function getTimeLeft(targetDate) {
  const diff = new Date(targetDate) - new Date()
  if (diff <= 0) return null
  const hours = Math.floor(diff / 1000 / 3600)
  const minutes = Math.floor((diff / 1000 / 60) % 60)
  const seconds = Math.floor((diff / 1000) % 60)
  return { diff, hours, minutes, seconds }
}

export default function CountdownTimer({ targetDate, className = '' }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    setTimeLeft(getTimeLeft(targetDate))
    const interval = setInterval(() => {
      const tl = getTimeLeft(targetDate)
      setTimeLeft(tl)
      if (!tl) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  if (!timeLeft) {
    return <span className={`text-red-400 font-heading font-bold text-sm ${className}`}>Gesloten</span>
  }

  const { diff, hours, minutes, seconds } = timeLeft
  const isVeryClose = diff < 3600 * 1000
  const isClose = diff < 24 * 3600 * 1000

  let colorClass = 'text-white/70'
  if (isVeryClose) colorClass = 'text-red-400'
  else if (isClose) colorClass = 'text-orange-400'

  const pulseClass = isVeryClose ? 'animate-pulse' : ''

  if (isVeryClose) {
    return (
      <span className={`font-heading font-bold text-sm ${colorClass} ${pulseClass} ${className}`}>
        Nog {minutes}m {seconds}s
      </span>
    )
  }

  if (isClose) {
    return (
      <span className={`font-heading font-bold text-sm ${colorClass} ${className}`}>
        Nog {hours}u {minutes}m
      </span>
    )
  }

  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return (
    <span className={`font-heading font-bold text-sm ${colorClass} ${className}`}>
      Nog {days}d {remHours}u
    </span>
  )
}
