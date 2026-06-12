import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { api } from '../services/api'

const RARITY_LABELS = { common: 'Gewoon', uncommon: 'Ongewoon', rare: 'Zeldzaam', legendary: 'Legendarisch' }
const RARITY_CLASSES = { common: 'badge-common', uncommon: 'badge-uncommon', rare: 'badge-rare', legendary: 'badge-legendary' }

const CATEGORIES = [
  { key: 'all', label: 'Alles' },
  { key: 'getting_started', label: 'Eerste stappen' },
  { key: 'quality', label: 'Kwaliteit' },
  { key: 'moments', label: 'Momenten' },
  { key: 'leaderboard', label: 'Ranglijst' },
]

export default function Achievements() {
  const [allAchievements, setAllAchievements] = useState([])
  const [myAchievements, setMyAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [allData, myData] = await Promise.allSettled([
        api.getAchievements(),
        api.getMyAchievements(),
      ])
      if (allData.status === 'fulfilled') {
        const a = allData.value
        setAllAchievements(a.achievements || a || [])
      }
      if (myData.status === 'fulfilled') {
        const a = myData.value
        setMyAchievements(a.achievements || a || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const unlockedMap = {}
  myAchievements.forEach((a) => {
    unlockedMap[a.id || a.achievement_id] = a
  })

  const filtered = allAchievements.filter((a) => {
    if (category === 'all') return true
    return (a.category || '').toLowerCase() === category
  })

  const unlockedCount = allAchievements.filter((a) => unlockedMap[a.id]).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-heading font-black text-2xl text-white">Prestaties</h1>
        <div className="glass rounded-xl px-3 py-1.5 text-sm font-heading font-bold text-gold-400">
          {unlockedCount}/{allAchievements.length} ontgrendeld
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/10 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold-500 to-gold-400 rounded-full transition-all duration-700"
          style={{ width: allAchievements.length ? `${(unlockedCount / allAchievements.length) * 100}%` : '0%' }}
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl font-heading font-bold text-sm transition-all ${
              category === cat.key ? 'bg-gold-500 text-pitch-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievements grid */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-heading font-bold text-white/70">Geen prestaties gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((ach) => {
            const unlocked = unlockedMap[ach.id]
            const rarity = ach.rarity || 'common'

            return (
              <div
                key={ach.id}
                className={`card p-4 flex flex-col items-center text-center transition-all ${
                  unlocked ? '' : 'opacity-50 grayscale'
                }`}
              >
                <div className={`text-4xl mb-2 ${unlocked ? 'animate-pop-in' : 'blur-sm'}`}>
                  {ach.icon || '🏅'}
                </div>
                <div className="font-heading font-bold text-xs text-white mb-1 leading-tight">
                  {ach.name}
                </div>
                <p className="text-white/40 text-xs mb-2 leading-tight">
                  {unlocked ? ach.description : '???'}
                </p>
                <span className={`text-xs font-heading font-bold px-2 py-0.5 rounded-full text-white mb-2 ${RARITY_CLASSES[rarity]}`}>
                  {RARITY_LABELS[rarity] || rarity}
                </span>
                {unlocked && unlocked.unlocked_at && (
                  <div className="text-white/30 text-xs font-heading">
                    {format(new Date(unlocked.unlocked_at), 'd MMM yyyy', { locale: nl })}
                  </div>
                )}
                {ach.percentage !== undefined && (
                  <div className="text-white/20 text-xs mt-1">
                    {ach.percentage}% heeft dit
                  </div>
                )}
                {unlocked && (
                  <div className="mt-1 text-green-400 text-xs font-heading font-bold">✓ Ontgrendeld</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
