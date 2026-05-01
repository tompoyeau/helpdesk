<template>
  <section style="padding:12px">
    <PersonDetail v-if="name" :person-name="name" />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PersonDetail from '@/components/dashboard/PersonDetail.vue'

const route = useRoute()
const name  = computed(() => decodeURIComponent(String(route.params.name || '')))
</script>
