/**
 * analytics.ts — Statistiques d'usage anonymes (Umami auto-hébergé, sans cookie)
 *
 *  - Pages vues : envoyées à la main depuis le router, avec le nom des
 *    collaborateurs retiré de l'URL (/person/:name → /person)
 *  - Événements : actions des stores suivies par un plugin Pinia ($onAction),
 *    sans aucune donnée de planning ni nom de personne
 *  - Session : rôle (admin / collaborateur) et appli installée ou navigateur
 *
 * Inactif en local : seuls les domaines listés dans SITES envoient des stats.
 */
import type { PiniaPluginContext } from 'pinia'
import type { Router } from 'vue-router'

const SCRIPT = 'https://stats.topo-host.com/t.js'
const SITES: Record<string, string> = {
  'tompoyeau.github.io': '98fcdf11-eb2e-4b89-a8f1-63a56b7992fc', // Hélio
  'helio.topo-host.com': '0df9cb1e-cdf0-4bee-9323-9720efb56364', // Hélio (démo)
}

type Umami = {
  track: (event?: unknown, data?: Record<string, unknown>) => void
  identify: (data: Record<string, unknown>) => void
}
declare global { interface Window { umami?: Umami } }

const websiteId = SITES[location.hostname]
const queue: ((u: Umami) => void)[] = []

function send(fn: (u: Umami) => void) {
  if (!websiteId) return
  if (window.umami) fn(window.umami)
  else queue.push(fn)
}

// Page courante, déjà nettoyée : remplace l'URL et le titre bruts du navigateur
// dans TOUS les envois (pages vues et événements), qui contiendraient sinon des noms.
let page = { url: '/', title: 'Hélio' }
const referrer = document.referrer.startsWith(location.origin) ? '' : document.referrer

function payload(extra: Record<string, unknown> = {}) {
  const current = { ...page } // figé au moment de l'action, pas de l'envoi
  return (props: Record<string, unknown>) => ({ ...props, ...current, referrer, ...extra })
}

export function track(event: string, data?: Record<string, unknown>) {
  const p = payload({ name: event, data })
  send(u => u.track(p))
}

/* ── Pages vues ── */
let lastPath = ''
function pageView(rawPath: string, path: string, name: string) {
  if (rawPath === lastPath) return // même page (ex. clic sur l'onglet actif) ; comparée avant nettoyage
  lastPath = rawPath
  page = { url: path, title: `Hélio · ${name}` }
  const p = payload()
  send(u => u.track(p))
}

const TITLES: Record<string, string> = {
  planning: 'Planning', dashboard: 'Tableau de bord', equite: 'Équité', methodologie: 'Méthodologie',
  person: 'Fiche collaborateur', cat: 'Catégorie', admin: 'Admin',
}

function cleanPath(route: { name?: unknown; path: string }) {
  return route.name === 'person' ? '/person' : route.path
}

/* ── Événements : actions de store suivies ──
 * clé « store.action » → nom de l'événement (+ propriétés tirées des arguments) */
const ACTIONS: Record<string, { event: string; props?: (args: any[]) => Record<string, unknown> }> = {
  'auth.signOut':                    { event: 'Déconnexion' },
  'notifications.markAllRead':       { event: 'Notifications lues' },
  'forecast.parseExcel':             { event: 'Import Excel prévisionnel' },
  'forecast.applyPreview':           { event: 'Prévisionnel appliqué', props: ([o]) => ({ base: o?.collection === 'plannings_test' ? 'test' : 'prod', ecraser: !!o?.overwrite }) },
  'forecast.undoApply':              { event: 'Prévisionnel annulé' },
  'admin.saveDayPlanning':           { event: 'Planning du jour modifié' },
  'admin.saveEtpAndFixed':           { event: 'ETP modifié' },
  'admin.createPersonne':            { event: 'Collaborateur ajouté' },
  'admin.createPersonneWithAuth':    { event: 'Collaborateur ajouté', props: () => ({ avecCompte: true }) },
  'admin.updatePersonne':            { event: 'Collaborateur modifié' },
  'admin.deletePersonne':            { event: 'Collaborateur supprimé' },
  'admin.clearMonthPlanning':        { event: 'Mois vidé' },
  'admin.copyMonthToProd':           { event: 'Mois copié en prod', props: ([, mode]) => ({ mode: mode ?? 'overwrite' }) },
}

export function analyticsPinia({ store }: PiniaPluginContext) {
  if (!websiteId) return
  store.$onAction(({ name, args, after }) => {
    const key = `${store.$id}.${name}`

    if (key === 'auth.signIn') {
      after(() => track(store.error ? 'Connexion échouée' : 'Connexion'))
      return
    }
    if (key === 'user.loadUser') {
      after(() => send(u => u.identify({
        role: store.isAdmin ? 'admin' : 'collaborateur',
        affichage: matchMedia('(display-mode: standalone)').matches ? 'appli installée' : 'navigateur',
      })))
      return
    }
    if (key === 'ui.toggleDark') {
      after(() => track('Mode sombre', { actif: store.darkMode }))
      return
    }

    const def = ACTIONS[key]
    if (def) after(() => track(def.event, def.props?.(args)))
  })
}

export function setupAnalytics(router: Router) {
  if (!websiteId) return

  const s = document.createElement('script')
  s.defer = true
  s.src = SCRIPT
  s.dataset.websiteId = websiteId
  s.dataset.autoTrack = 'false' // pages vues envoyées à la main (URL nettoyée)
  s.onload = () => { while (queue.length && window.umami) queue.shift()!(window.umami) }
  document.head.appendChild(s)

  router.afterEach(to => pageView(to.path, cleanPath(to), TITLES[String(to.name)] ?? to.path))
}
