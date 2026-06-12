import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable'

function CompareModal({ user1, user2Data, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.compareUsers(user1.id, user2Data.user_id || user2Data.id)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [user1.id, user2Data.user_id, user2Data.id])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-pitch-800 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-black text-lg text-white">Vergelijking</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">×</button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-5xl animate-bounce-ball">⚽</div>
        ) : data ? (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="font-heading font-black text-gold-400">{user1.username}</div>
                <div className="font-heading font-black text-2xl text-white mt-1">
                  {data.user1?.total_points ?? 0} pt
                </div>
              </div>
              <div className="text-center">
                <div className="font-heading font-black text-white">{user2Data.username}</div>
                <div className="font-heading font-black text-2xl text-white mt-1">
                  {data.user2?.total_points ?? 0} pt
                </div>
              </div>
            </div>
            {data.comparisons && data.comparisons.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.comparisons.map((c, i) => (
                  <div key={i} className="glass rounded-xl p-3 text-sm">
                    <div className="font-heading font-bold text-white/80 text-xs mb-2">
                      {c.home_team} vs {c.away_team}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="text-xs">
                        <span className="text-gold-400">{c.user1_pred ?? '—'}</span>
                        <span className="text-white/40"> ({c.user1_pts ?? 0} pt)</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-white">{c.user2_pred ?? '—'}</span>
                        <span className="text-white/40"> ({c.user2_pts ?? 0} pt)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-white/40 text-center font-heading">Vergelijking niet beschikbaar</p>
        )}

        <button className="btn-secondary w-full mt-4" onClick={onClose}>Sluiten</button>
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [compareTarget, setCompareTarget] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [lbData, statsData] = await Promise.allSettled([
        api.getLeaderboard(),
        api.getDayStats(),
      ])
      if (lbData.status === 'fulfilled') {
        const lb = lbData.value
        setEntries(lb.leaderboard || lb || [])
      }
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-white mb-4">🏆 Ranglijst</h1>

      {/* Best predictor of the day */}
      {stats?.best_today && (
        <div className="card p-4 mb-4 border-gold-500/30 bg-gold-500/10 flex items-center gap-3">
          <span className="text-3xl">⭐</span>
          <div>
            <p className="font-heading font-bold text-gold-400 text-sm">Beste voorspeller van de dag</p>
            <p className="font-heading font-black text-white text-lg">{stats.best_today.username}</p>
            <p className="text-white/50 text-xs">{stats.best_today.points_today} punten vandaag</p>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <LeaderboardTable
        entries={entries}
        currentUserId={user?.id}
        onCompare={(entry) => setCompareTarget(entry)}
      />

      <div className="h-4" />

      {compareTarget && (
        <CompareModal
          user1={user}
          user2Data={compareTarget}
          onClose={() => setCompareTarget(null)}
        />
      )}
    </div>
  )
}
