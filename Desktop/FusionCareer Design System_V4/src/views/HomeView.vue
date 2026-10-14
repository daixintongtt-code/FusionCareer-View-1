<template>
  <div class="home-view">
    <UserNavbar />
    <AppToast />
    <main class="page">
      <div class="wrap">
        <section v-if="featured.length" class="card card-p recommendations" aria-label="学院本周推荐岗位">
          <div class="recommendation-heading">
            <h2 class="section-label"><i class="ti ti-star-filled" aria-hidden="true" /> 学院本周推荐岗位</h2>
            <div class="carousel-actions">
              <button class="btn btn-secondary btn-sm btn-icon" aria-label="上一组推荐岗位" @click="slide(-1)"><i class="ti ti-chevron-left" aria-hidden="true" /></button>
              <button class="btn btn-secondary btn-sm btn-icon" aria-label="下一组推荐岗位" @click="slide(1)"><i class="ti ti-chevron-right" aria-hidden="true" /></button>
            </div>
          </div>
          <div ref="carouselRef" class="carousel-wrap">
            <div class="carousel-track" :style="{ transform:`translateX(${offset}px)` }">
              <RouterLink v-for="job in featured" :key="job.id" class="carousel-card" :to="'/job/'+job.id">
                <strong class="featured-company">{{ job.company }}</strong>
                <span class="featured-title">{{ job.title }}</span>
              </RouterLink>
            </div>
          </div>
        </section>

        <div class="search-heading">
          <form class="search-bar" @submit.prevent="loadJobs">
            <i class="ti ti-search" aria-hidden="true" />
            <label class="visually-hidden" for="job-keyword">搜索岗位、公司、行业关键词</label>
            <input id="job-keyword" v-model="filters.keyword" class="search-input" placeholder="搜索岗位、公司、行业关键词…" maxlength="200" />
            <button class="btn btn-primary" type="submit">搜索</button>
          </form>
          <RouterLink class="btn btn-secondary favorites-link" to="/favorites"><i class="ti ti-heart" aria-hidden="true" /> 我的收藏<span v-if="favoriteIds.length">（{{ favoriteIds.length }}）</span></RouterLink>
        </div>

        <section class="filter-panel" aria-label="岗位筛选">
          <div class="frow">
            <div class="fcell fcell-location">
              <span class="flabel">地区</span>
              <div class="location-pair">
                <select v-model="filters.province" class="filter-select" aria-label="省份" @change="changeProvince">
                  <option value="">全部省份</option>
                  <option v-for="province in Object.keys(PROVINCES)" :key="province" :value="province">{{ province }}</option>
                </select>
                <select v-model="filters.city" class="filter-select" aria-label="城市" :disabled="!filters.province" @change="loadJobs">
                  <option value="">{{ filters.province ? '全部城市' : '请先选省份' }}</option>
                  <option v-for="city in PROVINCES[filters.province] || []" :key="city" :value="city">{{ city }}</option>
                </select>
              </div>
            </div>
            <div class="fcell fcell-grow">
              <span class="flabel">岗位类型</span>
              <div class="pill-group">
                <button v-for="type in JOB_CATEGORIES" :key="type.value" :class="['pill', filters.category===type.value && 'active']" :aria-pressed="filters.category===type.value" @click="toggleFilter('category',type.value)">{{ type.label }}</button>
              </div>
            </div>
          </div>
          <div class="frow frow-sep">
            <span class="flabel">招聘类型</span>
            <div class="pill-group">
              <button v-for="type in RECRUIT_TYPES" :key="type.value" :class="['pill', filters.recruit===type.value && 'active']" :aria-pressed="filters.recruit===type.value" @click="toggleFilter('recruit',type.value)">{{ type.label }}</button>
            </div>
          </div>
          <div class="frow frow-sep salary-tag-row">
            <label class="salary-filter"><span class="flabel">日薪</span>
              <select v-model="filters.salary" class="filter-select" @change="loadJobs">
                <option value="">不限日薪</option>
                <option v-for="range in SALARY_RANGES" :key="range.value" :value="range.value">{{ range.label }}</option>
              </select>
            </label>
            <div class="job-tag-filter">
              <span class="flabel">岗位标签</span>
              <div class="pill-group">
                <button v-for="tag in JOB_TAGS" :key="tag.value" :class="['pill', filters.tags.includes(tag.value) && 'active']" :aria-pressed="filters.tags.includes(tag.value)" :disabled="!jobTagsSupported" :aria-describedby="!jobTagsSupported ? 'job-tag-hint' : undefined" @click="toggleTag(tag.value)">{{ tag.label }}</button>
              </div>
            </div>
            <p v-if="tagCapabilities===false" id="job-tag-hint" class="filter-hint">岗位标签暂不可用</p>
          </div>
          <p class="salary-hint">日薪筛选使用已填写的数值日薪，月薪、面议及仅有薪资文字的岗位不参与日薪比较。</p>
          <div v-if="showL2" class="frow frow-sep secondary-filters">
            <label class="fcell"><span class="flabel">实习时长</span>
              <select v-model="filters.duration" class="filter-select" @change="loadJobs"><option value="">不限时长</option><option v-for="duration in DURATIONS" :key="duration.value" :value="duration.value">{{ duration.label }}</option></select>
            </label>
            <div class="fcell"><span class="flabel">每周天数</span><div class="pill-group"><button v-for="days in WEEKLY_DAYS" :key="days.value" :class="['pill', filters.days===days.value && 'active']" :aria-pressed="filters.days===days.value" @click="toggleFilter('days',days.value)">{{ days.label }}</button></div></div>
            <div class="fcell"><span class="flabel">工作形式</span><div class="pill-group"><button v-for="mode in WORK_MODES" :key="mode.value" :class="['pill', filters.mode===mode.value && 'active']" :aria-pressed="filters.mode===mode.value" @click="toggleFilter('mode',mode.value)">{{ mode.label }}</button></div></div>
          </div>
          <div v-if="activeChips.length" class="chips-row">
            <span v-for="chip in activeChips" :key="chip.key" class="chip">{{ chip.label }}<button class="chip-x" :aria-label="'清除'+chip.label" @click="clearFilter(chip.key)">×</button></span>
            <button class="chips-clear" @click="clearAll">清除全部筛选</button>
          </div>
        </section>

        <div ref="listStartRef" class="list-bar">
          <span class="list-count" aria-live="polite">{{ loading ? '正在查找岗位…' : loadError ? '岗位暂时无法加载' : `共 ${total} 个岗位` }}</span>
          <div class="sort-area">
            <div class="sort-toggle" aria-label="岗位排序">
              <button :class="['sort-btn', filters.sort==='newest' && 'active']" :aria-pressed="filters.sort==='newest'" @click="setSort('newest')">最新发布</button>
              <button :class="['sort-btn', filters.sort==='deadline' && 'active']" :aria-pressed="filters.sort==='deadline'" @click="setSort('deadline')">即将截止</button>
            </div>
            <span class="sort-hint">{{ filters.sort==='deadline' ? '截止日期从近到远' : '发布时间从新到旧' }}</span>
          </div>
        </div>
        <div v-if="loading" class="list-message">加载中…</div>
        <div v-else-if="loadError" class="list-message list-error" role="alert"><p>{{ loadError }}</p><button class="btn btn-secondary" @click="retryJobs">重新加载</button></div>
        <div v-else class="job-list">
          <article v-for="job in jobs" :key="job.id" class="job-card">
            <RouterLink class="job-main" :to="'/job/'+job.id">
              <JobCategoryIcon :category="job.category" />
              <div class="job-content">
                <div class="job-title-row"><h2 class="job-title">{{ job.title }}</h2><span v-if="job.recruit" class="badge badge-gray">{{ job.recruit }}</span></div>
                <strong class="job-company">{{ job.company }}</strong>
                <div class="job-meta"><span v-if="job.city">{{ job.city }}</span><span v-if="job.jobtype">{{ job.jobtype }}</span></div>
                <div v-if="job.l2tags.length || job.tags.length" class="job-l2tags">
                  <span v-for="tag in job.tags" :key="tag" :class="['badge', tag==='COLLEGE_REFERRAL' ? 'badge-gold' : 'badge-blue']">{{ labelFor(tag,JOB_TAGS) }}</span>
                  <span v-for="tag in job.l2tags" :key="tag" class="badge badge-gray">{{ tag }}</span>
                </div>
              </div>
            </RouterLink>
            <div class="job-actions">
              <time v-if="job.deadline" class="job-dl" :datetime="job.deadline">截止 {{ job.dl }}</time>
              <button type="button" :class="['job-favorite-btn', favoriteIds.includes(String(job.id)) && 'active']" :aria-pressed="favoriteIds.includes(String(job.id))" :aria-label="(favoriteIds.includes(String(job.id)) ? '取消收藏：' : '收藏岗位：')+job.title" :disabled="!favoritesReady" @click="toggleJobFavorite(job)"><i :class="['ti', favoriteIds.includes(String(job.id)) ? 'ti-heart-filled' : 'ti-heart']" aria-hidden="true" /><span>{{ favoriteIds.includes(String(job.id)) ? '已收藏' : '收藏' }}</span></button>
            </div>
          </article>
          <div v-if="!jobs.length" class="list-message">暂无符合条件的岗位<button v-if="activeChips.length || filters.keyword" class="btn btn-secondary" @click="clearAll">清除条件重新查找</button></div>
        </div>
        <nav v-if="!loading && !loadError && totalPages>1" class="pagination" aria-label="岗位列表分页">
          <button class="page-btn page-nav" :disabled="filters.page===1" @click="goPage(filters.page-1)">上一页</button>
          <template v-for="(item,index) in paginationItems" :key="`${item}-${index}`"><span v-if="item==='ellipsis'" class="page-ellipsis" aria-hidden="true">…</span><button v-else :class="['page-btn',item===filters.page && 'active']" :aria-current="item===filters.page ? 'page' : undefined" :aria-label="`第 ${item} 页`" @click="goPage(item)">{{ item }}</button></template>
          <button class="page-btn page-nav" :disabled="filters.page===totalPages" @click="goPage(filters.page+1)">下一页</button>
          <PageJump :current="filters.page" :total="totalPages" :disabled="loading" @change="goPage" />
        </nav>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import UserNavbar from '@/components/UserNavbar.vue'
import AppToast from '@/components/AppToast.vue'
import JobCategoryIcon from '@/components/JobCategoryIcon.vue'
import PageJump from '@/components/PageJump.vue'
import { useToast } from '@/composables/useToast'
import { readJson, readToken } from '@/lib/api'
import { readUser } from '@/lib/auth'
import { formatCities } from '@/lib/jobRequirements.mjs'
import { readFavorites, setFavoritesUser, subscribeFavorites, toggleFavorite } from '@/lib/favorites'
import { JOB_CATEGORIES, RECRUIT_TYPES, DURATIONS, WEEKLY_DAYS, WORK_MODES, SALARY_RANGES, JOB_TAGS, PROVINCES, normalizeBrowseState, browseFilterKey, hasBrowseQuery, browseStateToQuery, sameBrowseState, buildJobListParams, readBrowseSnapshot, saveBrowseSnapshot, readJobTags, supportsJobTags, parsePageTarget } from '@/lib/jobBrowse.mjs'

const router = useRouter(), route = useRoute(), toast = useToast()
const filters = reactive(normalizeBrowseState())
const jobs = ref([]), total = ref(0), featured = ref([]), favoriteIds = ref([])
const loading = ref(true), loadError = ref(''), ready = ref(false), favoritesReady = ref(false)
const tagCapabilities = ref(null)
const jobTagsSupported = computed(() => tagCapabilities.value===true)
const showL2 = computed(() => ['BIG_INTERNSHIP','SMALL_INTERNSHIP'].includes(filters.recruit))
const offset = ref(0), carouselRef = ref(null), listStartRef = ref(null)
const CARD_W = 208, pageSize = 10
let owner = '', identityToken = '', previousFilterKey = '', jobsRequestId = 0, identityRequestId = 0, disposed = false, unsubscribeFavorites = null, restoreScroll = null, scrollToList = false
const labelFor = (value, options) => options.find(item => item.value===value)?.label || ''

const totalPages = computed(() => Math.max(1, Math.ceil(total.value/pageSize)))
const paginationItems = computed(() => {
  const last = totalPages.value, page = filters.page
  if (last<=7) return Array.from({length:last},(_,index)=>index+1)
  if (page<=4) return [1,2,3,4,5,'ellipsis',last]
  if (page>=last-3) return [1,'ellipsis',last-4,last-3,last-2,last-1,last]
  return [1,'ellipsis',page-1,page,page+1,'ellipsis',last]
})
const activeChips = computed(() => [
  {key:'province',label:filters.province}, {key:'city',label:filters.city},
  {key:'category',label:labelFor(filters.category,JOB_CATEGORIES)}, {key:'recruit',label:labelFor(filters.recruit,RECRUIT_TYPES)},
  {key:'duration',label:labelFor(filters.duration,DURATIONS)}, {key:'days',label:labelFor(filters.days,WEEKLY_DAYS)},
  {key:'salary',label:labelFor(filters.salary,SALARY_RANGES)}, {key:'mode',label:labelFor(filters.mode,WORK_MODES)},
  ...filters.tags.map(tag=>({key:`tag:${tag}`,label:labelFor(tag,JOB_TAGS)})),
].filter(chip=>chip.label))

function syncFavorites(items=readFavorites()) { favoriteIds.value=items.map(item=>String(item.id)) }
function toggleJobFavorite(job) {
  try {
    const saved=toggleFavorite({id:job.id,jobCategory:job.category,positionName:job.title,companyName:job.company,workCity:job.city,salaryDisplay:job.salary,applicationDeadline:job.deadline})
    toast.success(saved ? '已加入收藏夹' : '已取消收藏')
  } catch (error) { toast.error(error.message || '收藏失败，请重试') }
}
function slide(direction) {
  const visible=Math.max(1,Math.floor((carouselRef.value?.clientWidth || CARD_W)/CARD_W))
  const min=-Math.max(featured.value.length-visible,0)*CARD_W
  offset.value=Math.max(Math.min(offset.value-direction*CARD_W,0),min)
}
function changeProvince() { filters.city=''; loadJobs() }
function toggleFilter(key,value) {
  filters[key]=filters[key]===value ? '' : value
  if (key==='recruit' && !showL2.value) { filters.duration=''; filters.days=''; filters.mode='' }
  loadJobs()
}
function toggleTag(tag) {
  if (!jobTagsSupported.value) return
  filters.tags=filters.tags.includes(tag) ? filters.tags.filter(item=>item!==tag) : [...filters.tags,tag]
  loadJobs()
}
function clearFilter(key) {
  if (key.startsWith('tag:')) filters.tags=filters.tags.filter(tag=>tag!==key.slice(4))
  else filters[key]=''
  if (key==='province') filters.city=''
  if (key==='recruit') { filters.duration=''; filters.days=''; filters.mode='' }
  loadJobs()
}
function clearAll() { Object.assign(filters,normalizeBrowseState({sort:filters.sort})); loadJobs() }
function setSort(sort) { if (sort===filters.sort) return; filters.sort=sort; filters.page=1; restoreScroll=null; loadJobs() }
function goPage(value) {
  const page=parsePageTarget(value,totalPages.value)
  if (page==null || page===filters.page) return
  filters.page=page; restoreScroll=null; scrollToList=true; loadJobs()
}
function persistState(scrollY=window.scrollY) {
  if (disposed || route.path!=='/home' || readToken()!==identityToken) return
  saveBrowseSnapshot(filters,scrollY,owner)
  if (route.path==='/home') router.replace({path:'/home',query:browseStateToQuery(filters)}).catch(()=>{})
}
function restoreState() {
  const snapshot=readBrowseSnapshot(owner)
  const state=hasBrowseQuery(route.query) ? normalizeBrowseState(route.query) : snapshot?.state || normalizeBrowseState()
  Object.assign(filters,state)
  previousFilterKey=browseFilterKey(filters)
  restoreScroll=snapshot && sameBrowseState(state,snapshot.state) ? snapshot.scrollY : null
}
function mapJob(job) {
  const recruit=job.recruitType==='CAMPUS_SCREENING' ? '应届招聘' : labelFor(job.recruitType,RECRUIT_TYPES)
  const mode=job.workMode==='BOTH' ? '线上线下均可' : labelFor(job.workMode,WORK_MODES)
  const deadline=typeof job.applicationDeadline==='string' ? job.applicationDeadline.slice(0,10) : ''
  return { id:job.id, category:job.jobCategory || 'OTHER', title:job.positionName, company:job.companyName,
    city:formatCities(job), jobtype:labelFor(job.jobCategory,JOB_CATEGORIES), recruit, salary:job.salaryDisplay,
    tags:readJobTags(job), l2tags:[labelFor(job.workPeriodType,DURATIONS),labelFor(job.workDurationType,WEEKLY_DAYS),job.salaryDisplay,mode].filter(Boolean),
    deadline, dl:deadline.slice(5),
  }
}
async function loadJobs() {
  if (!ready.value || disposed || route.path!=='/home') return
  if (readToken()!==identityToken) {
    ready.value=false; favoritesReady.value=false; syncFavorites([])
    loadError.value='登录身份已变化，请重新加载'; loading.value=false
    return
  }
  Object.assign(filters,normalizeBrowseState(filters))
  const filterKey=browseFilterKey(filters)
  if (filterKey!==previousFilterKey) { filters.page=1; previousFilterKey=filterKey; restoreScroll=null }
  const requestId=++jobsRequestId
  loading.value=true; loadError.value=''
  persistState(restoreScroll ?? 0)
  try {
    // Discover explicit tag capability first when opening a saved tagged URL.
    // Never show an unfiltered page as if the server had applied the tags.
    const discoverTags=filters.tags.length>0 && tagCapabilities.value===null
    const params=buildJobListParams(discoverTags ? {...filters,tags:[]} : filters,{size:pageSize,jobTagsSupported:jobTagsSupported.value})
    const result=await readJson(`/job/list?${params}`)
    if (requestId!==jobsRequestId || disposed) return
    if (readToken()!==identityToken) throw new Error('登录身份已变化，请重新加载')
    if (!Array.isArray(result?.list) || !Number.isSafeInteger(Number(result.total)) || Number(result.total)<0) throw new Error('岗位数据格式异常，请稍后重试')
    tagCapabilities.value=supportsJobTags(result)
    if (filters.tags.length) {
      if (!jobTagsSupported.value) throw new Error('选中的岗位标签暂不可用，请清除标签后重试')
      if (discoverTags) { await loadJobs(); return }
    }
    total.value=Number(result.total)
    if (filters.page>totalPages.value) { filters.page=totalPages.value; await loadJobs(); return }
    jobs.value=result.list.map(mapJob)
    await nextTick()
    if (requestId!==jobsRequestId || disposed) return
    if (readToken()!==identityToken) throw new Error('登录身份已变化，请重新加载')
    if (restoreScroll!=null) { window.scrollTo({top:restoreScroll}); restoreScroll=null }
    else if (scrollToList) { listStartRef.value?.scrollIntoView({block:'start'}); scrollToList=false }
  } catch (error) {
    if (requestId!==jobsRequestId || disposed) return
    if (readToken()!==identityToken) {
      ready.value=false; favoritesReady.value=false; syncFavorites([])
      loadError.value='登录身份已变化，请重新加载'
    } else loadError.value=error.message || '加载岗位失败，请重试'
    jobs.value=[]
  } finally { if (!disposed && requestId===jobsRequestId) loading.value=false }
}
async function loadRecommendations() {
  if (disposed) return
  const token=readToken()
  try {
    const result=await readJson('/job/list?page=1&size=6&recommended=true&sortBy=NEWEST')
    if (disposed || readToken()!==token) return
    featured.value=(Array.isArray(result?.list) ? result.list : []).map(job=>({id:job.id,company:job.companyName,title:job.positionName}))
    offset.value=0
  } catch { if (!disposed && readToken()===token) featured.value=[] }
}
async function initialize() {
  if (disposed) return
  const identityId=++identityRequestId, token=readToken()
  ++jobsRequestId; ready.value=false
  loading.value=true; loadError.value=''; setFavoritesUser(null); favoritesReady.value=false
  try {
    const user=await readUser(true)
    if (disposed || identityId!==identityRequestId) return
    if (readToken()!==token) throw new Error('登录身份已变化，请重新加载')
    if (!user) throw new Error('请登录后查看岗位')
    owner=typeof user.id==='string' || Number.isSafeInteger(user.id) ? user.id : user.studentId || ''
    identityToken=token
    setFavoritesUser(user); syncFavorites(); favoritesReady.value=true
    restoreState(); ready.value=true
    await loadJobs()
    if (!disposed && identityId===identityRequestId) loadRecommendations()
  } catch (error) {
    if (disposed || identityId!==identityRequestId) return
    loadError.value=error.message || '加载账户失败，请重试'; loading.value=false
  }
}
function retryJobs() { ready.value ? loadJobs() : initialize() }
watch(()=>route.query, query=> {
  if (!ready.value || route.path!=='/home') return
  const state=normalizeBrowseState(query)
  if (sameBrowseState(state,filters)) return
  Object.assign(filters,state); previousFilterKey=browseFilterKey(filters); restoreScroll=null; loadJobs()
})
onBeforeRouteLeave(()=> { if (ready.value && readToken()===identityToken) saveBrowseSnapshot(filters,window.scrollY,owner) })
onMounted(()=> { unsubscribeFavorites=subscribeFavorites(syncFavorites); initialize(); window.addEventListener('focus',loadRecommendations) })
onUnmounted(()=> { disposed=true; ++identityRequestId; ++jobsRequestId; window.removeEventListener('focus',loadRecommendations); unsubscribeFavorites?.() })
</script>

<style scoped>
.home-view .page { padding-bottom:7.5rem; }
.recommendations { margin-bottom:1rem; }
.recommendation-heading,.carousel-actions,.search-heading,.list-bar,.job-title-row,.job-actions { display:flex; align-items:center; gap:.6rem; }
.recommendation-heading { justify-content:space-between; margin-bottom:.75rem; }
.section-label { font-size:17px; font-weight:600; color:var(--ink); }
.carousel-card { display:flex; flex-direction:column; width:208px; flex:0 0 208px; white-space:normal; }
.featured-company { font-size:16px; color:var(--ink); overflow-wrap:anywhere; }
.featured-title { font-size:16px; color:var(--ink-2); margin-top:.35rem; }
.search-heading { align-items:stretch; flex-wrap:wrap; margin-bottom:1rem; }
.search-bar { flex:1 1 320px; min-width:0; gap:.6rem; }
.search-input { min-width:0; font-size:17px; }
.favorites-link { font-size:16px; }
.filter-panel { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-xl); margin-bottom:1rem; }
.frow { display:flex; align-items:center; flex-wrap:wrap; gap:1rem; padding:1rem 1.25rem; }
.frow-sep { border-top:1px solid var(--border); }
.fcell { display:flex; flex-direction:column; gap:.5rem; min-width:0; }
.fcell-grow { flex:1 1 280px; }
.flabel { font-size:15px; font-weight:600; color:var(--ink-2); white-space:nowrap; }
.location-pair,.pill-group,.salary-filter,.job-tag-filter { display:flex; align-items:center; flex-wrap:wrap; gap:.5rem; }
.salary-filter,.job-tag-filter { gap:.7rem; }
.filter-select { min-height:40px; max-width:100%; padding:.35rem .6rem; border:1px solid var(--border-mid); border-radius:var(--r-md); color:var(--ink); background:var(--bg-card); font-size:16px; }
.pill { padding:.4rem .75rem; min-height:40px; border:1px solid var(--border-mid); border-radius:var(--r-full); font-size:16px; background:var(--bg-card); color:var(--ink-2); }
.pill:hover:not(:disabled) { background:var(--red-light); border-color:var(--red-border); color:var(--red); }
.pill.active { background:var(--red); border-color:var(--red); color:#fff; }
.pill:disabled { color:var(--ink-3); cursor:not-allowed; background:var(--bg-soft); }
.filter-hint,.salary-hint { color:var(--ink-2); font-size:14px; }
.salary-hint { padding:0 1.25rem .85rem; line-height:1.6; }
.secondary-filters { background:var(--bg-soft); }
.chips-row { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; padding:.8rem 1.25rem; border-top:1px solid var(--border); }
.chip { display:inline-flex; align-items:center; gap:.3rem; padding:.25rem .6rem; border:1px solid var(--red-border); border-radius:var(--r-full); color:var(--red); background:var(--red-light); font-size:15px; }
.chip-x { border:0; background:none; color:inherit; font-size:20px; padding:0 .2rem; }
.chips-clear { border:0; background:none; color:var(--ink-2); text-decoration:underline; font-size:15px; padding:.35rem; }
.list-bar { justify-content:space-between; flex-wrap:wrap; margin:1rem 0 .75rem; scroll-margin-top:calc(var(--nav-h) + 1rem); }
.list-count { font-size:17px; color:var(--ink-2); }
.sort-area { display:flex; flex-direction:column; align-items:flex-end; gap:.25rem; }
.sort-toggle { display:flex; gap:.25rem; padding:.2rem; border:1px solid var(--border); border-radius:var(--r-full); background:var(--bg-soft); }
.sort-btn { border:0; border-radius:var(--r-full); padding:.45rem .8rem; font-size:16px; color:var(--ink-2); background:none; }
.sort-btn.active { color:var(--red); background:var(--bg-card); font-weight:600; }
.sort-hint { font-size:14px; color:var(--ink-2); }
.job-list { display:flex; flex-direction:column; gap:.65rem; }
.job-card { display:flex; align-items:center; flex-wrap:wrap; gap:.75rem; padding:1rem 1.1rem; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-lg); }
.job-card:hover { border-color:var(--border-mid); }
.job-main { display:flex; align-items:flex-start; gap:.9rem; min-width:0; flex:1 1 400px; }
.job-content { min-width:0; flex:1; }
.job-title-row { flex-wrap:wrap; margin-bottom:.3rem; }
.job-title { font-size:18px; line-height:1.5; font-weight:600; overflow-wrap:anywhere; }
.job-company { display:block; font-size:18px; font-weight:700; color:var(--ink); line-height:1.5; margin-bottom:.25rem; overflow-wrap:anywhere; }
.job-meta,.job-l2tags { display:flex; flex-wrap:wrap; gap:.5rem .75rem; }
.job-meta { font-size:16px; color:var(--ink-2); }
.job-l2tags { margin-top:.45rem; }
.job-l2tags .badge,.job-title-row .badge { font-size:14px; white-space:normal; }
.job-actions { flex-shrink:0; margin-left:auto; justify-content:flex-end; flex-wrap:wrap; }
.job-dl { font-size:15px; color:var(--ink-2); white-space:nowrap; }
.job-favorite-btn { display:flex; align-items:center; gap:.35rem; min-height:40px; padding:.45rem .65rem; border:1px solid var(--border-mid); border-radius:var(--r-full); background:var(--bg-card); color:var(--ink-2); font-size:15px; }
.job-favorite-btn.active,.job-favorite-btn:hover:not(:disabled) { color:var(--red); border-color:var(--red-border); background:var(--red-light); }
.job-favorite-btn:disabled { opacity:.5; cursor:not-allowed; }
.list-message { display:flex; flex-direction:column; align-items:center; gap:1rem; text-align:center; padding:2.5rem 1rem; color:var(--ink-2); font-size:17px; }
.list-error { color:var(--red); }
.pagination { flex-wrap:wrap; gap:.5rem; margin-top:.7rem; }
.page-btn { min-width:40px; height:40px; font-size:16px; }
.page-nav { width:auto; padding:0 .7rem; }
.page-ellipsis { padding:0 .35rem; font-size:17px; color:var(--ink-2); }
.visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid var(--red); outline-offset:3px; }
@media (max-width:640px) {
  .home-view .wrap { padding:0 1rem; }
  .frow { padding:.85rem 1rem; }
  .fcell-location,.location-pair { width:100%; }
  .location-pair .filter-select { flex:1; min-width:0; }
  .job-card { padding:.9rem; }
  .job-main { flex-basis:100%; }
  .job-actions { width:100%; justify-content:space-between; }
  .sort-area { align-items:flex-start; }
  .pagination { justify-content:flex-start; }
}
</style>
