<template>
  <div v-if="chartData.series.length" style="padding:12px 12px 0">
    <div class="content-card">
      <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:8px">Répartition par lieu</h3>
      <apexchart
        type="donut"
        :options="chartData.options"
        :series="chartData.series"
        height="220"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'

const data = useDataStore()
const ui   = useUiStore()

const LIEU_GROUPS = {
  'Chez le client':       { cats: ['Matin','Midi','Aprem','Soir'], color: '#6366F1' },
  'Télétravail domicile': { cats: ['TLT Matin','TLT Midi','TLT APREM','TLT Soir'], color: '#22D3EE' },
  "Télétravail agence":   { cats: ['TLT Agence Matin','TLT Agence Midi','TLT Agence APREM','TLT Agence Soir','ApremRenf'], color: '#A78BFA' },
  "À l'agence":           { cats: ['Agence Matin','Agence Midi','Agence APREM','Agence Soir'], color: '#34D399' },
}

const chartData = computed(() => {
  if (!data.filtered) return { series: [], options: {} }
  const byCat = data.filtered.byCat
  const labels = [], series = [], colors = []
  for (const [label, group] of Object.entries(LIEU_GROUPS)) {
    const total = group.cats.reduce((s, c) => s + (byCat[c] || 0), 0)
    if (total > 0) { labels.push(label); series.push(total); colors.push(group.color) }
  }
  return {
    series,
    options: {
      labels,
      colors,
      legend: { position: 'bottom', fontSize: '12px' },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                showAlways: true,
                label: '',
                formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'),
              },
              value: {
                show: true,
                showAlways: true,
                fontSize: '20px',
                fontWeight: '700',
                color: ui.darkMode ? '#E0E2FF' : '#2B2D6E',
                formatter: () => '',
              },
              name: { show: false },
            },
          },
        },
      },
      chart: { background: 'transparent' },
      theme: { mode: ui.darkMode ? 'dark' : 'light' },
    }
  }
})

</script>
