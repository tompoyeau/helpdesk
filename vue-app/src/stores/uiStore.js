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
    toggleDark, initDark, navigate, closeAllDrawers,
  }
})
