import { describe, it, expect } from 'vitest'
import { computeEquity } from '@/services/equity'

// 10 jours ouvrés de juin 2026 (aucun férié ce mois-là)
const WEEKDAYS = [
  '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
  '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
]

// Construit un planning où la personne fait `cat` toute la période (30 slots/jour = 1 journée)
function daysOf(cat: string) {
  const out: Record<string, { categorie: string; slots: number }[]> = {}
  for (const iso of WEEKDAYS) out[iso] = [{ categorie: cat, slots: 30 }]
  return out
}

const WINDOW = { startIso: '2026-06-01', endIso: '2026-06-30' }

describe('computeEquity', () => {
  it('détecte une surcharge de soirs et la classe en priorité', () => {
    const planning = {
      'AAA Aaa': daysOf('Soir'),   // 100 % soir
      'BBB Bbb': daysOf('Matin'),
      'CCC Ccc': daysOf('Matin'),
    }
    const res = computeEquity(planning, Object.keys(planning), {}, {}, WINDOW)

    const soir = res.dimensions.find(d => d.key === 'soir')!
    expect(soir.teamRate).toBe(33)          // 1 personne sur 3 en soir
    expect(soir.status).toBe('alert')       // 100 % ≈ 3× la moyenne
    expect(soir.worst?.name).toBe('AAA Aaa')

    // La priorité n°1 doit être AAA sur les soirs
    expect(res.priorities[0].name).toBe('AAA Aaa')
    expect(res.priorities[0].dimKey).toBe('soir')
  })

  it('ne signale rien quand tout est équilibré', () => {
    // Chacun fait un mix identique matin/soir → aucune injustice
    const mixed = () => {
      const out: Record<string, { categorie: string; slots: number }[]> = {}
      WEEKDAYS.forEach((iso, i) => {
        out[iso] = [{ categorie: i % 2 === 0 ? 'Soir' : 'Matin', slots: 30 }]
      })
      return out
    }
    const planning = { 'AAA Aaa': mixed(), 'BBB Bbb': mixed(), 'CCC Ccc': mixed() }
    const res = computeEquity(planning, Object.keys(planning), {}, {}, WINDOW)

    expect(res.priorities).toHaveLength(0)
    expect(res.dimensions.every(d => d.status === 'balanced')).toBe(true)
  })

  it('exclut les nouveaux arrivants (< 3 mois) même avec des stats déséquilibrées', () => {
    const planning = {
      'AAA Aaa': daysOf('Soir'),
      'BBB Bbb': daysOf('Matin'),
      'NEW New': daysOf('Soir'),   // 100 % soir mais fraîchement arrivé → exclu
    }
    // NEW arrivé le 20 mai 2026 → < 3 mois avant fin de période (30 juin 2026)
    const personnesData = {
      uidNew: { nom: 'NEW', prenom: 'New', arrivee: '20 05 2026' },
    }
    const nameToUid = { 'NEW New': 'uidNew' }
    const res = computeEquity(planning, Object.keys(planning), personnesData, nameToUid, WINDOW)

    expect(res.meta.nbPersons).toBe(2)                       // NEW écarté
    expect(res.priorities.some(p => p.name === 'NEW New')).toBe(false)
  })

  it('exclut les personnes de BO du calcul du télétravail', () => {
    // 2 collabs font du TLT, 1 personne de BO n'en fait pas.
    const withTlt = () => {
      const out: Record<string, { categorie: string; slots: number }[]> = {}
      WEEKDAYS.forEach((iso, i) => {
        out[iso] = [{ categorie: i % 2 === 0 ? 'TLT Matin' : 'Matin', slots: 30 }]
      })
      return out
    }
    const planning = {
      'AAA Aaa': withTlt(),
      'BBB Bbb': withTlt(),
      'BOO Boo': daysOf('Matin'),   // 0 % TLT mais personne de BO → hors dimension TLT
    }
    const personnesData = { uidBo: { nom: 'BOO', prenom: 'Boo', peutBO: true } }
    const nameToUid = { 'BOO Boo': 'uidBo' }
    const res = computeEquity(planning, Object.keys(planning), personnesData, nameToUid, WINDOW)

    const tlt = res.dimensions.find(d => d.key === 'tlt')!
    // La personne de BO ne doit pas apparaître dans la dimension TLT ni tirer la moyenne vers le bas
    expect(tlt.rows.some(r => r.name === 'BOO Boo')).toBe(false)
    expect(res.priorities.some(p => p.name === 'BOO Boo' && p.dimKey === 'tlt')).toBe(false)

    // …mais elle reste comptée dans les samedis (les BO font des samedis)
    const sam = res.dimensions.find(d => d.key === 'samedi')!
    expect(sam.rows.some(r => r.name === 'BOO Boo')).toBe(true)
  })

  it('détecte un déséquilibre de samedis et suggère une contrepartie', () => {
    const SATURDAYS = ['2026-06-06', '2026-06-13', '2026-06-20']
    const withSaturdays = () => {
      const o = daysOf('Matin')
      for (const s of SATURDAYS) o[s] = [{ categorie: 'Matin', slots: 30 }]
      return o
    }
    const planning = {
      'AAA Aaa': withSaturdays(),   // 3 samedis
      'BBB Bbb': daysOf('Matin'),   // 0
      'CCC Ccc': daysOf('Matin'),   // 0
    }
    const res = computeEquity(planning, Object.keys(planning), {}, {}, WINDOW)

    const sam = res.dimensions.find(d => d.key === 'samedi')!
    expect(sam.worst?.name).toBe('AAA Aaa')

    const prio = res.priorities.find(p => p.dimKey === 'samedi')!
    expect(prio.name).toBe('AAA Aaa')
    expect(prio.counterpart).toBeTruthy()
    expect(['BBB Bbb', 'CCC Ccc']).toContain(prio.counterpart!.name)
  })

  it('sépare les samedis travaillés des samedis d\'astreinte', () => {
    const SATURDAYS = ['2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27']
    const withSat = (cat: string, count: number) => {
      const o = daysOf('Matin')
      SATURDAYS.slice(0, count).forEach(s => { o[s] = [{ categorie: cat, slots: 30 }] })
      return o
    }
    const planning = {
      'AAA Aaa': withSat('Matin', 3),      // 3 samedis travaillés
      'BBB Bbb': withSat('Astreinte', 3),  // 3 samedis d'astreinte
      'CCC Ccc': daysOf('Matin'),          // 0
    }
    const res = computeEquity(planning, Object.keys(planning), {}, {}, WINDOW)

    const trav = res.dimensions.find(d => d.key === 'samedi')!
    const astr = res.dimensions.find(d => d.key === 'samedi_astreinte')!

    // AAA en tête des samedis travaillés, pas des astreintes
    expect(trav.worst?.name).toBe('AAA Aaa')
    expect(trav.rows.find(r => r.name === 'BBB Bbb')?.days).toBe(0)
    // BBB en tête des astreintes, pas des samedis travaillés
    expect(astr.worst?.name).toBe('BBB Bbb')
    expect(astr.rows.find(r => r.name === 'AAA Aaa')?.days).toBe(0)
  })

  it('exclut des samedis les personnes qui ne font pas de TLT', () => {
    const withSat = () => {
      const o = daysOf('Matin')
      o['2026-06-06'] = [{ categorie: 'Matin', slots: 30 }]
      return o
    }
    const planning = {
      'AAA Aaa': withSat(),
      'BBB Bbb': daysOf('Matin'),
      'NOO Tlt': daysOf('Matin'),   // ne peut pas TLT → hors dimension samedi
    }
    const personnesData = { uidNo: { nom: 'NOO', prenom: 'Tlt', peutTLT: false } }
    const nameToUid = { 'NOO Tlt': 'uidNo' }
    const res = computeEquity(planning, Object.keys(planning), personnesData, nameToUid, WINDOW)

    const sam = res.dimensions.find(d => d.key === 'samedi')!
    expect(sam.rows.some(r => r.name === 'NOO Tlt')).toBe(false)
  })

  it('ignore les personnes sous le seuil de jours travaillés', () => {
    const planning = {
      'AAA Aaa': daysOf('Soir'),
      'BBB Bbb': daysOf('Matin'),
      'CCC Ccc': { '2026-06-01': [{ categorie: 'Soir', slots: 30 }] }, // 1 seul jour → exclu
    }
    const res = computeEquity(planning, Object.keys(planning), {}, {}, WINDOW)
    expect(res.meta.nbPersons).toBe(2)
  })
})
