import { describe, it, expect } from 'vitest'
import { computePersonStats } from '@/stores/statsStore'

const WEEKDAYS = [
  '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
  '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
]
const WINDOW = { startIso: '2026-06-01', endIso: '2026-06-30' }

function planningOf(cat: string) {
  const p: Record<string, { categorie: string; slots: number }[]> = {}
  for (const iso of WEEKDAYS) p[iso] = [{ categorie: cat, slots: 30 }]
  return { X: p }
}

describe('computePersonStats — jours travaillés', () => {
  it('compte BO/Pilote/Astreinte/RH comme jours travaillés (« autre »)', () => {
    for (const cat of ['PiloteBO', 'Pilote', 'Astreinte', 'RH']) {
      const s = computePersonStats(planningOf(cat), 'X', WINDOW)
      expect(s.workDays).toBe(10)
      expect(s.otherDays).toBe(10)
      expect(s.tltDays).toBe(0)
      expect(s.tauxSoir).toBe(0)
    }
  })

  it('compte BOTLT comme du télétravail (TLT)', () => {
    const s = computePersonStats(planningOf('BOTLT'), 'X', WINDOW)
    expect(s.workDays).toBe(10)
    expect(s.tltDays).toBe(10)
    expect(s.otherDays).toBe(0)
    expect(s.tauxTlt).toBe(100)
  })

  it('TLT = domicile + agence + BOTLT', () => {
    const p: Record<string, { categorie: string; slots: number }[]> = {}
    // 4 TLT domicile, 3 TLT agence, 3 BOTLT
    WEEKDAYS.forEach((iso, i) => {
      const cat = i < 4 ? 'TLT Matin' : i < 7 ? 'TLT Agence Matin' : 'BOTLT'
      p[iso] = [{ categorie: cat, slots: 30 }]
    })
    const s = computePersonStats({ X: p }, 'X', WINDOW)
    expect(s.workDays).toBe(10)
    expect(s.tltDays).toBe(10)     // 4 + 3 + 3
    expect(s.tauxTlt).toBe(100)
  })

  it('n\'inclut PAS les absences (CP/Indisponible/Récup) dans les jours travaillés', () => {
    for (const cat of ['CP', 'Indisponible', 'Récup']) {
      const s = computePersonStats(planningOf(cat), 'X', WINDOW)
      expect(s.workDays).toBe(0)
    }
  })

  it('mélange soir + BO : le BO agrandit le dénominateur des taux', () => {
    const p: Record<string, { categorie: string; slots: number }[]> = {}
    WEEKDAYS.forEach((iso, i) => {
      p[iso] = [{ categorie: i < 5 ? 'Soir' : 'PiloteBO', slots: 30 }]
    })
    const s = computePersonStats({ X: p }, 'X', WINDOW)
    expect(s.workDays).toBe(10)     // 5 soirs + 5 BO
    expect(s.soirDays).toBe(5)
    expect(s.otherDays).toBe(5)
    expect(s.tauxSoir).toBe(50)     // 5 soirs sur 10 jours travaillés
  })
})
