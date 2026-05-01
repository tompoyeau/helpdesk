<template>
  <Teleport to="body">
    <div v-if="modelValue" class="planning-modal open">
      <div class="modal-backdrop" @click="$emit('update:modelValue', false)"></div>
      <div class="modal-box">
        <div class="modal-header">
          <div class="planning-avatar" style="background:linear-gradient(135deg,#6366F1 0%,#A78BFA 100%)">
            {{ initials }}
          </div>
          <div>
            <div class="modal-person">{{ person }}</div>
            <div class="modal-date">{{ dateLabel }}</div>
          </div>
          <button class="btn-icon btn-icon-sm" style="margin-left:auto" @click="$emit('update:modelValue', false)">
            <X :size="14" />
          </button>
        </div>
        <div class="modal-entries">
          <div v-for="(entry, i) in entries" :key="i" class="modal-entry">
            <div class="modal-entry-bar" :style="{ background: entry.couleur }"></div>
            <div class="modal-entry-info">
              <span class="modal-entry-cat">{{ entry.categorie }}</span>
              <span class="modal-entry-hours">{{ entry.horaire }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { X } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  person:     { type: String,  required: true },
  dateStr:    { type: String,  required: true },
})

defineEmits(['update:modelValue'])

const data = useDataStore()

const entries  = computed(() => data.planning[props.person]?.[props.dateStr] || [])
const initials = computed(() => props.person.split(' ').map(n => n[0]).join(''))
const dateLabel = computed(() => {
  if (!props.dateStr) return ''
  return new Date(props.dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
})
</script>
