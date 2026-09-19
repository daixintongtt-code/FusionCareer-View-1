<template>
  <span
    :class="['job-logo', 'job-category-icon', `job-category-icon--${normalizedCategory.toLowerCase()}`]"
    :style="iconStyle"
    role="img"
    :aria-label="`${categoryLabel}岗位图标`"
    :title="`${categoryLabel}岗位`"
  >
    <svg v-if="normalizedCategory === 'MEDIA'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11" />
      <path d="M8 8l4 0M8 12l4 0M8 16l4 0" />
    </svg>

    <svg v-else-if="normalizedCategory === 'ENTERPRISE'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8.5h16v10.25A1.25 1.25 0 0 1 18.75 20H5.25A1.25 1.25 0 0 1 4 18.75z" />
      <path d="M9 8.5V6.75A1.75 1.75 0 0 1 10.75 5h2.5A1.75 1.75 0 0 1 15 6.75V8.5M4 12.5c4.9 2 11.1 2 16 0M10 13.5h4" />
    </svg>

    <svg v-else-if="normalizedCategory === 'GOVERNMENT'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9" />
      <path d="M5 21v-7" />
    </svg>

    <svg v-else-if="normalizedCategory === 'ACADEMIC'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 9 9-5 9 5-9 5z" />
      <path d="M7 12v4c2.7 2.1 7.3 2.1 10 0v-4M21 9v6" />
    </svg>

    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2.5" />
      <rect x="14" y="5" width="5" height="5" rx="1" />
      <path d="m7.5 14-3 5h6zM16.5 14l3 2.5-3 2.5-3-2.5z" />
    </svg>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  category: { type: String, default: 'OTHER' },
  size: { type: [Number, String], default: null },
})

const CATEGORY_LABELS = {
  MEDIA: '新闻媒体',
  ENTERPRISE: '企业公司',
  GOVERNMENT: '党政机关',
  ACADEMIC: '学术教职',
  OTHER: '其他',
}

const normalizedCategory = computed(() => (
  Object.hasOwn(CATEGORY_LABELS, props.category) ? props.category : 'OTHER'
))
const categoryLabel = computed(() => CATEGORY_LABELS[normalizedCategory.value])
const iconStyle = computed(() => {
  if (props.size === null || props.size === '') return undefined
  const readSize = typeof props.size === 'number' ? `${props.size}px` : props.size
  return { width: readSize, height: readSize }
})
</script>

<style scoped>
.job-logo.job-category-icon {
  color: var(--ink-2);
  background: var(--bg-soft);
  border-color: var(--border);
}
.job-category-icon svg {
  width: 58%;
  height: 58%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.job-category-icon--media svg,
.job-category-icon--government svg { stroke-width: 2; }
</style>
