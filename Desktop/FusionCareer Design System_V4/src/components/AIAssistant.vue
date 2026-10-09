<template>
  <div v-if="visible" class="ai-layer">
    <Transition name="ai-panel">
      <section v-if="open" :class="['ai-panel', isJobDetail && 'ai-panel-resume']" :style="panelStyle" aria-label="AI 求职助手">
        <header>
          <div class="ai-brand"><span><i class="ti ti-sparkles" /></span><div><strong>{{ assistantTitle }}</strong><small>{{ assistantSubtitle }}</small></div></div>
          <button type="button" aria-label="关闭" @click="open=false"><i class="ti ti-x" /></button>
        </header>
        <div v-if="isJobDetail" class="ai-context"><i class="ti ti-briefcase" /><span v-if="currentJob">正在针对「{{ currentJob.positionName }} · {{ currentJob.companyName }}」优化</span><span v-else>正在读取当前岗位信息…</span></div>
        <div class="ai-body">
          <template v-if="isHome">
            <div class="assistant-message"><i class="ti ti-sparkles" /><div>先告诉我你感兴趣的就业方向吧，可以多选。</div></div>
            <div class="recommend-options"><button v-for="option in INTENTION_OPTIONS" :key="option.value" type="button" :class="{selected:intentionValues.includes(option.value)}" @click="toggleValue(intentionValues, option.value)">{{ option.label }}</button></div>
            <button v-if="recommendStep===1" class="recommend-next" type="button" :disabled="!intentionValues.length" @click="recommendStep=2">继续选择意向城市<i class="ti ti-arrow-right" /></button>
            <template v-if="recommendStep>=2">
              <div class="user-message">{{ intentionLabels.join('、') }}</div>
              <div class="assistant-message"><i class="ti ti-map-pin" /><div>你更希望在哪些城市工作？也可以多选。</div></div>
              <div class="city-select" @click.stop>
                <button class="city-select-trigger" type="button" :class="{open:cityDropdownOpen}" @click="cityDropdownOpen=!cityDropdownOpen">
                  <span class="city-trigger-icon"><i class="ti ti-map-pin" /></span>
                  <span class="city-trigger-copy"><strong>{{ cityValues.length ? '已选择意向城市' : '请选择意向城市' }}</strong><small>{{ cityValues.length ? citySelectionSummary : '支持搜索和多选全国主要城市' }}</small></span>
                  <b v-if="cityValues.length">{{ cityValues.length }}</b><i class="ti ti-chevron-down city-trigger-arrow" />
                </button>
                <div v-if="cityDropdownOpen" class="city-select-menu">
                  <div class="city-menu-head"><div><strong>选择意向城市</strong><small>可多选</small></div><button type="button" @click="cityDropdownOpen=false"><i class="ti ti-x" /></button></div>
                  <div class="city-search"><i class="ti ti-search" /><input v-model="citySearch" placeholder="输入城市名称快速查找" /><button v-if="citySearch" type="button" @click="citySearch=''">×</button></div>
                  <div class="city-scroll">
                    <template v-for="group in filteredCityGroups" :key="group.province">
                      <div class="city-group-label">{{ group.province }}</div>
                      <div class="city-group-grid"><button v-for="city in group.cities" :key="city" type="button" :class="['city-option', cityValues.includes(city) && 'selected']" @click="toggleCity(city)"><i v-if="cityValues.includes(city)" class="ti ti-check" />{{ city }}</button></div>
                    </template>
                    <div v-if="!filteredCityGroups.length" class="city-no-result">没有找到相关城市</div>
                  </div>
                  <div class="city-menu-foot"><span>已选择 {{ cityValues.length }} 项</span><button type="button" @click="cityDropdownOpen=false">完成选择</button></div>
                </div>
              </div>
              <div v-if="cityValues.length" class="selected-cities"><span v-for="city in cityValues" :key="city">{{ city }}<button type="button" @click="toggleCity(city)">×</button></span></div>
              <button v-if="recommendStep===2" class="recommend-submit" type="button" :disabled="!cityValues.length" @click="submitPreferences"><i class="ti ti-sparkles" />为我推荐岗位</button>
            </template>
            <div v-if="recommendLoading" class="recommend-loading"><i class="ti ti-loader-2" />正在匹配适合你的岗位…</div>
            <div v-if="recommendError" class="recommend-error"><i class="ti ti-alert-circle" />{{ recommendError }}<button type="button" @click="submitPreferences">重试</button></div>
            <template v-if="recommendStep===3 && !recommendLoading && !recommendError">
              <div class="user-message">{{ cityValues.join('、') }}</div>
              <div class="assistant-message"><i class="ti ti-stars" /><div>为你找到 {{ recommendations.length }} 个推荐岗位，点击卡片可在新标签页查看。</div></div>
              <div v-if="recommendations.length" class="recommend-list">
                <button v-for="job in recommendations" :key="job.id" class="recommend-card" type="button" @click="openJob(job.id)">
                  <div><strong>{{ job.positionName }}</strong><span v-if="job.matchScore != null">匹配 {{ formatScore(job.matchScore) }}</span></div>
                  <p>{{ job.companyName }}<template v-if="job.workCity"> · {{ job.workCity }}</template></p>
                  <small v-if="job.recommendationReason">{{ job.recommendationReason }}</small><i class="ti ti-external-link" />
                </button>
              </div>
              <div v-else class="recommend-empty">暂时没有找到合适岗位，可以调整选项后再试。</div>
              <button class="recommend-restart" type="button" @click="resetRecommendation"><i class="ti ti-refresh" />重新选择</button>
            </template>
          </template>
          <template v-else-if="isJobDetail">
            <div v-if="!resumeAdvice" class="resume-advice-start">
              <div class="assistant-message resume-intro"><i class="ti ti-file-search" /><div><strong>选择要检查的简历</strong><span>AI 会对照当前岗位要求，给出匹配判断、证据与可直接落地的修改建议。</span></div></div>

              <div class="resume-source-title"><span>从我的简历选择</span><button type="button" :disabled="resumeFilesLoading" @click="loadResumeFiles"><i class="ti ti-refresh" />刷新</button></div>
              <div v-if="resumeFilesLoading" class="resume-files-state"><i class="ti ti-loader-2" />正在加载我的简历…</div>
              <div v-else-if="resumeFiles.length" class="resume-file-grid">
                <button v-for="readFile in resumeFiles" :key="readFile.id" type="button" :class="['resume-file-card', selectedResume?.type==='stored' && selectedResume.id===readFile.id && 'selected']" @click="selectStoredResume(readFile)">
                  <span class="resume-file-icon"><i :class="['ti', resumeIcon(readFile.name)]" /></span>
                  <span class="resume-file-copy"><strong>{{ readFile.name }}</strong><small>{{ formatFileMeta(readFile) }}</small></span>
                  <i v-if="selectedResume?.type==='stored' && selectedResume.id===readFile.id" class="ti ti-circle-check-filled resume-selected-mark" />
                </button>
              </div>
              <div v-else class="resume-files-state resume-files-empty"><i class="ti ti-file-off" /><span>还没有已上传的简历，也可以直接上传本地文件。</span></div>

              <div class="resume-divider"><span>或实时上传</span></div>
              <label :class="['resume-upload', selectedResume?.type==='upload' && 'selected']">
                <input ref="resumeFileInput" type="file" :accept="RESUME_ADVICE_ACCEPT" @change="handleResumeFile" />
                <span class="resume-upload-icon"><i :class="['ti', selectedResume?.type==='upload' ? 'ti-file-check' : 'ti-cloud-upload']" /></span>
                <span><strong>{{ selectedResume?.type==='upload' ? selectedResume.name : '点击选择简历文件' }}</strong><small>支持 PDF、DOCX、JPG、JPEG、PNG，最大 20 MB</small></span>
                <i class="ti ti-chevron-right" />
              </label>
              <div v-if="resumeFileError" class="resume-file-error"><i class="ti ti-alert-circle" />{{ resumeFileError }}</div>

              <button class="resume-analyze" type="button" :disabled="!selectedResume || resumeAdviceLoading" @click="submitResumeAdvice">
                <i :class="['ti', resumeAdviceLoading ? 'ti-loader-2' : 'ti-sparkles']" />{{ resumeAdviceLoading ? '正在分析岗位与简历…' : '生成简历修改建议' }}
              </button>
              <div v-if="resumeAdviceError" class="recommend-error resume-advice-error"><i class="ti ti-alert-circle" />{{ resumeAdviceError }}<button type="button" @click="submitResumeAdvice">重试</button></div>
              <p class="resume-privacy"><i class="ti ti-lock" />简历仅用于本次分析，请勿提交与求职无关的敏感信息</p>
            </div>

            <div v-else class="resume-advice-result">
              <div class="resume-result-head">
                <div><span class="resume-result-kicker"><i class="ti ti-circle-check-filled" />分析完成</span><strong>{{ selectedResume?.name }}</strong><small>{{ currentJob ? `${currentJob.positionName} · ${currentJob.companyName}` : '当前岗位' }}</small></div>
                <button type="button" @click="resetResumeAdvice"><i class="ti ti-switch-horizontal" />更换简历</button>
              </div>
              <ResumeAdviceRenderer :markdown="resumeAdvice.markdown" />
              <button class="resume-regenerate" type="button" :disabled="resumeAdviceLoading" @click="submitResumeAdvice"><i class="ti ti-refresh" />重新生成</button>
            </div>
          </template>
          <template v-else>
            <div class="ai-welcome"><strong>你好，我是你的 AI 求职助手</strong><span>后续接入模型后，你可以直接告诉我想解决的问题。</span></div>
            <div class="ai-capabilities">
              <div><i class="ti ti-target-arrow" /><span>结合个人经历和岗位要求，分析人岗匹配度</span></div>
              <div><i class="ti ti-file-description" /><span>检查简历内容，提供针对目标岗位的优化建议</span></div>
              <div><i class="ti ti-bulb" /><span>解答岗位选择、投递准备和求职过程中的问题</span></div>
            </div>
            <div class="ai-input-placeholder"><span>例如：我和这个岗位匹配吗？如何修改简历？</span><button type="button" disabled title="接入模型后启用"><i class="ti ti-arrow-up" /></button></div>
            <div class="ai-coming"><i class="ti ti-sparkles" />AI 模型接入后即可开始对话</div>
          </template>
        </div>
        <footer><i class="ti ti-shield-check" />AI 建议仅供参考，请结合实际情况判断</footer>
      </section>
    </Transition>
    <button ref="ball" class="ai-ball" :class="{dragging}" :style="ballStyle" type="button" aria-label="打开 AI 求职助手" @pointerdown="startDrag" @click="toggleAssistant">
      <span /><i class="ti ti-sparkles" /><b>AI</b>
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CITY_GROUPS, INTENTION_OPTIONS, requestJobRecommendations } from '@/lib/jobRecommendation.mjs'
import { readJson } from '@/lib/api'
import {
  loadResumeAdviceFiles,
  requestResumeAdvice,
  RESUME_ADVICE_ACCEPT,
  validateResumeAdviceFile,
} from '@/lib/resumeAdvice.mjs'
import ResumeAdviceRenderer from '@/components/ResumeAdviceRenderer.vue'

const route = useRoute()
const router = useRouter()
const open = ref(false)
const dragging = ref(false)
const position = ref({ x:null, y:null })
const visible = computed(() => !route.path.startsWith('/login') && !route.path.startsWith('/admin'))
const isHome = computed(() => route.path === '/home')
const isJobDetail = computed(() => route.path.startsWith('/job/') && !!route.params.id)
const assistantTitle = computed(() => isHome.value ? '岗位推荐助手' : isJobDetail.value ? '简历修改助手' : '复新 AI')
const assistantSubtitle = computed(() => isHome.value ? '根据你的偏好寻找合适机会' : isJobDetail.value ? '对照当前岗位，逐项优化简历' : '你的求职与简历助手')
const recommendStep = ref(1)
const intentionValues = ref([])
const cityValues = ref([])
const cityDropdownOpen = ref(false)
const citySearch = ref('')
const recommendations = ref([])
const recommendLoading = ref(false)
const recommendError = ref('')
const currentJob = ref(null)
const resumeFiles = ref([])
const resumeFilesLoading = ref(false)
const selectedResume = ref(null)
const resumeFileInput = ref(null)
const resumeFileError = ref('')
const resumeAdvice = ref(null)
const resumeAdviceLoading = ref(false)
const resumeAdviceError = ref('')
let suppressAssistantClick = false
const intentionLabels = computed(() => INTENTION_OPTIONS.filter(item => intentionValues.value.includes(item.value)).map(item => item.label))
const citySelectionSummary = computed(() => cityValues.value.length > 3
  ? `${cityValues.value.slice(0, 3).join('、')}等`
  : cityValues.value.join('、'))
const filteredCityGroups = computed(() => {
  const keyword = citySearch.value.trim().toLowerCase()
  if (!keyword) return CITY_GROUPS
  return CITY_GROUPS.map(group => ({
    ...group,
    cities:group.cities.filter(city => city.toLowerCase().includes(keyword)),
  })).filter(group => group.cities.length)
})
const ballStyle = computed(() => position.value.x == null ? {} : ({ left:`${position.value.x}px`, top:`${position.value.y}px`, right:'auto', bottom:'auto' }))
const panelStyle = computed(() => {
  if (position.value.x == null) return {}
  const width = Math.min(isJobDetail.value ? 720 : 390, window.innerWidth - 24)
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, position.value.x - width + 56))
  const above = position.value.y > 470
  return { left:`${left}px`, right:'auto', top:above ? 'auto' : `${Math.min(position.value.y + 68, window.innerHeight - 470)}px`, bottom:above ? `${window.innerHeight - position.value.y + 12}px` : 'auto' }
})

async function loadCurrentJob() {
  if (!isJobDetail.value) { currentJob.value = null; return }
  try {
    currentJob.value = await readJson(`/job/${route.params.id}`)
  } catch {
    currentJob.value = null
  }
}

async function loadResumeFiles() {
  if (!isJobDetail.value) return
  resumeFilesLoading.value = true
  try {
    resumeFiles.value = await loadResumeAdviceFiles()
  } catch (readError) {
    resumeFiles.value = []
    resumeFileError.value = readError?.message || '暂时无法加载已上传简历'
  } finally {
    resumeFilesLoading.value = false
  }
}

function selectStoredResume(readFile) {
  selectedResume.value = { type:'stored', id:readFile.id, name:readFile.name }
  resumeFileError.value = ''
  resumeAdviceError.value = ''
  if (resumeFileInput.value) resumeFileInput.value.value = ''
}

function handleResumeFile(readEvent) {
  const readFile = readEvent.target.files?.[0]
  const readError = validateResumeAdviceFile(readFile)
  if (readError) {
    selectedResume.value = null
    resumeFileError.value = readError
    readEvent.target.value = ''
    return
  }
  selectedResume.value = { type:'upload', file:readFile, name:readFile.name }
  resumeFileError.value = ''
  resumeAdviceError.value = ''
}

async function submitResumeAdvice() {
  if (!selectedResume.value || !route.params.id) return
  resumeAdviceLoading.value = true
  resumeAdviceError.value = ''
  try {
    resumeAdvice.value = await requestResumeAdvice(route.params.id, selectedResume.value)
  } catch (readError) {
    resumeAdviceError.value = readError?.message || '简历分析服务暂时不可用'
  } finally {
    resumeAdviceLoading.value = false
  }
}

function resetResumeAdvice() {
  resumeAdvice.value = null
  resumeAdviceError.value = ''
}

function resumeIcon(readName) {
  const readValue = String(readName || '').toLowerCase()
  if (readValue.endsWith('.pdf')) return 'ti-file-type-pdf'
  if (/\.(jpg|jpeg|png)$/.test(readValue)) return 'ti-photo'
  return 'ti-file-type-doc'
}

function formatFileMeta(readFile) {
  const readExtension = String(readFile.name || '').split('.').pop().toUpperCase()
  const readSize = Number(readFile.fileSize || 0)
  if (!readSize) return readExtension || '简历文件'
  const readLabel = readSize >= 1024 * 1024 ? `${(readSize / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(readSize / 1024))} KB`
  return [readExtension, readLabel].filter(Boolean).join(' · ')
}

function startDrag(event) {
  if (event.button !== 0) return
  const start = { x:event.clientX, y:event.clientY }
  const rect = event.currentTarget.getBoundingClientRect()
  let moved = false
  dragging.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
  const move = moveEvent => {
    const dx = moveEvent.clientX - start.x
    const dy = moveEvent.clientY - start.y
    if (Math.hypot(dx, dy) > 5) moved = true
    position.value = {
      x:Math.max(8, Math.min(window.innerWidth - 64, rect.left + dx)),
      y:Math.max(72, Math.min(window.innerHeight - 64, rect.top + dy)),
    }
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    dragging.value = false
    suppressAssistantClick = moved
    if (moved) localStorage.setItem('fusion-career-ai-position', JSON.stringify(position.value))
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end, { once:true })
}

function toggleAssistant() {
  if (suppressAssistantClick) {
    suppressAssistantClick = false
    return
  }
  open.value = !open.value
}

function toggleValue(readList, readValue) {
  const index = readList.indexOf(readValue)
  if (index >= 0) readList.splice(index, 1)
  else readList.push(readValue)
}

function toggleCity(readCity) {
  if (readCity === '不限城市') {
    cityValues.value = cityValues.value.includes(readCity) ? [] : [readCity]
    return
  }
  cityValues.value = cityValues.value.filter(item => item !== '不限城市')
  toggleValue(cityValues.value, readCity)
}

async function submitPreferences() {
  recommendLoading.value = true
  recommendError.value = ''
  recommendations.value = []
  try {
    recommendations.value = await requestJobRecommendations(intentionValues.value, cityValues.value)
    recommendStep.value = 3
  } catch (readError) {
    recommendError.value = readError?.message || '推荐服务暂时不可用'
  } finally {
    recommendLoading.value = false
  }
}

function formatScore(readScore) {
  const score = Number(readScore)
  if (!Number.isFinite(score)) return readScore
  return `${score <= 1 ? Math.round(score * 100) : Math.round(score)}%`
}

function openJob(readJobId) {
  const readWindow = window.open(router.resolve(`/job/${readJobId}`).href, '_blank', 'noopener,noreferrer')
  if (readWindow) readWindow.opener = null
}

function resetRecommendation() {
  recommendStep.value = 1
  intentionValues.value = []
  cityValues.value = []
  cityDropdownOpen.value = false
  citySearch.value = ''
  recommendations.value = []
  recommendError.value = ''
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('fusion-career-ai-position') || 'null')
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position.value = saved
  } catch { /* 使用默认位置 */ }
})

watch(() => [open.value, route.fullPath], ([readOpen]) => {
  if (!readOpen || !isJobDetail.value) return
  loadCurrentJob()
  loadResumeFiles()
}, { immediate:true })

watch(() => route.fullPath, () => {
  currentJob.value = null
  selectedResume.value = null
  resumeAdvice.value = null
  resumeAdviceError.value = ''
  resumeFileError.value = ''
})
</script>

<style scoped>
.ai-layer{position:fixed;inset:0;z-index:180;pointer-events:none}.ai-ball{pointer-events:auto;position:fixed;right:26px;bottom:28px;width:58px;height:58px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.52);border-radius:50%;color:#fff;background:linear-gradient(145deg,#b92845,#84162a);box-shadow:0 10px 30px rgba(126,19,39,.3),inset 0 1px 1px rgba(255,255,255,.35);cursor:grab;touch-action:none;user-select:none;overflow:hidden}.ai-ball.dragging{cursor:grabbing;transform:scale(1.04)}.ai-ball>span{position:absolute;width:42px;height:42px;left:-10px;top:-12px;border-radius:50%;background:rgba(255,255,255,.2);filter:blur(3px)}.ai-ball>i{position:relative;z-index:1;font-size:1.4rem;transform:translateY(-5px)}.ai-ball>b{position:absolute;z-index:1;bottom:8px;font-size:.58rem;letter-spacing:.08em}.ai-panel{pointer-events:auto;position:fixed;right:26px;bottom:98px;width:min(390px,calc(100vw - 24px));overflow:hidden;background:rgba(255,255,255,.98);border:1px solid rgba(164,31,51,.16);border-radius:20px;box-shadow:0 22px 65px rgba(38,22,25,.2)}.ai-panel>header{display:flex;justify-content:space-between;align-items:center;padding:.9rem 1rem;color:#fff;background:linear-gradient(120deg,#8f192f,#b52b47)}.ai-brand{display:flex;align-items:center;gap:.65rem}.ai-brand>span{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:rgba(255,255,255,.16)}.ai-brand>div{display:flex;flex-direction:column}.ai-brand strong{font-size:.9rem}.ai-brand small{margin-top:.1rem;color:rgba(255,255,255,.76);font-size:.65rem}.ai-panel>header>button{border:0;background:transparent;color:#fff;font-size:1rem;cursor:pointer}.ai-context{padding:.45rem .9rem;color:#7e182c;background:#fbf0f2;border-bottom:1px solid #f0d7dc;font-size:.7rem}.ai-context i{margin-right:.3rem}.ai-body{padding:1rem}.ai-welcome{display:flex;flex-direction:column;gap:.2rem;margin-bottom:.8rem}.ai-welcome strong{font-size:.88rem;color:var(--ink)}.ai-welcome span{font-size:.72rem;color:var(--ink-3)}.ai-capabilities{display:flex;flex-direction:column;gap:.5rem}.ai-capabilities div{display:flex;align-items:flex-start;gap:.55rem;padding:.7rem;border:1px solid var(--border);border-radius:12px;background:var(--bg-soft);color:var(--ink-2);font-size:.72rem;line-height:1.5}.ai-capabilities i{margin-top:.08rem;color:var(--red);font-size:1rem;flex-shrink:0}.ai-input-placeholder{display:flex;align-items:center;gap:.5rem;margin-top:.8rem;padding:.45rem .45rem .45rem .75rem;border:1px solid var(--border-mid);border-radius:12px;background:#fff}.ai-input-placeholder span{flex:1;color:var(--ink-4);font-size:.68rem}.ai-input-placeholder button{width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:9px;color:#fff;background:var(--ink-4);opacity:.55}.ai-coming{margin-top:.55rem;color:var(--ink-3);font-size:.64rem;text-align:center}.ai-coming i{margin-right:.25rem;color:var(--gold)}.ai-panel>footer{padding:.55rem .9rem;border-top:1px solid var(--border);color:var(--ink-4);font-size:.61rem;text-align:center}.ai-panel>footer i{margin-right:.25rem}.ai-panel-enter-active,.ai-panel-leave-active{transition:opacity .18s,transform .18s}.ai-panel-enter-from,.ai-panel-leave-to{opacity:0;transform:translateY(8px) scale(.98)}@media(max-width:520px){.ai-ball{right:16px;bottom:18px}.ai-panel{left:12px!important;right:12px!important;bottom:86px;width:auto}}
.assistant-message{display:flex;align-items:flex-start;gap:.45rem;margin-bottom:.65rem;color:var(--ink-2);font-size:.72rem;line-height:1.5}.assistant-message>i{margin-top:.15rem;color:var(--gold);flex-shrink:0}.assistant-message>div{padding:.6rem .7rem;border:1px solid var(--border);border-radius:4px 12px 12px 12px;background:var(--bg-soft)}.user-message{width:max-content;max-width:82%;margin:.75rem 0 .75rem auto;padding:.5rem .65rem;border-radius:12px 4px 12px 12px;color:#fff;background:var(--red);font-size:.68rem}.recommend-options{display:flex;flex-wrap:wrap;gap:.38rem;margin-left:1.15rem}.recommend-options button{padding:.36rem .58rem;border:1px solid var(--border-mid);border-radius:999px;color:var(--ink-2);background:#fff;font-size:.68rem;cursor:pointer}.recommend-options button:hover,.recommend-options button.selected{color:var(--red);border-color:var(--red-border);background:var(--red-light)}.city-options button.selected{color:#855e0c;border-color:rgba(184,135,30,.4);background:var(--gold-light)}.recommend-next,.recommend-submit,.recommend-restart{display:flex;align-items:center;justify-content:center;gap:.3rem;width:calc(100% - 1.15rem);margin:.7rem 0 0 1.15rem;padding:.52rem;border:0;border-radius:10px;font-size:.7rem;font-weight:600;cursor:pointer}.recommend-next{color:var(--red);background:var(--red-light)}.recommend-submit{color:#fff;background:linear-gradient(120deg,#a41f33,#bd334d)}.recommend-next:disabled,.recommend-submit:disabled{opacity:.45;cursor:not-allowed}.recommend-loading{display:flex;align-items:center;justify-content:center;gap:.4rem;padding:1.3rem;color:var(--ink-3);font-size:.7rem}.recommend-loading i{animation:recommend-spin .8s linear infinite}@keyframes recommend-spin{to{transform:rotate(360deg)}}.recommend-error{display:flex;align-items:center;gap:.35rem;margin-top:.75rem;padding:.62rem;border:1px solid #f3c6cd;border-radius:10px;color:#9a2338;background:#fff4f5;font-size:.68rem}.recommend-error button{margin-left:auto;border:0;color:var(--red);background:transparent;font-weight:600;cursor:pointer}.recommend-list{display:flex;flex-direction:column;gap:.45rem;margin-left:1.15rem}.recommend-card{position:relative;padding:.65rem 1.9rem .65rem .7rem;border:1px solid var(--border);border-radius:12px;text-align:left;background:#fff;cursor:pointer}.recommend-card:hover{border-color:var(--red-border);box-shadow:0 6px 18px rgba(0,0,0,.06)}.recommend-card>div{display:flex;align-items:center;gap:.35rem}.recommend-card strong{flex:1;color:var(--ink);font-size:.75rem}.recommend-card>div span{padding:.1rem .3rem;border-radius:999px;color:#2f7746;background:#edf8f0;font-size:.58rem}.recommend-card p{margin:.2rem 0 0;color:var(--ink-3);font-size:.65rem}.recommend-card small{display:block;margin-top:.3rem;color:var(--ink-2);font-size:.62rem;line-height:1.4}.recommend-card>i{position:absolute;right:.65rem;top:50%;color:var(--ink-4);transform:translateY(-50%)}.recommend-empty{margin-left:1.15rem;padding:.9rem;border:1px dashed var(--border-mid);border-radius:12px;color:var(--ink-3);font-size:.68rem;text-align:center}.recommend-restart{color:var(--ink-2);background:var(--bg-soft)}
.ai-panel{max-height:min(650px,calc(100vh - 120px));display:flex;flex-direction:column}.ai-body{overflow-y:auto}
.city-select{position:relative;margin-left:1.15rem}.city-select-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;padding:.58rem .7rem;border:1px solid var(--border-mid);border-radius:10px;color:var(--ink-2);background:#fff;font-size:.7rem;cursor:pointer}.city-select-trigger.open{color:var(--red);border-color:var(--red-border);box-shadow:0 0 0 3px rgba(164,31,51,.07)}.city-select-trigger i{transition:transform var(--t)}.city-select-trigger.open i{transform:rotate(180deg)}.city-select-menu{position:absolute;z-index:20;left:0;right:0;top:calc(100% + 5px);padding:.5rem;background:#fff;border:1px solid var(--border-mid);border-radius:12px;box-shadow:0 12px 30px rgba(28,26,24,.14)}.city-search{display:flex;align-items:center;gap:.35rem;padding:.4rem .55rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-soft)}.city-search i{color:var(--ink-4);font-size:.8rem}.city-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--ink);font-size:.68rem}.city-scroll{max-height:220px;overflow-y:auto;margin-top:.4rem;padding-right:.15rem}.city-group-label{padding:.42rem .45rem .18rem;color:var(--ink-4);font-size:.6rem;font-weight:700;letter-spacing:.05em}.city-option{width:100%;display:flex;align-items:center;gap:.4rem;padding:.42rem .48rem;border:0;border-radius:7px;color:var(--ink-2);background:transparent;font-size:.68rem;text-align:left;cursor:pointer}.city-option:hover{background:var(--bg-soft)}.city-option.selected{color:var(--red);background:var(--red-light)}.city-option i{font-size:.8rem}.city-no-result{padding:1rem;color:var(--ink-3);font-size:.68rem;text-align:center}.selected-cities{display:flex;flex-wrap:wrap;gap:.3rem;margin:.45rem 0 0 1.15rem}.selected-cities>span{display:inline-flex;align-items:center;gap:.22rem;padding:.2rem .25rem .2rem .45rem;border-radius:999px;color:#855e0c;background:var(--gold-light);font-size:.62rem}.selected-cities button{width:17px;height:17px;display:grid;place-items:center;border:0;border-radius:50%;color:#855e0c;background:rgba(184,135,30,.14);cursor:pointer}
.city-select-trigger{display:grid;grid-template-columns:34px minmax(0,1fr) auto 16px;gap:.55rem;align-items:center;padding:.6rem .7rem;text-align:left;border-color:#e5d8bb;border-radius:13px;background:linear-gradient(135deg,#fff 0%,#fffcf5 100%);box-shadow:0 3px 10px rgba(92,65,14,.04)}.city-select-trigger:hover{border-color:rgba(184,135,30,.45);box-shadow:0 5px 16px rgba(92,65,14,.08)}.city-select-trigger.open{color:var(--ink);border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,135,30,.1)}.city-trigger-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;color:#9a6d12;background:var(--gold-light)}.city-select-trigger.open .city-trigger-icon i{transform:none}.city-trigger-copy{display:flex;flex-direction:column;gap:.12rem;min-width:0}.city-trigger-copy strong{color:var(--ink);font-size:.72rem}.city-trigger-copy small{overflow:hidden;color:var(--ink-3);font-size:.6rem;text-overflow:ellipsis;white-space:nowrap}.city-select-trigger>b{min-width:20px;height:20px;display:grid;place-items:center;padding:0 .25rem;border-radius:999px;color:#fff;background:var(--gold);font-size:.58rem}.city-trigger-arrow{color:var(--ink-4);font-size:.7rem}.city-select-trigger.open .city-trigger-arrow{transform:rotate(180deg)}.city-select-menu{left:auto;right:0;width:min(330px,calc(100vw - 52px));top:calc(100% + 7px);padding:0;overflow:hidden;border-color:#e4dac4;border-radius:15px;box-shadow:0 18px 44px rgba(42,32,14,.16)}.city-menu-head{display:flex;align-items:center;justify-content:space-between;padding:.7rem .8rem .5rem}.city-menu-head>div{display:flex;align-items:center;gap:.4rem}.city-menu-head strong{color:var(--ink);font-size:.75rem}.city-menu-head small{padding:.1rem .35rem;border-radius:999px;color:#8a6418;background:var(--gold-light);font-size:.56rem}.city-menu-head>button{width:25px;height:25px;display:grid;place-items:center;border:0;border-radius:7px;color:var(--ink-3);background:var(--bg-soft);cursor:pointer}.city-search{margin:0 .7rem;padding:.48rem .6rem;border-color:var(--border);border-radius:9px;background:#faf9f6}.city-search:focus-within{border-color:rgba(184,135,30,.55);box-shadow:0 0 0 3px rgba(184,135,30,.08)}.city-search input{font-size:.65rem}.city-search>button{border:0;color:var(--ink-4);background:transparent;cursor:pointer}.city-scroll{max-height:245px;margin-top:.35rem;padding:0 .55rem .55rem}.city-scroll::-webkit-scrollbar{width:4px}.city-scroll::-webkit-scrollbar-thumb{border-radius:4px;background:#d7ccb4}.city-group-label{display:flex;align-items:center;gap:.35rem;padding:.5rem .2rem .3rem;color:#8c806b}.city-group-label::after{content:'';height:1px;flex:1;background:#f0ebe2}.city-group-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.25rem}.city-option{width:auto;justify-content:center;position:relative;padding:.38rem .25rem;border:1px solid transparent;text-align:center}.city-option:hover{color:#8a6418;border-color:#eadfc7;background:#fffaf0}.city-option.selected{color:#875f0f;border-color:#e3cb96;background:var(--gold-light);font-weight:600}.city-option.selected i{position:absolute;right:3px;top:3px;font-size:.55rem}.city-menu-foot{display:flex;align-items:center;justify-content:space-between;padding:.55rem .7rem;border-top:1px solid var(--border);background:#fcfbf8}.city-menu-foot span{color:var(--ink-3);font-size:.62rem}.city-menu-foot button{padding:.35rem .7rem;border:0;border-radius:8px;color:#fff;background:linear-gradient(120deg,#ad7d1d,#c39435);font-size:.65rem;font-weight:600;cursor:pointer}.selected-cities{margin-top:.5rem}.selected-cities>span{padding:.25rem .28rem .25rem .5rem;border:1px solid #ead9b4;background:#fff9eb}
.ai-body{min-height:0;overscroll-behavior:contain}.city-select-menu{position:relative;left:0;right:auto;top:auto;width:100%;margin-top:.45rem}.city-scroll{height:min(245px,32vh);max-height:245px;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;scrollbar-gutter:stable}.city-scroll::-webkit-scrollbar{width:6px}.city-scroll::-webkit-scrollbar-track{background:#f7f3eb;border-radius:6px}.city-scroll::-webkit-scrollbar-thumb{background:#cdbb97;border:1px solid #f7f3eb;border-radius:6px}
@media(max-height:720px){.ai-panel{max-height:calc(100vh - 100px)}.city-scroll{height:min(190px,27vh)}}
.ai-panel-resume{width:min(720px,calc(100vw - 24px));max-height:min(790px,calc(100vh - 120px))}.ai-panel-resume .ai-body{padding:1rem 1.1rem 1.2rem}.resume-intro{margin-bottom:1rem}.resume-intro>div{display:flex;flex-direction:column;gap:.12rem}.resume-intro strong{color:var(--ink);font-size:.78rem}.resume-intro span{color:var(--ink-3);font-size:.67rem}.resume-source-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem}.resume-source-title>span{color:var(--ink-2);font-size:.7rem;font-weight:650}.resume-source-title>button{display:flex;align-items:center;gap:.2rem;padding:.2rem .35rem;border:0;color:var(--ink-3);background:transparent;font-size:.62rem;cursor:pointer}.resume-source-title>button:disabled{opacity:.55}.resume-file-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}.resume-file-card{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr) 18px;align-items:center;gap:.55rem;min-width:0;padding:.65rem;border:1px solid var(--border);border-radius:12px;text-align:left;background:#fff;cursor:pointer;transition:border-color var(--t),background var(--t),box-shadow var(--t)}.resume-file-card:hover{border-color:var(--red-border);box-shadow:0 5px 16px rgba(40,22,25,.06)}.resume-file-card.selected{border-color:var(--red);background:var(--red-light);box-shadow:0 0 0 2px rgba(164,31,51,.06)}.resume-file-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;color:var(--red);background:#fbecf0;font-size:1.05rem}.resume-file-copy{display:flex;flex-direction:column;gap:.12rem;min-width:0}.resume-file-copy strong{overflow:hidden;color:var(--ink);font-size:.68rem;text-overflow:ellipsis;white-space:nowrap}.resume-file-copy small{color:var(--ink-4);font-size:.58rem}.resume-selected-mark{color:var(--red);font-size:.9rem}.resume-files-state{display:flex;align-items:center;justify-content:center;gap:.35rem;min-height:64px;padding:.7rem;border:1px dashed var(--border-mid);border-radius:12px;color:var(--ink-3);background:var(--bg-soft);font-size:.66rem}.resume-files-state>i{animation:recommend-spin .8s linear infinite}.resume-files-empty>i{animation:none;font-size:1rem}.resume-divider{display:flex;align-items:center;gap:.55rem;margin:.85rem 0 .55rem;color:var(--ink-4);font-size:.6rem}.resume-divider::before,.resume-divider::after{content:'';height:1px;flex:1;background:var(--border)}.resume-upload{display:grid;grid-template-columns:38px minmax(0,1fr) 18px;align-items:center;gap:.6rem;padding:.67rem .72rem;border:1px dashed var(--border-mid);border-radius:12px;background:#fcfbf9;cursor:pointer;transition:all var(--t)}.resume-upload:hover,.resume-upload.selected{border-color:var(--red-border);background:var(--red-light)}.resume-upload input{display:none}.resume-upload-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;color:#9b6e15;background:var(--gold-light);font-size:1.05rem}.resume-upload>span:nth-child(3){display:flex;flex-direction:column;gap:.12rem;min-width:0}.resume-upload strong{overflow:hidden;color:var(--ink);font-size:.7rem;text-overflow:ellipsis;white-space:nowrap}.resume-upload small{color:var(--ink-3);font-size:.59rem}.resume-upload>i{color:var(--ink-4)}.resume-file-error{display:flex;align-items:center;gap:.3rem;margin-top:.45rem;color:#a4283d;font-size:.64rem}.resume-analyze{display:flex;align-items:center;justify-content:center;gap:.35rem;width:100%;margin-top:.85rem;padding:.64rem;border:0;border-radius:11px;color:#fff;background:linear-gradient(120deg,#9a1c32,#bd334d);font-size:.72rem;font-weight:650;cursor:pointer;box-shadow:0 7px 18px rgba(143,25,47,.18)}.resume-analyze:disabled{opacity:.48;box-shadow:none;cursor:not-allowed}.resume-analyze .ti-loader-2{animation:recommend-spin .8s linear infinite}.resume-advice-error{margin-top:.55rem}.resume-privacy{margin:.52rem 0 0;color:var(--ink-4);font-size:.59rem;text-align:center}.resume-privacy i{margin-right:.2rem}.resume-result-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.8rem;padding:.75rem;border:1px solid #e4dac4;border-radius:13px;background:linear-gradient(135deg,#fffaf0,#fff)}.resume-result-head>div{display:flex;flex-direction:column;gap:.12rem;min-width:0}.resume-result-kicker{display:flex;align-items:center;gap:.25rem;color:#287044;font-size:.6rem;font-weight:650}.resume-result-head strong{overflow:hidden;color:var(--ink);font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}.resume-result-head small{color:var(--ink-3);font-size:.62rem}.resume-result-head>button,.resume-regenerate{display:flex;align-items:center;justify-content:center;gap:.25rem;flex-shrink:0;padding:.38rem .55rem;border:1px solid var(--border-mid);border-radius:8px;color:var(--ink-2);background:#fff;font-size:.62rem;cursor:pointer}.resume-result-head>button:hover,.resume-regenerate:hover{color:var(--red);border-color:var(--red-border);background:var(--red-light)}.resume-regenerate{margin:1rem auto 0}.resume-regenerate:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){.ai-panel-resume{left:12px!important;right:12px!important;bottom:86px;width:auto;max-height:calc(100vh - 105px)}.ai-panel-resume .ai-body{padding:.85rem}.resume-file-grid{grid-template-columns:1fr}.resume-result-head{align-items:flex-start}.resume-result-head>button{padding:.35rem}.resume-result-head>button i{margin:0}.resume-result-head>button{font-size:0}}
</style>
