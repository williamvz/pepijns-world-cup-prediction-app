// FIFA World Ranking per team (by team code).
// These are approximate FIFA/Coca-Cola World Ranking positions and are used
// purely as a hint to help players make better predictions. They are not
// authoritative — an admin can adjust them later if needed.
export const FIFA_RANKINGS = {
  ARG: 1,
  ESP: 2,
  FRA: 3,
  ENG: 4,
  BRA: 5,
  POR: 6,
  NED: 7,
  BEL: 8,
  GER: 9,
  CRO: 10,
  MAR: 12,
  COL: 13,
  MEX: 14,
  URU: 15,
  USA: 16,
  SEN: 17,
  JPN: 18,
  SUI: 19,
  IRN: 20,
  AUT: 22,
  KOR: 23,
  ECU: 24,
  AUS: 26,
  TUR: 27,
  CAN: 28,
  NOR: 30,
  PAN: 31,
  EGY: 33,
  ALG: 36,
  SWE: 38,
  SCO: 39,
  PAR: 40,
  CIV: 41,
  CZE: 43,
  TUN: 49,
  QAT: 51,
  COD: 56,
  UZB: 57,
  KSA: 58,
  IRQ: 59,
  RSA: 60,
  JOR: 62,
  CPV: 70,
  GHA: 73,
  BIH: 74,
  CUW: 82,
  HAI: 83,
  NZL: 86,
}

// Fill in fifa_ranking for any team that doesn't have one yet (idempotent).
// Existing values are never overwritten, so manual admin edits are preserved.
export function populateFifaRankings(db) {
  const update = db.prepare(
    'UPDATE teams SET fifa_ranking = ? WHERE code = ? AND fifa_ranking IS NULL'
  )
  const apply = db.transaction(() => {
    for (const [code, rank] of Object.entries(FIFA_RANKINGS)) {
      update.run(rank, code)
    }
  })
  apply()
}
