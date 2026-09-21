<template>
  <form class="page-jump" @submit.prevent="submit">
    <label>跳至 <input v-model="page" type="number" min="1" :max="total" /> 页</label>
  </form>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({ current: Number, total: Number })
const emit = defineEmits(['change'])
const page = ref(props.current)

watch(() => props.current, readValue => { page.value = readValue })

function submit() {
  const readTarget = Math.trunc(Number(page.value))
  if (!Number.isFinite(readTarget)) return
  emit('change', Math.min(props.total, Math.max(1, readTarget)))
}
</script>

<style scoped>
.page-jump { margin-left: .25rem; font-size: .773rem; color: var(--ink-3); }
.page-jump input {
  width: 3.5rem; padding: .35rem; border: 1px solid var(--border);
  border-radius: var(--r-sm); text-align: center; color: var(--ink);
  background: var(--bg-card);
}
</style>
