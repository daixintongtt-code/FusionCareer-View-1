<template>
  <div class="qt-tools">
    <div class="qt-buttons">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="!canApply || saving" :aria-describedby="!canApply ? `${dialogId}-apply-reason` : undefined" @click="openChooser">
        <i class="ti ti-template" aria-hidden="true" /> 使用模板
      </button>
      <button type="button" class="btn btn-secondary btn-sm" :disabled="!!saveDisabledReason || saving" :aria-describedby="saveDisabledReason ? `${dialogId}-save-reason` : undefined" @click="openSave">
        <i class="ti ti-bookmark" aria-hidden="true" /> 存为模板
      </button>
    </div>
    <small v-if="applyDisabledReason" :id="`${dialogId}-apply-reason`" class="qt-hint">{{ applyDisabledReason }}</small>
    <small v-if="saveDisabledReason" :id="`${dialogId}-save-reason`" class="qt-hint">{{ saveDisabledReason }}</small>
    <p v-if="notice" class="qt-notice" role="status">{{ notice }}</p>

    <Teleport to="body">
      <div v-if="mode" class="qt-backdrop" @click.self="requestClose">
        <section ref="dialogRef" class="qt-dialog" :class="{ 'qt-dialog-save': mode === 'save' }" role="dialog" aria-modal="true" :aria-labelledby="`${dialogId}-title`" :aria-describedby="`${dialogId}-description`" tabindex="-1" @keydown="onDialogKeydown">
          <header class="qt-header">
            <h2 :id="`${dialogId}-title`">{{ replacementPending ? '替换当前问卷？' : mode === 'save' ? '存为共享模板' : '使用共享模板' }}</h2>
            <button type="button" class="btn-icon" aria-label="关闭模板窗口" :disabled="saving" data-initial-focus @click="requestClose"><i class="ti ti-x" aria-hidden="true" /></button>
          </header>

          <template v-if="replacementPending">
            <div class="qt-body">
              <p :id="`${dialogId}-description`">当前问卷的 {{ questions.length }} 道题目将替换为「{{ selectedDetail?.name }}」的 {{ selectedDetail?.questions.length }} 道题目。</p>
              <p class="qt-hint">取消可保留当前题目。替换后仍需保存岗位，才会提交问卷。</p>
            </div>
            <footer class="qt-footer">
              <button type="button" class="btn btn-secondary btn-sm" @click="cancelReplacement">返回预览</button>
              <button type="button" class="btn btn-primary btn-sm" @click="confirmReplacement">确认替换</button>
            </footer>
          </template>

          <form v-else-if="mode === 'save'" @submit.prevent="saveTemplate">
            <div class="qt-body">
              <p :id="`${dialogId}-description`" class="qt-description">将当前 {{ saveSnapshot.length }} 道题目存为共享模板，供管理员在其他岗位中复用。</p>
              <label class="qt-field-label" :for="`${dialogId}-name`">模板名称</label>
              <input :id="`${dialogId}-name`" v-model="templateName" class="form-control" type="text" autocomplete="off" :disabled="saving" :aria-invalid="!!saveError" :aria-describedby="`${dialogId}-name-help`" placeholder="例如：实习岗位申请表" />
              <div :id="`${dialogId}-name-help`" class="qt-name-help"><span>1–80 个字符</span><span>{{ Array.from(templateName.trim()).length }}/80</span></div>
              <p v-if="saving" class="qt-state" role="status">正在保存模板，请等待结果后再关闭窗口…</p>
              <p v-if="closeHint" class="qt-hint" role="status">{{ closeHint }}</p>
              <p v-if="saveError" class="qt-error" role="alert">{{ saveError }}</p>
              <button v-if="saveError" type="button" class="btn btn-ghost btn-sm qt-inspect" @click="inspectAfterSaveFailure">查看模板列表</button>
            </div>
            <footer class="qt-footer">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="saving" @click="requestClose">取消</button>
              <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">{{ saving ? '保存中…' : saveError ? '重新保存' : '保存模板' }}</button>
            </footer>
          </form>

          <template v-else>
            <p :id="`${dialogId}-description`" class="qt-description qt-list-description">选择模板预览题目。应用后仍需保存岗位，才会提交问卷。</p>
            <div class="qt-picker">
              <div class="qt-list" aria-label="共享模板列表" :aria-busy="listLoading">
                <p v-if="listLoading" class="qt-state" role="status">正在加载模板…</p>
                <div v-else-if="listError" class="qt-state"><p class="qt-error" role="alert">{{ listError }}</p><button type="button" class="btn btn-secondary btn-sm" @click="loadList">重试</button></div>
                <p v-else-if="!templateList.length" class="qt-state" role="status">暂无共享模板。可先将当前问卷存为模板。</p>
                <button v-for="item in templateList" v-else :key="item.id" type="button" class="qt-template" :class="{ selected: selectedId === item.id }" :aria-pressed="selectedId === item.id" @click="selectTemplate(item.id)">
                  <span>{{ item.name }}</span><small>{{ item.questionCount }} 道题目</small>
                </button>
              </div>
              <div class="qt-preview" :aria-busy="detailLoading" aria-label="模板题目预览">
                <p v-if="detailLoading" class="qt-state" role="status">正在加载题目…</p>
                <div v-else-if="detailError" class="qt-state"><p class="qt-error" role="alert">{{ detailError }}</p><button type="button" class="btn btn-secondary btn-sm" @click="selectTemplate(selectedId)">重试</button></div>
                <template v-else-if="selectedDetail">
                  <h3>{{ selectedDetail.name }}</h3>
                  <ol class="qt-question-list">
                    <li v-for="(question, index) in selectedDetail.questions" :key="index" class="qt-question">
                      <p class="qt-question-title">{{ index + 1 }}. {{ question.title }}</p>
                      <p class="qt-question-meta">{{ QUESTION_TYPE_LABELS[question.questionType] }} · {{ question.required ? '必填' : '选填' }}</p>
                      <ul v-if="question.options.length" class="qt-options"><li v-for="(option, optionIndex) in question.options" :key="optionIndex">{{ option }}</li></ul>
                      <p v-if="question.placeholder" class="qt-placeholder">输入提示：{{ question.placeholder }}</p>
                    </li>
                  </ol>
                </template>
                <p v-else class="qt-state">选择左侧模板查看题目。</p>
              </div>
            </div>
            <footer class="qt-footer">
              <small v-if="!canApply" class="qt-hint">{{ applyDisabledReason }}</small>
              <button type="button" class="btn btn-secondary btn-sm" @click="requestClose">取消</button>
              <button type="button" class="btn btn-primary btn-sm" :disabled="!canApply || !selectedDetail || detailLoading" @click="applySelected">应用模板</button>
            </footer>
          </template>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount, getCurrentInstance } from 'vue'
import { readJson } from '@/lib/api'
import { QUESTION_TYPE_LABELS, cloneTemplateQuestions, buildTemplatePayload, canApplyTemplateToJob, createTemplateApi } from '@/lib/questionnaireTemplates.mjs'

const props = defineProps({
  questions: { type: Array, default: () => [] },
  editingId: { type: [String, Number], default: null },
  job: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['apply'])
const dialogId = `questionnaire-templates-${getCurrentInstance()?.uid ?? 'dialog'}`
const api = createTemplateApi(readJson)
const mode = ref(null)
const dialogRef = ref(null)
const notice = ref('')
const templateList = ref([])
const listLoading = ref(false)
const listError = ref('')
const selectedId = ref(null)
const selectedDetail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const replacementPending = ref(false)
const templateName = ref('')
const saveSnapshot = ref([])
const saving = ref(false)
const saveError = ref('')
const closeHint = ref('')
const canApply = computed(() => canApplyTemplateToJob(props.editingId, props.job))
const applyDisabledReason = computed(() => canApply.value ? '' : '仅新建岗位或尚无投递的下线草稿可使用模板。')
const saveDisabledReason = computed(() => {
  try { cloneTemplateQuestions(props.questions); return '' }
  catch (error) { return error.message }
})
let alive = true
let generation = 0
let listRequest = 0
let detailRequest = 0
let triggerElement = null

function current(session, kind) {
  return alive && session === generation && mode.value === kind
}

function focusDialog(session) {
  nextTick(() => {
    if (!alive || session !== generation || !mode.value) return
    const panel = dialogRef.value
    const initial = panel?.querySelector(mode.value === 'save' ? 'input:not([disabled])' : '[data-initial-focus]')
    if (initial) initial.focus()
    else panel?.focus()
  })
}

function beginDialog(kind) {
  if (!alive || saving.value) return false
  if (!mode.value) triggerElement = document.activeElement
  generation += 1
  mode.value = kind
  notice.value = ''
  replacementPending.value = false
  templateList.value = []
  selectedId.value = null
  selectedDetail.value = null
  listLoading.value = false
  listError.value = ''
  detailLoading.value = false
  detailError.value = ''
  saveError.value = ''
  closeHint.value = ''
  focusDialog(generation)
  return true
}

function closeDialog(restoreFocus = true) {
  generation += 1
  mode.value = null
  replacementPending.value = false
  templateList.value = []
  selectedDetail.value = null
  selectedId.value = null
  listLoading.value = false
  detailLoading.value = false
  const previousTrigger = triggerElement
  triggerElement = null
  const session = generation
  if (restoreFocus) nextTick(() => {
    if (alive && session === generation && !mode.value && previousTrigger?.isConnected) previousTrigger.focus()
  })
}

function requestClose() {
  if (!mode.value) return
  if (saving.value) {
    closeHint.value = '模板正在保存，请等待结果，避免重复保存。'
    return
  }
  closeDialog()
}

function openChooser() {
  if (!canApply.value || !beginDialog('choose')) return
  loadList()
}

async function loadList() {
  if (mode.value !== 'choose') return
  const session = generation, request = ++listRequest
  listLoading.value = true
  listError.value = ''
  templateList.value = []
  selectedId.value = null
  selectedDetail.value = null
  detailLoading.value = false
  detailError.value = ''
  detailRequest += 1
  try {
    const result = await api.list()
    if (current(session, 'choose') && request === listRequest) templateList.value = result
  } catch {
    if (current(session, 'choose') && request === listRequest) listError.value = '模板加载失败，请重试。'
  } finally {
    if (current(session, 'choose') && request === listRequest) listLoading.value = false
  }
}

async function selectTemplate(id) {
  if (mode.value !== 'choose' || !templateList.value.some(item => item.id === id)) return
  const session = generation, request = ++detailRequest
  selectedId.value = id
  selectedDetail.value = null
  detailLoading.value = true
  detailError.value = ''
  replacementPending.value = false
  try {
    const result = await api.get(id)
    if (current(session, 'choose') && request === detailRequest) {
      if (result.id !== id) throw new Error('模板内容与选择不一致')
      selectedDetail.value = result
    }
  } catch {
    if (current(session, 'choose') && request === detailRequest) detailError.value = '题目加载失败，请重试。'
  } finally {
    if (current(session, 'choose') && request === detailRequest) detailLoading.value = false
  }
}

function applyDefinitions() {
  if (!alive || mode.value !== 'choose' || !canApply.value || !selectedDetail.value || detailLoading.value) return
  const definitions = cloneTemplateQuestions(selectedDetail.value.questions)
  closeDialog()
  emit('apply', definitions)
  notice.value = '已应用模板，请检查题目并保存岗位。'
}

function applySelected() {
  if (!canApply.value || !selectedDetail.value || detailLoading.value || mode.value !== 'choose') return
  if (props.questions.length) {
    replacementPending.value = true
    focusDialog(generation)
  } else applyDefinitions()
}

function cancelReplacement() {
  replacementPending.value = false
  focusDialog(generation)
}

function confirmReplacement() {
  if (replacementPending.value) applyDefinitions()
}

function openSave() {
  if (saveDisabledReason.value || !beginDialog('save')) return
  saveSnapshot.value = cloneTemplateQuestions(props.questions)
  templateName.value = ''
}

async function saveTemplate() {
  if (!alive || mode.value !== 'save' || saving.value) return
  let payload
  try { payload = buildTemplatePayload(templateName.value, saveSnapshot.value) }
  catch (error) { saveError.value = error.message; return }
  const session = generation
  saving.value = true
  saveError.value = ''
  closeHint.value = ''
  focusDialog(session)
  try {
    const result = await api.create(payload.name, payload.questions)
    if (!current(session, 'save')) return
    closeDialog()
    notice.value = `已保存共享模板「${result.name}」。`
  } catch (error) {
    if (!current(session, 'save')) return
    saveError.value = error?.code === 409
      ? '模板名称已存在，请更换名称后重新保存。'
      : error?.code === 401
        ? '登录已失效，请重新登录后保存。'
        : error?.code === 400
          ? (error.serverMessage ?? error.message)?.trim() || '模板内容不符合要求，请检查后重新保存。'
          : '保存结果未确认，请先查看模板列表核对后，再决定是否重新保存。'
  } finally {
    if (alive) saving.value = false
  }
}

function inspectAfterSaveFailure() {
  if (!saveError.value || saving.value || !beginDialog('choose')) return
  loadList()
}

function onDialogKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    requestClose()
    return
  }
  if (event.key !== 'Tab') return
  const panel = dialogRef.value
  const elements = Array.from(panel?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || [])
  const first = elements[0], last = elements.at(-1)
  if (!first) { event.preventDefault(); panel?.focus(); return }
  if (!elements.includes(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => [props.editingId, props.job?.id, props.job?.status, props.job?.applicationCount, props.questions], () => {
  if (mode.value) {
    const pendingSave = saving.value
    closeDialog()
    notice.value = pendingSave ? '问卷或岗位已变化，请稍后到模板列表核对原问卷的保存结果。' : '问卷或岗位已变化，请重新打开模板窗口。'
  } else notice.value = ''
}, { deep: true, flush: 'sync' })

onBeforeUnmount(() => {
  alive = false
  closeDialog(false)
})
</script>

<style scoped>
.qt-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .7rem; min-width: 0; }
.qt-buttons { display: flex; gap: .4rem; flex-wrap: wrap; }
.qt-hint { color: var(--ink-3); font-size: .74rem; line-height: 1.6; }
.qt-notice { color: var(--green); font-size: .78rem; width: 100%; }
.qt-backdrop { position: fixed; inset: 0; z-index: 1600; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(28, 26, 24, .45); }
.qt-dialog { width: min(800px, 100%); max-height: calc(100dvh - 2rem); display: flex; flex-direction: column; background: var(--bg-card); color: var(--ink); border-radius: var(--r-lg); border: 1px solid var(--border); box-shadow: var(--shadow-md); overflow: auto; }
.qt-dialog-save { width: min(460px, 100%); }
.qt-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.qt-header h2 { font-size: 1rem; margin: 0; font-weight: 700; }
.qt-header .btn-icon { display: grid; place-items: center; width: 30px; height: 30px; }
.qt-body { padding: 1.2rem; }
.qt-body > p + p { margin-top: .65rem; }
.qt-description { color: var(--ink-2); font-size: .82rem; line-height: 1.7; margin-bottom: 1rem; }
.qt-list-description { padding: .9rem 1.2rem 0; margin-bottom: .8rem; }
.qt-field-label { display: block; font-size: .8rem; font-weight: 700; margin-bottom: .4rem; }
.qt-name-help { display: flex; justify-content: space-between; color: var(--ink-3); font-size: .72rem; margin-top: .35rem; }
.qt-picker { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 240px; max-height: min(56dvh, 520px); overflow: hidden; border-block: 1px solid var(--border); }
.qt-list { overflow: auto; background: var(--bg-soft); padding: .55rem; border-right: 1px solid var(--border); }
.qt-template { display: block; width: 100%; padding: .7rem .8rem; margin-bottom: .3rem; text-align: left; border: 1px solid transparent; border-radius: var(--r-sm); background: transparent; color: var(--ink-2); font-size: .8rem; overflow-wrap: anywhere; }
.qt-template:hover { background: var(--bg-card); }
.qt-template.selected { border-color: var(--red-border); background: var(--red-light); color: var(--red); }
.qt-template span { display: block; font-weight: 700; }
.qt-template small { display: block; color: var(--ink-3); margin-top: .2rem; font-size: .72rem; }
.qt-preview { padding: 1rem 1.2rem; overflow: auto; min-width: 0; }
.qt-preview h3 { font-size: .9rem; margin-bottom: .8rem; overflow-wrap: anywhere; }
.qt-question + .qt-question { border-top: 1px solid var(--border); margin-top: .8rem; padding-top: .8rem; }
.qt-question-title { font-size: .84rem; font-weight: 700; white-space: pre-wrap; overflow-wrap: anywhere; }
.qt-question-meta, .qt-placeholder { font-size: .74rem; color: var(--ink-3); margin-top: .3rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.qt-options { font-size: .78rem; margin-top: .45rem; padding-left: 1.1rem; list-style: disc; white-space: pre-wrap; overflow-wrap: anywhere; }
.qt-state { padding: .8rem .3rem; font-size: .8rem; color: var(--ink-3); line-height: 1.7; }
.qt-error { font-size: .8rem; color: var(--red); margin: .75rem 0; line-height: 1.7; }
.qt-inspect { margin-top: .35rem; }
.qt-footer { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: .6rem; padding: .9rem 1.2rem; flex-shrink: 0; }
.qt-footer > small { flex: 1 1 160px; }
.qt-dialog button:focus-visible, .qt-dialog input:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
.qt-dialog button:disabled, .qt-tools button:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 600px) {
  .qt-backdrop { padding: .6rem; }
  .qt-dialog { max-height: calc(100dvh - 1.2rem); }
  .qt-header, .qt-body, .qt-footer { padding: .85rem 1rem; }
  .qt-list-description { padding-inline: 1rem; }
  .qt-picker { grid-template-columns: 1fr; max-height: 65dvh; min-height: 180px; overflow: auto; }
  .qt-list { max-height: 180px; border-right: 0; border-bottom: 1px solid var(--border); }
  .qt-preview { overflow: visible; padding: .9rem 1rem; }
}
</style>
