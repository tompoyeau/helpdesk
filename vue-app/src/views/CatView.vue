<template>
  <section style="padding:12px">
    <CatDetail v-if="name" :cat-name="name" />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CatDetail from '@/components/dashboard/CatDetail.vue'

const route = useRoute()
const name  = computed(() => decodeURIComponent(String(route.params.name || '')))
</script>
