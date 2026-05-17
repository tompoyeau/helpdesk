import { describe, it, expect, vi } from 'vitest'

vi.mock('@/firebase/config', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), onSnapshot: vi.fn(), doc: vi.fn(),
  updateDoc: vi.fn(), writeBatch: vi.fn(), query: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(),
}))

import { analyzeActivities, ACTIVITY_MAPPING, TIME_SLOTS } from '@/stores/dataStore'

// ─── helpers ───────────────────────────────────────────────────────────────

/** Remplit un tableau de 45 slots vides puis écrit les valeurs fournies. */
function slots(fills: Record<number, string>): string[] {
  const arr = new Array(45).fill('')
  for (const [i, v] of Object.entries(fills)) arr[Number(i)] = v
  return arr
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe('analyzeActivities', () => {

  // ── Entrées invalides / vides ─────────────────────────────────────────────

  it('retourne [] pour un tableau vide', () => {
    expect(analyzeActivities([])).toEqual([])
  })

  it('retourne [] si le tableau ne contient que des slots vides', () => {
    expect(analyzeActivities(new Array(45).fill(''))).toEqual([])
  })

  it('retourne [] pour une entrée non-tableau', () => {
    expect(analyzeActivities(null as any)).toEqual([])
    expect(analyzeActivities(undefined as any)).toEqual([])
    expect(analyzeActivities('abc' as any)).toEqual([])
  })

  // ── Bloc unique ───────────────────────────────────────────────────────────

  it('produit une entrée pour un bloc contigu simple', () => {
    // Matin (code '0') sur les slots 0-3, vide ensuite
    const result = analyzeActivities(slots({ 0: '0', 1: '0', 2: '0', 3: '0' }))
    expect(result).toHaveLength(1)
    const entry = result[0]
    expect(entry.categorie).toBe(ACTIVITY_MAPPING['0'].categorie) // 'Matin'
    expect(entry.couleur).toBe(ACTIVITY_MAPPING['0'].couleur)
    expect(entry.slots).toBe(4)
    expect(entry.horaire).toBe(`${TIME_SLOTS[0]}-${TIME_SLOTS[4]}`) // '08:00-09:00'
  })

  it('fusionne les slots consécutifs du même code en une seule entrée', () => {
    const arr = new Array(10).fill('0').concat(new Array(35).fill(''))
    const result = analyzeActivities(arr)
    expect(result).toHaveLength(1)
    expect(result[0].slots).toBe(10)
  })

  // ── Plusieurs blocs ───────────────────────────────────────────────────────

  it('produit deux entrées pour deux blocs distincts séparés par un gap', () => {
    // Matin slots 0-3, gap, Soir slots 8-11
    const result = analyzeActivities(slots({
      0: '0', 1: '0', 2: '0', 3: '0',
      8: '2', 9: '2', 10: '2', 11: '2',
    }))
    expect(result).toHaveLength(2)
    expect(result[0].categorie).toBe('Matin')
    expect(result[1].categorie).toBe('Soir')
  })

  it('produit deux entrées pour deux blocs adjacents de codes différents', () => {
    // Matin slots 0-1, Aprem slots 2-3 (directement collés)
    const result = analyzeActivities(slots({
      0: '0', 1: '0',
      2: '15', 3: '15',
    }))
    expect(result).toHaveLength(2)
    expect(result[0].categorie).toBe('Matin')
    expect(result[0].slots).toBe(2)
    expect(result[1].categorie).toBe('Aprem')
    expect(result[1].slots).toBe(2)
  })

  // ── Bloc en fin de tableau ────────────────────────────────────────────────

  it('ferme correctement un bloc qui se termine à la fin du tableau', () => {
    // Soir sur les 5 derniers slots (40-44)
    const arr = new Array(45).fill('')
    for (let i = 40; i < 45; i++) arr[i] = '2'
    const result = analyzeActivities(arr)
    expect(result).toHaveLength(1)
    expect(result[0].slots).toBe(4) // endIdx = Math.min(45, 44) = 44 → 44-40 = 4
    expect(result[0].horaire).toMatch(/^.*-.*$/)
  })

  it('produit un horaire correct pour un bloc en fin de tableau', () => {
    // CP sur tout le tableau
    const arr = new Array(45).fill('30')
    const result = analyzeActivities(arr)
    expect(result).toHaveLength(1)
    // endIdx = Math.min(45, 44) = 44
    expect(result[0].horaire).toBe(`${TIME_SLOTS[0]}-${TIME_SLOTS[44]}`)
  })

  // ── Codes inconnus ────────────────────────────────────────────────────────

  it('ignore silencieusement les codes absents de ACTIVITY_MAPPING', () => {
    const result = analyzeActivities(slots({ 0: '999', 1: '999', 2: '999' }))
    expect(result).toEqual([])
  })

  it('ignore un code inconnu intercalé entre deux blocs connus', () => {
    const result = analyzeActivities(slots({
      0: '0', 1: '0',      // Matin
      2: '999',             // inconnu — traité comme un changement de code
      3: '15', 4: '15',    // Aprem
    }))
    // '999' n'est pas dans ACTIVITY_MAPPING → pas d'entrée pour ce bloc
    expect(result).toHaveLength(2)
    expect(result[0].categorie).toBe('Matin')
    expect(result[1].categorie).toBe('Aprem')
  })

  // ── Format horaire ────────────────────────────────────────────────────────

  it("l'horaire utilise TIME_SLOTS[startIndex] et TIME_SLOTS[endIndex]", () => {
    // Soir (code '2') slots 5-10 → TIME_SLOTS[5] à TIME_SLOTS[11]
    const result = analyzeActivities(slots({
      5: '2', 6: '2', 7: '2', 8: '2', 9: '2', 10: '2',
    }))
    expect(result[0].horaire).toBe(`${TIME_SLOTS[5]}-${TIME_SLOTS[11]}`)
    expect(result[0].slots).toBe(6)
  })

  // ── Slot unique ───────────────────────────────────────────────────────────

  it("gère un bloc d'un seul slot", () => {
    const result = analyzeActivities(slots({ 3: '0' }))
    expect(result).toHaveLength(1)
    expect(result[0].slots).toBe(1)
    expect(result[0].horaire).toBe(`${TIME_SLOTS[3]}-${TIME_SLOTS[4]}`)
  })

  // ── Cohérence catégorie / couleur ─────────────────────────────────────────

  it('chaque entrée a la catégorie et la couleur correspondant au code ACTIVITY_MAPPING', () => {
    for (const [code, mapping] of Object.entries(ACTIVITY_MAPPING)) {
      const result = analyzeActivities(slots({ 0: code, 1: code }))
      expect(result[0].categorie).toBe(mapping.categorie)
      expect(result[0].couleur).toBe(mapping.couleur)
    }
  })
})
