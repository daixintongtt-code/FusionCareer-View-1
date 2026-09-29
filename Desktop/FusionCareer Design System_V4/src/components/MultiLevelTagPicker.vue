<template>
  <div
    ref="rootRef"
    class="multi-level-tag-picker"
    :style="pickerOpen && popoverSpace ? { marginBottom: `${popoverSpace}px` } : undefined"
  >
    <div
      class="tag-picker-field"
      :class="{ open: pickerOpen, locked: hasAnyPreference }"
      role="combobox"
      aria-haspopup="listbox"
      :aria-label="menuTitle"
      :aria-expanded="pickerOpen"
      :aria-disabled="hasAnyPreference"
      :tabindex="hasAnyPreference ? -1 : 0"
      @click="togglePicker"
      @keydown.enter.prevent="togglePicker"
      @keydown.space.prevent="togglePicker"
    >
      <span v-if="!selectedValues.length && placeholder" class="tag-picker-placeholder">{{ placeholder }}</span>
      <span v-for="readValue in selectedValues" :key="readValue" class="preference-tag">
        {{ readValue }}
        <button type="button" :aria-label="`删除 ${readValue}`" @click.stop="removeValue(readValue)">
          <i class="ti ti-x" />
        </button>
      </span>
      <i class="ti ti-chevron-down tag-picker-chevron" :class="{ open: pickerOpen }" aria-hidden="true" />
    </div>

    <div v-if="hasAnyPreference" class="tag-picker-note">已选择“都可以”，删除后才能新增其他选项。</div>
    <div v-else-if="hint" class="tag-picker-note">{{ hint }}</div>

    <Transition name="picker-fade">
      <div v-if="pickerOpen" ref="popoverRef" class="tag-picker-popover">
        <div class="tag-picker-head">
          <div>
            <strong>{{ menuTitle }}</strong>
            <span>{{ selectedValues.length ? `已选 ${selectedValues.length} 项` : '可选择任意层级' }}</span>
          </div>
          <button type="button" aria-label="关闭" @click="pickerOpen=false"><i class="ti ti-x" /></button>
        </div>

        <label class="tag-picker-search">
          <i class="ti ti-search" />
          <input v-model="searchQuery" type="search" :placeholder="`搜索${menuTitle.replace('选择', '')}`">
          <button v-if="searchQuery" type="button" aria-label="清空搜索" @click="searchQuery=''">
            <i class="ti ti-circle-x" />
          </button>
        </label>

        <template v-if="!searchQuery">
          <div class="tag-picker-nav">
            <div class="tag-picker-breadcrumb" aria-label="当前层级">
              <button type="button" :class="{ current: !activePath.length }" @click="goToLevel(0)">全部</button>
              <template v-for="(readLabel, readIndex) in activePath" :key="`${readLabel}-${readIndex}`">
                <i class="ti ti-chevron-right" />
                <button
                  type="button"
                  :class="{ current: readIndex === activePath.length - 1 }"
                  @click="goToLevel(readIndex + 1)"
                >{{ readLabel }}</button>
              </template>
            </div>
            <button
              v-if="currentPathValue"
              type="button"
              class="current-level-select"
              :class="{ selected: isSelected(currentPathValue) }"
              @click="toggleValue(currentPathValue)"
            >
              <i :class="isSelected(currentPathValue) ? 'ti ti-check' : 'ti ti-plus'" />
              {{ isSelected(currentPathValue) ? '已选本级' : '选择本级' }}
            </button>
          </div>

          <div class="tag-picker-body">
            <div class="tag-picker-options">
              <div
                v-for="readOption in currentOptions"
                :key="readOption.value"
                class="tag-option-row"
                :class="{ selected: isSelected(readOption.value) }"
              >
                <button
                  type="button"
                  class="tag-option-check"
                  :class="{ selected: isSelected(readOption.value) }"
                  :aria-label="isSelected(readOption.value) ? `取消 ${readOption.value}` : `选择 ${readOption.value}`"
                  @click="toggleValue(readOption.value)"
                >
                  <i :class="isSelected(readOption.value) ? 'ti ti-check' : 'ti ti-plus'" />
                </button>
                <button
                  type="button"
                  class="tag-option-main"
                  :title="readOption.description || readOption.value"
                  @click="activateOption(readOption)"
                >
                  <span>{{ readOption.label }}</span>
                  <small v-if="readOption.children?.length">{{ readOption.children.length }} 项</small>
                  <i v-if="readOption.children?.length" class="ti ti-chevron-right" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="tag-picker-body search-results">
          <div v-if="filteredOptions.length" class="tag-picker-results">
            <button
              v-for="readOption in filteredOptions"
              :key="readOption.value"
              type="button"
              class="tag-search-result"
              :class="{ selected: isSelected(readOption.value) }"
              @click="toggleValue(readOption.value)"
            >
              <i :class="isSelected(readOption.value) ? 'ti ti-check' : 'ti ti-plus'" />
              <span :title="readOption.description || readOption.value">{{ readOption.path.join(' / ') }}</span>
            </button>
          </div>
          <div v-else class="tag-picker-empty">没有找到“{{ searchQuery }}”</div>
        </div>

        <div class="tag-picker-foot">
          <template v-if="searchQuery">点击搜索结果即可选择或取消。</template>
          <template v-else>点“＋”选择当前项；点名称进入下一级。</template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ANY_PREFERENCE,
  normalizePreferenceList,
  preferencePathValue,
} from '@/lib/profilePreferences.mjs'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '点击“＋”新增' },
  hint: { type: String, default: '' },
  menuTitle: { type: String, default: '选择选项' },
})

const emit = defineEmits(['update:modelValue'])
const rootRef = ref(null)
const popoverRef = ref(null)
const pickerOpen = ref(false)
const popoverSpace = ref(0)
const activePath = ref([])
const searchQuery = ref('')

const selectedValues = computed(() => normalizePreferenceList(props.modelValue))
const selectedSet = computed(() => new Set(selectedValues.value))
const hasAnyPreference = computed(() => selectedSet.value.has(ANY_PREFERENCE))

function buildOptions(readOptions, readParent = []) {
  return (readOptions || []).map(readOption => {
    const readPath = [...readParent, readOption.label]
    return { ...readOption, path: readPath, value: preferencePathValue(readPath) }
  })
}

function flattenOptions(readOptions, readParent = []) {
  return buildOptions(readOptions, readParent).flatMap(readOption => [
    readOption,
    ...flattenOptions(readOption.children, readOption.path),
  ])
}

const allOptions = computed(() => flattenOptions(props.options))

const currentOptions = computed(() => {
  let readOptions = props.options
  const readParent = []
  for (const readLabel of activePath.value) {
    const readOption = (readOptions || []).find(readItem => readItem.label === readLabel)
    if (!readOption?.children?.length) return []
    readParent.push(readLabel)
    readOptions = readOption.children
  }
  return buildOptions(readOptions, readParent)
})

const currentPathValue = computed(() => (
  activePath.value.length ? preferencePathValue(activePath.value) : ''
))

const filteredOptions = computed(() => {
  const readQuery = searchQuery.value.trim().toLocaleLowerCase()
  if (!readQuery) return []
  return allOptions.value
    .filter(readOption => [readOption.value, readOption.description]
      .filter(Boolean)
      .some(readText => readText.toLocaleLowerCase().includes(readQuery)))
    .slice(0, 50)
})

function isSelected(readValue) {
  return selectedSet.value.has(readValue)
}

function updateValues(readValues) {
  emit('update:modelValue', normalizePreferenceList(readValues))
}

function toggleValue(readValue) {
  if (readValue === ANY_PREFERENCE) {
    updateValues(isSelected(readValue) ? [] : [ANY_PREFERENCE])
    if (!isSelected(readValue)) pickerOpen.value = false
    return
  }
  if (hasAnyPreference.value) return
  const createValues = selectedValues.value.slice()
  const readIndex = createValues.indexOf(readValue)
  if (readIndex === -1) createValues.push(readValue)
  else createValues.splice(readIndex, 1)
  updateValues(createValues)
}

function removeValue(readValue) {
  updateValues(selectedValues.value.filter(updateValue => updateValue !== readValue))
}

function activateOption(readOption) {
  if (!readOption.children?.length) {
    toggleValue(readOption.value)
    return
  }
  activePath.value = readOption.path
}

function goToLevel(readDepth) {
  activePath.value = activePath.value.slice(0, readDepth)
}

async function keepPopoverInView() {
  await nextTick()
  const initialRect = popoverRef.value?.getBoundingClientRect()
  if (!initialRect) return
  popoverSpace.value = Math.ceil(initialRect.height + 16)
  await nextTick()
  const readRect = popoverRef.value?.getBoundingClientRect()
  if (!readRect) return
  const readOverflow = readRect.bottom - window.innerHeight + 48
  if (readOverflow > 0) {
    window.scrollBy({ top: readOverflow, behavior: 'smooth' })
  }
}

async function togglePicker() {
  if (hasAnyPreference.value) return
  pickerOpen.value = !pickerOpen.value
  if (!pickerOpen.value) return
  popoverSpace.value = 0
  activePath.value = []
  searchQuery.value = ''
  await keepPopoverInView()
}

function onPointerDown(readEvent) {
  if (!rootRef.value?.contains(readEvent.target)) pickerOpen.value = false
}

function onKeyDown(readEvent) {
  if (readEvent.key === 'Escape') pickerOpen.value = false
}

watch(hasAnyPreference, (readHasAny) => {
  if (readHasAny) pickerOpen.value = false
})

onMounted(() => {
  document.addEventListener('mousedown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.multi-level-tag-picker { position: relative; }
.tag-picker-field {
  min-height: 56px; display: flex; align-items: center; align-content: center; flex-wrap: wrap;
  gap: .48rem; padding: .55rem .65rem; border: 1px solid var(--border); border-radius: 16px;
  background: var(--bg-card); cursor: pointer; outline: none;
  transition: border-color var(--t), box-shadow var(--t);
}
.tag-picker-field:hover { border-color: var(--border-mid); }
.tag-picker-field:focus-visible, .tag-picker-field.open { border-color: var(--red); box-shadow: 0 0 0 3px var(--red-light); }
.tag-picker-field.locked { cursor: default; background: var(--bg-soft); }
.tag-picker-placeholder { color: var(--ink-3); font-size: .92rem; margin-left: .35rem; }
.preference-tag {
  display: inline-flex; align-items: center; gap: .35rem; max-width: 100%;
  padding: .38rem .55rem .38rem .7rem; border-radius: 999px;
  border: 1px solid var(--red-border); background: var(--red-light); color: var(--red);
  font-size: .82rem; line-height: 1.2; overflow-wrap: anywhere;
}
.preference-tag button, .tag-picker-head button, .tag-picker-search button {
  border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.preference-tag button { width: 18px; height: 18px; border-radius: 50%; }
.preference-tag button:hover { background: rgba(140, 21, 27, .1); }
.preference-tag i { font-size: .75rem; }
.tag-picker-chevron {
  margin-left: auto; padding: .45rem; color: var(--ink-3); font-size: .9rem;
  transition: color var(--t), transform var(--t);
}
.tag-picker-field:hover .tag-picker-chevron { color: var(--red); }
.tag-picker-chevron.open { color: var(--red); transform: rotate(180deg); }
.tag-picker-field.locked .tag-picker-chevron { color: var(--ink-4); }
.tag-picker-note { margin: .4rem .2rem 0; color: var(--ink-3); font-size: .76rem; line-height: 1.5; }
.tag-picker-popover {
  position: absolute; z-index: 120; top: calc(100% + .55rem); left: 0;
  width: min(640px, calc(100vw - 48px)); max-width: 100%; overflow: hidden;
  border: 1px solid var(--border); border-radius: 16px; background: #fff;
  box-shadow: 0 18px 45px rgba(28, 26, 24, .14);
}
.tag-picker-head { display: flex; align-items: center; justify-content: space-between; padding: .72rem .85rem .62rem; }
.tag-picker-head > div { display: flex; align-items: baseline; gap: .55rem; min-width: 0; }
.tag-picker-head strong { color: var(--ink); font-size: .9rem; }
.tag-picker-head span { color: var(--ink-3); font-size: .7rem; }
.tag-picker-head button { width: 28px; height: 28px; color: var(--ink-3); border-radius: 8px; flex: 0 0 auto; }
.tag-picker-head button:hover { background: var(--bg-soft); color: var(--ink); }
.tag-picker-search {
  margin: 0 .8rem .6rem; height: 36px; display: flex; align-items: center; gap: .45rem;
  padding: 0 .65rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-soft);
  color: var(--ink-3); transition: border-color var(--t), background var(--t);
}
.tag-picker-search:focus-within { border-color: var(--red-border); background: #fff; }
.tag-picker-search > i { font-size: .84rem; }
.tag-picker-search input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink);
  font-family: inherit; font-size: .78rem;
}
.tag-picker-search button { width: 22px; height: 22px; color: var(--ink-3); }
.tag-picker-nav {
  min-height: 39px; display: flex; align-items: center; justify-content: space-between; gap: .55rem;
  padding: .42rem .8rem; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.tag-picker-breadcrumb { min-width: 0; display: flex; align-items: center; gap: .18rem; overflow-x: auto; scrollbar-width: none; }
.tag-picker-breadcrumb::-webkit-scrollbar { display: none; }
.tag-picker-breadcrumb button {
  flex: 0 0 auto; border: 0; background: transparent; color: var(--ink-3); cursor: pointer;
  padding: .2rem .25rem; border-radius: 6px; font-family: inherit; font-size: .74rem;
}
.tag-picker-breadcrumb button:hover { background: var(--bg-soft); color: var(--ink); }
.tag-picker-breadcrumb button.current { color: var(--red); font-weight: 600; }
.tag-picker-breadcrumb i { flex: 0 0 auto; color: var(--ink-4); font-size: .62rem; }
.current-level-select {
  height: 28px; flex: 0 0 auto; display: inline-flex; align-items: center; gap: .28rem;
  border: 1px solid var(--red-border); border-radius: 8px; background: #fff; color: var(--red);
  padding: 0 .5rem; cursor: pointer; font-family: inherit; font-size: .7rem;
}
.current-level-select:hover, .current-level-select.selected { background: var(--red); border-color: var(--red); color: #fff; }
.current-level-select i { font-size: .7rem; }
.tag-picker-body { max-height: 131px; overflow-y: auto; padding: .5rem .55rem; scrollbar-gutter: stable; }
.tag-picker-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .32rem; }
.tag-option-row {
  min-width: 0; min-height: 40px; display: flex; align-items: center; border: 1px solid transparent;
  border-radius: 10px; background: #fff; color: var(--ink-2); transition: background var(--t), border-color var(--t);
}
.tag-option-row:hover { background: var(--bg-soft); }
.tag-option-row.selected { border-color: var(--red-border); background: var(--red-light); }
.tag-option-check {
  width: 26px; height: 26px; margin-left: .42rem; flex: 0 0 auto; border: 1px solid var(--border);
  border-radius: 8px; background: #fff; color: var(--ink-3); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.tag-option-check:hover, .tag-option-check.selected { color: #fff; border-color: var(--red); background: var(--red); }
.tag-option-check i { font-size: .76rem; }
.tag-option-main {
  flex: 1; min-width: 0; min-height: 36px; padding: .34rem .45rem; border: 0; background: transparent;
  color: inherit; cursor: pointer; display: flex; align-items: center; gap: .4rem;
  font-family: inherit; font-size: .8rem; text-align: left;
}
.tag-option-main span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag-option-main small { flex: 0 0 auto; color: var(--ink-4); font-size: .64rem; }
.tag-option-main > i { flex: 0 0 auto; color: var(--ink-4); font-size: .7rem; }
.search-results { padding-top: .2rem; }
.tag-picker-results { display: grid; gap: .25rem; }
.tag-search-result {
  width: 100%; min-height: 38px; display: flex; align-items: center; gap: .5rem;
  border: 1px solid transparent; border-radius: 9px; background: #fff; color: var(--ink-2);
  padding: .42rem .55rem; cursor: pointer; font-family: inherit; font-size: .76rem; text-align: left;
}
.tag-search-result:hover { background: var(--bg-soft); }
.tag-search-result.selected { border-color: var(--red-border); background: var(--red-light); color: var(--red); }
.tag-search-result i {
  width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
  flex: 0 0 auto; border: 1px solid currentColor; border-radius: 7px; font-size: .7rem;
}
.tag-search-result span { min-width: 0; overflow-wrap: anywhere; }
.tag-picker-empty { padding: 1.65rem .5rem; color: var(--ink-3); font-size: .78rem; text-align: center; }
.tag-picker-foot { padding: .55rem .85rem; border-top: 1px solid var(--border); color: var(--ink-3); background: var(--bg-soft); font-size: .7rem; }
.picker-fade-enter-active, .picker-fade-leave-active { transition: opacity .16s ease, transform .16s ease; transform-origin: top left; }
.picker-fade-enter-from, .picker-fade-leave-to { opacity: 0; transform: translateY(-5px) scale(.99); }
@media (max-width: 680px) {
  .tag-picker-popover { width: calc(100vw - 40px); }
  .tag-picker-options { grid-template-columns: 1fr; }
  .tag-picker-body { max-height: min(26vh, 170px); }
  .tag-picker-head span { display: none; }
}
</style>
