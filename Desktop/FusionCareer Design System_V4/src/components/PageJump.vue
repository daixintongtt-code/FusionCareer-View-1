<template>
  <form class="page-jump" novalidate @submit.prevent="submit">
    <label>跳至 <input v-model="page" type="number" inputmode="numeric" step="1" min="1" :max="limit" :disabled="disabled" aria-label="跳转页码" :aria-invalid="!!error" /> 页</label>
    <button type="submit" class="btn btn-secondary btn-sm" :disabled="disabled">跳转</button>
    <span v-if="error" class="page-jump-error" role="alert">{{ error }}</span>
  </form>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { parsePageTarget } from '@/lib/jobBrowse.mjs'

const props = defineProps({ current: { type:Number, default:1 }, total: { type:Number, default:1 }, disabled: Boolean })
const emit = defineEmits(['change'])
const page = ref(props.current)
const limit = computed(() => Math.max(1, Math.trunc(Number(props.total) || 1)))
const error = ref('')

watch(() => [props.current, props.total], () => { page.value = props.current; error.value = '' })
watch(page, () => { error.value = '' })

function submit() {
  if (props.disabled) return
  const readTarget = parsePageTarget(page.value, limit.value)
  if (readTarget == null) {
    error.value = `请输入 1 至 ${limit.value} 之间的整数页码`
    return
  }
  error.value = ''
  emit('change', readTarget)
}
</script>

<style scoped>
.page-jump { display:flex; align-items:center; flex-wrap:wrap; gap:.4rem; font-size:13px; color:var(--ink-2); }
.page-jump label { display:flex; align-items:center; gap:.35rem; }
.page-jump input {
  width: 3.6rem; min-height:32px; padding: .3rem; border: 1px solid var(--border-mid);
  border-radius: var(--r-sm); text-align: center; color: var(--ink);
  background: var(--bg-card); font-size:13px;
}
.page-jump input:focus-visible { outline:2px solid var(--red); outline-offset:2px; }
.page-jump-error { flex-basis:100%; color:var(--red); font-size:12px; }
</style>
