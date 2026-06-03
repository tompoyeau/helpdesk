/**
 * uiStore.js — État de l'interface utilisateur
 *
 * Gère tout ce qui est purement visuel / navigation :
 *  - Mode sombre (persisté en localStorage)
 *  - Vue active et personne/catégorie sélectionnée (sidebar droite)
 *  - Ouverture des drawers mobiles (gauche, droite, date)
 *  - Recherche dans la liste des collaborateurs
 *
 * N'effectue aucun appel Firestore — dépendance zéro aux autres stores.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const darkMode       = ref(false)
  const currentView    = ref('planning') // 'planning' | 'dashboard' | 'person' | 'cat'
  const selectedPerson = ref(null)
  const selectedCat    = ref(null)
  const personSearch   = ref('')

  // Mobile drawers
  const leftDrawerOpen  = ref(false)
  const rightDrawerOpen = ref(false)
  const dateSheetOpen   = ref(false)

  // Sidebars desktop (collapsed = masquée)
  const leftCollapsed  = ref(localStorage.getItem('sb-left-collapsed')  === '1')
  const rightCollapsed = ref(localStorage.getItem('sb-right-collapsed') === '1')

  function toggleLeftSidebar() {
    leftCollapsed.value = !leftCollapsed.value
    localStorage.setItem('sb-left-collapsed', leftCollapsed.value ? '1' : '0')
  }
  function toggleRightSidebar() {
    rightCollapsed.value = !rightCollapsed.value
    localStorage.setItem('sb-right-collapsed', rightCollapsed.value ? '1' : '0')
  }

  function toggleDark() {
    darkMode.value = !darkMode.value
    document.documentElement.classList.toggle('dark', darkMode.value)
    localStorage.setItem('darkMode', darkMode.value ? '1' : '0')
  }

  function initDark() {
    const saved = localStorage.getItem('darkMode')
    if (saved === '1') {
      darkMode.value = true
      document.documentElement.classList.add('dark')
    }
  }

  function navigate(view, person = null, cat = null) {
    currentView.value    = view
    selectedPerson.value = person
    selectedCat.value    = cat
    leftDrawerOpen.value  = false
    rightDrawerOpen.value = false
  }

  function closeAllDrawers() {
    leftDrawerOpen.value  = false
    rightDrawerOpen.value = false
    dateSheetOpen.value   = false
  }

  return {
    darkMode, currentView, selectedPerson, selectedCat, personSearch,
    leftDrawerOpen, rightDrawerOpen, dateSheetOpen,
    leftCollapsed, rightCollapsed,
    toggleDark, initDark, navigate, closeAllDrawers,
    toggleLeftSidebar, toggleRightSidebar,
  }
})
