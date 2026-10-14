export const JOB_CATEGORIES = [
  { value: 'MEDIA', label: '新闻媒体' }, { value: 'ENTERPRISE', label: '企业公司' },
  { value: 'GOVERNMENT', label: '党政机关' }, { value: 'ACADEMIC', label: '学术教职' }, { value: 'OTHER', label: '其他' },
]
export const RECRUIT_TYPES = [
  { value: 'BIG_INTERNSHIP', label: '大实习' }, { value: 'SMALL_INTERNSHIP', label: '小实习' },
  { value: 'DAILY_INTERNSHIP', label: '日常实习' }, { value: 'CAMPUS_RECRUITMENT', label: '应届招聘' },
]
export const DURATIONS = [
  { value: 'LESS_THAN_THREE_MONTHS', label: '3个月以内' },
  { value: 'THREE_TO_SIX_MONTHS', label: '3–6个月' }, { value: 'MORE_THAN_SIX_MONTHS', label: '6个月以上' },
]
export const WEEKLY_DAYS = [
  { value: 'ONE_TO_TWO_DAYS', label: '1–2天' }, { value: 'THREE_TO_FOUR_DAYS', label: '3–4天' }, { value: 'FIVE_DAYS', label: '5天' },
]
export const WORK_MODES = [
  { value: 'HYBRID', label: '线上线下均可' }, { value: 'OFFLINE', label: '线下' }, { value: 'ONLINE', label: '线上' },
]
// Numeric salary filters follow the existing admin form's yuan/day convention.
// Never turn salaryDisplay's monthly salary or 面议 into a daily numeric value.
export const SALARY_RANGES = [
  { value: 'under100', label: '0–99元/天', min: 0, max: 99 },
  { value: '100to149', label: '100–149元/天', min: 100, max: 149 },
  { value: '150to199', label: '150–199元/天', min: 150, max: 199 },
  { value: '200plus', label: '200元/天及以上', min: 200 },
]
// Explicit proposed backend contract; never infer these from recommended,
// sourceType, companyName or BIG_INTERNSHIP. See docs/student-job-contract.md.
export const JOB_TAGS = [
  { value: 'BIG_COMPANY', label: '大厂' }, { value: 'COLLEGE_REFERRAL', label: '学院内推' },
]
export const PROVINCES = {
  北京: ['北京'], 上海: ['上海'], 天津: ['天津'], 重庆: ['重庆'],
  广东: ['广州','深圳','珠海','东莞','佛山','惠州','中山','汕头'],
  浙江: ['杭州','宁波','温州','绍兴','金华','嘉兴'], 江苏: ['南京','苏州','无锡','常州','南通','扬州','徐州'],
  山东: ['济南','青岛','烟台','潍坊','临沂'], 四川: ['成都','绵阳','德阳','宜宾'], 湖北: ['武汉','宜昌','襄阳'],
  湖南: ['长沙','株洲','岳阳'], 河南: ['郑州','洛阳','开封'], 河北: ['石家庄','保定','唐山','廊坊'],
  陕西: ['西安','咸阳','宝鸡'], 辽宁: ['沈阳','大连','鞍山'], 吉林: ['长春','吉林市'],
  黑龙江: ['哈尔滨','齐齐哈尔','大庆'], 安徽: ['合肥','芜湖','马鞍山'], 福建: ['福州','厦门','泉州','莆田'],
  江西: ['南昌','赣州','九江'], 山西: ['太原','大同','运城'], 云南: ['昆明','大理','丽江'], 贵州: ['贵阳','遵义'],
  广西: ['南宁','桂林','柳州'], 海南: ['海口','三亚'], 甘肃: ['兰州','天水'], 内蒙古: ['呼和浩特','包头','鄂尔多斯'],
  新疆: ['乌鲁木齐','喀什'], 西藏: ['拉萨'], 宁夏: ['银川'], 青海: ['西宁'],
  香港: ['香港'], 澳门: ['澳门'], 台湾: ['台北','高雄','台中','台南'], 海外: ['东京','纽约','伦敦','新加坡','首尔','巴黎','悉尼'],
}
const FILTER_KEYS = ['keyword','province','city','category','recruit','duration','days','salary','mode','tags']
const QUERY_KEYS = [...FILTER_KEYS, 'sort', 'page']
const memorySnapshots = new Map()
const first = value => String((Array.isArray(value) ? value[0] : value) ?? '').trim()
const option = (value, choices) => choices.some(item => item.value === first(value)) ? first(value) : ''

export function readJobTags(job) {
  const tags = Array.isArray(job?.jobTags) ? job.jobTags : []
  return JOB_TAGS.filter(item => tags.includes(item.value)).map(item => item.value)
}
export function supportsJobTags(page) { return page?.filterCapabilities?.jobTags === true }
export function parsePageTarget(value, total) {
  if (value == null || String(value).trim() === '') return null
  const page = Number(value), limit = Number(total)
  return Number.isSafeInteger(page) && page >= 1 && Number.isSafeInteger(limit) && page <= limit ? page : null
}
export function normalizeBrowseState(input = {}) {
  const province = Object.hasOwn(PROVINCES, first(input.province)) ? first(input.province) : ''
  const city = (PROVINCES[province] || []).includes(first(input.city)) ? first(input.city) : ''
  const rawTags = Array.isArray(input.tags) ? input.tags.flatMap(value => String(value).split(',')) : first(input.tags).split(',')
  const page = Number(first(input.page))
  const recruit = option(input.recruit, RECRUIT_TYPES)
  const isInternship = ['BIG_INTERNSHIP','SMALL_INTERNSHIP'].includes(recruit)
  return {
    keyword: first(input.keyword).slice(0, 200), province, city,
    category: option(input.category, JOB_CATEGORIES), recruit,
    duration: isInternship ? option(input.duration, DURATIONS) : '', days: isInternship ? option(input.days, WEEKLY_DAYS) : '',
    salary: option(input.salary, SALARY_RANGES), mode: isInternship ? option(input.mode, WORK_MODES) : '',
    tags: JOB_TAGS.filter(item => rawTags.includes(item.value)).map(item => item.value),
    sort: first(input.sort) === 'deadline' ? 'deadline' : 'newest', page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}
export function hasBrowseQuery(query = {}) { return QUERY_KEYS.some(key => Object.hasOwn(query, key)) }
export function browseStateToQuery(input) {
  const state = normalizeBrowseState(input)
  const query = { sort: state.sort, page: String(state.page) }
  for (const key of FILTER_KEYS) {
    const value = key === 'tags' ? state.tags.join(',') : state[key]
    if (value) query[key] = value
  }
  return query
}
export function browseFilterKey(input) {
  const state = normalizeBrowseState(input)
  return JSON.stringify(FILTER_KEYS.map(key => state[key]))
}
export function sameBrowseState(a, b) { return JSON.stringify(browseStateToQuery(a)) === JSON.stringify(browseStateToQuery(b)) }
export function buildJobListParams(input, { size = 10, jobTagsSupported = false } = {}) {
  const state = normalizeBrowseState(input)
  if (state.tags.length && jobTagsSupported !== true) throw new Error('选中的岗位标签暂不可用，请清除标签后重试')
  const params = new URLSearchParams({ page: String(state.page), size: String(size), sortBy: state.sort === 'deadline' ? 'DEADLINE' : 'NEWEST' })
  const fields = { keyword:'keyword', province:'workProvince', city:'workCity', category:'jobCategory', recruit:'recruitType', duration:'workPeriodType', days:'workDurationType', mode:'workMode' }
  for (const [key, field] of Object.entries(fields)) if (state[key]) params.set(field, state[key])
  const salary = SALARY_RANGES.find(item => item.value === state.salary)
  if (salary?.min != null) params.set('salaryMin', String(salary.min))
  if (salary?.max != null) params.set('salaryMax', String(salary.max))
  if (state.tags.length) params.set('jobTags', state.tags.join(','))
  return params
}
function snapshotKey(userId) {
  if (typeof userId === 'number' && !Number.isSafeInteger(userId)) return ''
  const id = first(userId)
  return id ? `fusion-career-browse:v1:${encodeURIComponent(id)}` : ''
}
function readSessionStorage(storage) {
  try { return storage === undefined ? globalThis.sessionStorage : storage } catch { return null }
}
export function saveBrowseSnapshot(state, scrollY, userId, storage) {
  const key = snapshotKey(userId)
  if (!key) return
  const position = Number(scrollY)
  const snapshot = { state: normalizeBrowseState(state), scrollY: Number.isFinite(position) ? Math.max(0, position) : 0 }
  memorySnapshots.set(key, snapshot)
  try { readSessionStorage(storage)?.setItem(key, JSON.stringify(snapshot)) } catch { /* URL and same-tab memory still restore navigation. */ }
}
export function readBrowseSnapshot(userId, storage) {
  const key = snapshotKey(userId)
  if (!key) return null
  let snapshot
  try { snapshot = JSON.parse(readSessionStorage(storage)?.getItem(key) || 'null') } catch { /* Fall back to this tab's state. */ }
  snapshot ||= memorySnapshots.get(key)
  if (!snapshot?.state) return null
  const scrollY = Number(snapshot.scrollY)
  return { state: normalizeBrowseState(snapshot.state), scrollY: Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0 }
}
