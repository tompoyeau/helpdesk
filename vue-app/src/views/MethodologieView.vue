<template>
  <section style="padding:12px">
    <div class="content-card metho-card">

      <div class="mt-head">
        <h1 class="mt-title"><BookOpen :size="18" /> Méthodologie &amp; transparence des calculs</h1>
        <p class="mt-sub">
          Comment chaque chiffre du tableau de bord et de l'équité est calculé, à partir des données de planning.
          Cliquez sur une section pour dérouler le détail.
        </p>
      </div>

      <!-- ── Principe général ── -->
      <details class="mt-sec" open>
        <summary>
          <span class="mt-sec-title"><Ruler :size="14" /> Principe général</span>
          <span class="mt-sec-hint">Unité = le créneau de 15 min · 1 jour = {{ SLOTS_PER_DAY }} créneaux · comptage au prorata des heures</span>
        </summary>
        <div class="mt-body">
          <ul class="mt-list">
            <li>L'unité de base est le <strong>créneau de 15 minutes</strong>. Une journée complète vaut <strong>{{ SLOTS_PER_DAY }} créneaux</strong> (de 8h00 à ~19h00, pause déjeuner exclue).</li>
            <li>Tout est compté <strong>au prorata des heures</strong> : une matinée seule (ex. samedi 08:00–12:00) compte pour ~0,5 jour, pas 1 jour entier.</li>
            <li>Sont <strong>exclus</strong> du décompte : les <strong>dimanches</strong> et les <strong>jours fériés</strong>. Les <strong>samedis travaillés sont comptés</strong>.</li>
            <li>Les <strong>absences</strong> (CP, Indisponible, Récup) sont <strong>plafonnées à 1 jour par date</strong> (une journée d'absence ne peut pas dépasser 1).</li>
          </ul>
        </div>
      </details>

      <!-- ── Jours travaillés ── -->
      <details class="mt-sec">
        <summary>
          <span class="mt-sec-title"><CalendarCheck :size="14" /> Jours travaillés</span>
          <span class="mt-sec-hint">Tous les jours avec une activité, sauf absences et jours vides</span>
        </summary>
        <div class="mt-body">
          <p><strong>Définition :</strong> tous les jours où la personne a une activité, <strong>à l'exception</strong> de : CP, Indisponible, Récup, et les jours sans horaire (vides).</p>
          <div class="mt-two">
            <div class="mt-col mt-col-ok">
              <div class="mt-col-h"><Check :size="13" /> Compté comme travaillé</div>
              <ul>
                <li>Tous les horaires : Matin / Midi / Aprem / Soir</li>
                <li>Télétravail (domicile &amp; agence)</li>
                <li>Journées vertes (Agence)</li>
                <li>BO, Pilote, Astreinte, RH, Formation, BOTLT</li>
                <li>Samedis travaillés</li>
              </ul>
            </div>
            <div class="mt-col mt-col-no">
              <div class="mt-col-h"><X :size="13" /> Non compté</div>
              <ul>
                <li>CP (congés)</li>
                <li>Indisponible</li>
                <li>Récup (repos)</li>
                <li>Jours sans horaire (vides)</li>
                <li>Dimanches &amp; jours fériés</li>
              </ul>
            </div>
          </div>
          <p class="mt-formula">jours travaillés = Σ (créneaux travaillés) ÷ {{ SLOTS_PER_DAY }}</p>
        </div>
      </details>

      <!-- ── Catégories ── -->
      <details class="mt-sec">
        <summary>
          <span class="mt-sec-title"><Tags :size="14" /> Catégories d'activité</span>
          <span class="mt-sec-hint">{{ catRows.length }} catégories · ce que chacune représente dans les calculs</span>
        </summary>
        <div class="mt-body">
          <div class="mt-table-wrap">
            <table class="mt-table">
              <thead>
                <tr><th>Catégorie</th><th>Horaire</th><th>Compte comme</th><th class="mt-c">Travaillé</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in catRows" :key="r.name">
                  <td>
                    <span class="mt-dot" :style="{ background: r.color }"></span>
                    {{ r.name }}
                  </td>
                  <td>{{ r.horaire }}</td>
                  <td><span class="mt-tag" :class="`mt-tag-${r.groupKey}`">{{ r.label }}</span></td>
                  <td class="mt-c">
                    <Check v-if="r.worked" :size="13" class="mt-yes" />
                    <X v-else :size="13" class="mt-nope" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <!-- ── Taux ── -->
      <details class="mt-sec">
        <summary>
          <span class="mt-sec-title"><Percent :size="14" /> Taux (TLT, Client, Journées vertes)</span>
          <span class="mt-sec-hint">Part de chaque famille sur les jours travaillés</span>
        </summary>
        <div class="mt-body">
          <p>Chaque taux est la part d'une famille d'activité sur le total des jours travaillés :</p>
          <p class="mt-formula">taux = jours de la famille ÷ jours travaillés × 100</p>
          <ul class="mt-list">
            <li><strong>Taux TLT (Télétravail)</strong> = <em>TLT domicile + TLT agence + BOTLT</em>. Les personnes de BO et celles qui ne peuvent pas télétravailler sont hors périmètre côté équité.</li>
            <li><strong>Taux client</strong> = jours « site » (chez le client), hors TLT / Agence / autre.</li>
            <li><strong>Journées vertes (Agence)</strong> = jours en Agence.</li>
          </ul>
          <p class="mt-note">Exemple : 34,2 j de TLT ÷ 236,1 j travaillés = 14 %.</p>
        </div>
      </details>

      <!-- ── Absences ── -->
      <details class="mt-sec">
        <summary>
          <span class="mt-sec-title"><CalendarX :size="14" /> Absences</span>
          <span class="mt-sec-hint">CP, Indisponible, Récup — plafonnées à 1 jour par date</span>
        </summary>
        <div class="mt-body">
          <p>Les absences ne comptent pas dans les jours travaillés. Elles sont <strong>plafonnées à 1 jour par date</strong> : même si plusieurs créneaux d'absence sont posés le même jour, cela vaut au maximum 1 jour d'absence.</p>
          <p class="mt-formula">jours d'absence (par date) = min( créneaux d'absence ÷ {{ SLOTS_PER_DAY }}, 1 )</p>
        </div>
      </details>

      <!-- ── Samedis ── -->
      <details class="mt-sec">
        <summary>
          <span class="mt-sec-title"><CalendarDays :size="14" /> Samedis &amp; week-ends</span>
          <span class="mt-sec-hint">Samedis comptés (au prorata) · dimanches exclus</span>
        </summary>
        <div class="mt-body">
          <ul class="mt-list">
            <li>Les <strong>samedis travaillés sont comptés</strong> dans toutes les stats (jours travaillés, TLT, répartition…), <strong>au prorata des heures</strong>.</li>
            <li>Un samedi en matinée (ex. TLT Matin 08:00–12:00) compte donc pour ~0,5 jour.</li>
            <li>Les <strong>dimanches</strong> et <strong>jours fériés</strong> restent exclus.</li>
            <li>La vue Équité possède en plus une dimension <strong>Samedis</strong> qui compte le <em>nombre</em> de samedis travaillés par personne.</li>
          </ul>
        </div>
      </details>

      <!-- ── Équité ── -->
      <details class="mt-sec">
        <summary>
          <span class="mt-sec-title"><Scale :size="14" /> Vue Équité</span>
          <span class="mt-sec-hint">Écart de chaque personne à la moyenne d'équipe, par dimension</span>
        </summary>
        <div class="mt-body">
          <p>Pour chaque dimension, on compare la valeur de chaque personne à la <strong>moyenne d'équipe</strong> (la « part juste » si tout était réparti équitablement) sur la période sélectionnée.</p>
          <p><strong>Dimensions analysées :</strong></p>
          <ul class="mt-list">
            <li v-for="d in EQUITY_DIMENSIONS" :key="d.key">
              <span class="mt-dot" :style="{ background: d.color }"></span>
              <strong>{{ d.label }}</strong> — {{ d.direction === 'burden' ? 'fardeau (trop = lésé)' : 'avantage (trop peu = lésé)' }}
            </li>
          </ul>
          <p><strong>Personnes écartées de l'analyse :</strong></p>
          <ul class="mt-list">
            <li>hors run (<code>onRun</code> désactivé) ;</li>
            <li>arrivées depuis moins de <strong>3 mois</strong> (historique non représentatif) ;</li>
            <li>moins de <strong>8 jours travaillés</strong> sur la période (bruit statistique).</li>
          </ul>
          <p><strong>Exclusions par dimension :</strong> le <em>Télétravail</em> exclut les personnes de BO et celles qui ne peuvent pas télétravailler ; les <em>Samedis</em> excluent celles qui ne peuvent pas télétravailler (les BO restent).</p>
          <p><strong>Seuils de couleur :</strong> le pire écart déclenche « À surveiller » à partir de ×1,4 de la moyenne, « Déséquilibré » à partir de ×2.</p>
        </div>
      </details>

    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { CAT_MAP, SLOTS_PER_DAY } from '@/stores/statsStore'
import { ACTIVITY_MAPPING } from '@/stores/dataStore'
import { EQUITY_DIMENSIONS } from '@/services/equity'
import { BookOpen, Ruler, CalendarCheck, Tags, Percent, CalendarX, CalendarDays, Scale, Check, X } from 'lucide-vue-next'

// Couleur d'une catégorie depuis ACTIVITY_MAPPING (categorie → couleur)
const COLOR_BY_CAT = Object.fromEntries(
  Object.values(ACTIVITY_MAPPING).map(v => [v.categorie, v.couleur]),
)

const HORAIRE_FR = { matin: 'Matin', midi: 'Midi', aprem: 'Aprem', soir: 'Soir' }

// Classe une catégorie (d'après CAT_MAP) en « compte comme »
function classify(map) {
  if (map.capped)      return { groupKey: 'abs',   label: 'Absence (plafond 1 j)', worked: false }
  if (map.horaire) {
    if (map.mode === 'tlt')        return { groupKey: 'tlt',    label: 'TLT domicile', worked: true }
    if (map.mode === 'tlt_agence') return { groupKey: 'tlt',    label: 'TLT agence',   worked: true }
    if (map.mode === 'agence')     return { groupKey: 'agence', label: 'Journée verte', worked: true }
    return { groupKey: 'client', label: 'Chez le client (site)', worked: true }
  }
  if (map.mode === 'tlt') return { groupKey: 'tlt',   label: 'TLT (sans horaire)', worked: true }
  if (map.mode === 'bo')  return { groupKey: 'autre', label: 'BO', worked: true }
  return { groupKey: 'autre', label: 'Autre (Pilote/Astreinte/RH)', worked: true }
}

const GROUP_ORDER = { client: 0, tlt: 1, agence: 2, autre: 3, abs: 4 }

const catRows = computed(() =>
  Object.entries(CAT_MAP)
    .map(([name, map]) => {
      const c = classify(map)
      return {
        name,
        horaire: map.horaire ? HORAIRE_FR[map.horaire] : '—',
        color: COLOR_BY_CAT[name] || 'var(--border)',
        ...c,
      }
    })
    .sort((a, b) => (GROUP_ORDER[a.groupKey] - GROUP_ORDER[b.groupKey]) || a.name.localeCompare(b.name, 'fr'))
)
</script>

<style scoped>
.metho-card { font-size: 0.8125rem; }
.mt-head { margin-bottom: 16px; }
.mt-title { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; font-weight: 800; }
.mt-sub { margin-top: 4px; font-size: 0.8125rem; color: var(--text-muted); max-width: 680px; }

.mt-sec {
  border: 1px solid var(--border); border-radius: var(--radius-md);
  margin-bottom: 10px; background: var(--bg); overflow: hidden;
}
.mt-sec > summary {
  list-style: none; cursor: pointer; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 2px;
  user-select: none; transition: background 0.12s;
}
.mt-sec > summary::-webkit-details-marker { display: none; }
.mt-sec > summary:hover { background: var(--bg-hover); }
.mt-sec[open] > summary { border-bottom: 1px solid var(--border); }
.mt-sec-title { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 0.875rem; }
.mt-sec-hint { font-size: 0.75rem; color: var(--text-muted); padding-left: 21px; }

.mt-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.mt-body p { line-height: 1.5; }
.mt-list { list-style: disc; padding-left: 20px; display: flex; flex-direction: column; gap: 5px; line-height: 1.45; }
.mt-list li .mt-dot { margin-right: 4px; }

.mt-formula {
  font-family: var(--font-mono, monospace); font-size: 0.8125rem;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 8px 12px; color: var(--text);
}
.mt-note { font-size: 0.75rem; color: var(--text-muted); }

.mt-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 560px) { .mt-two { grid-template-columns: 1fr; } }
.mt-col { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; }
.mt-col ul { list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; }
.mt-col-h { display: flex; align-items: center; gap: 5px; font-weight: 700; font-size: 0.75rem; margin-bottom: 6px; }
.mt-col-ok .mt-col-h { color: #16a34a; }
.mt-col-no .mt-col-h { color: #dc2626; }

.mt-table-wrap { overflow-x: auto; }
.mt-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
.mt-table th, .mt-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.mt-table th { font-weight: 700; color: var(--text-muted); position: sticky; top: 0; background: var(--bg); }
.mt-table .mt-c { text-align: center; }
.mt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; vertical-align: middle; margin-right: 6px; }
.mt-yes { color: #16a34a; }
.mt-nope { color: #dc2626; }

.mt-tag { font-size: 0.6875rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
.mt-tag-client { background: rgba(99,102,241,0.12);  color: #6366F1; }
.mt-tag-tlt    { background: rgba(34,211,238,0.14);  color: #0891b2; }
.mt-tag-agence { background: rgba(52,211,153,0.15);  color: #16a34a; }
.mt-tag-autre  { background: rgba(148,163,184,0.18); color: var(--text-muted); }
.mt-tag-abs    { background: rgba(239,68,68,0.12);   color: #dc2626; }

.mt-body code { font-family: var(--font-mono, monospace); font-size: 0.78em; background: var(--bg-surface); padding: 1px 5px; border-radius: 4px; }
</style>
