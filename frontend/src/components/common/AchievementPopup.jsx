import React, { useEffect, useRef } from 'react'

const RARITY_LABELS = {
  common: 'Gewoon',
  uncommon: 'Ongewoon',
  rare: 'Zeldzaam',
  legendary: 'Legendarisch',
}

const RARITY_CLASSES = {
  common: 'badge-common',
  uncommon: 'badge-uncommon',
  rare: 'badge-rare',
  legendary: 'badge-legendary',
}

export default function AchievementPopup({ achievement, onDismiss }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!achievement) return

    let confetti
    import('canvas-confetti').then((module) => {
      confetti = module.default
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#15803d', '#ffffff'],
      })
    })
  }, [achievement])

  if (!achievement) return null

  const rarity = achievement.rarity || 'common'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="card p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center animate-pop-in">
        <div className="text-7xl mb-4 animate-pop-in">{achievement.icon || '🏅'}</div>
        <p className="text-gold-400 font-heading font-bold text-sm uppercase tracking-wider mb-2">
          Prestatie Ontgrendeld! 🎉
        </p>
        <h2 className="text-2xl font-heading font-black text-white mb-2">{achievement.name}</h2>
        <p className="text-white/70 text-sm mb-4">{achievement.description}</p>
        <span
          className={`inline-block px-3 py-1 rounded-full text-xs font-heading font-bold text-white mb-6 ${RARITY_CLASSES[rarity]}`}
        >
          {RARITY_LABELS[rarity] || rarity}
        </span>
        {achievement.percentage !== undefined && (
          <p className="text-white/40 text-xs mb-4">
            {achievement.percentage}% van de spelers heeft dit
          </p>
        )}
        <button className="btn-primary w-full" onClick={onDismiss}>
          Geweldig!
        </button>
      </div>
    </div>
  )
}
