import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SALARY_RANGES, normalizeBrowseState, hasBrowseQuery, browseStateToQuery,
  sameBrowseState, browseFilterKey, buildJobListParams, parsePageTarget,
  readJobTags, supportsJobTags, saveBrowseSnapshot, readBrowseSnapshot,
} from '../src/lib/jobBrowse.mjs'

const fullState = {
  keyword: '传媒 & AI/产品', province: '广东', city: '深圳', category: 'ENTERPRISE',
  recruit: 'BIG_INTERNSHIP', duration: 'THREE_TO_SIX_MONTHS',
  days: 'THREE_TO_FOUR_DAYS', salary: '150to199', mode: 'HYBRID',
  tags: ['BIG_COMPANY', 'COLLEGE_REFERRAL'], sort: 'deadline', page: 8,
}

function makeStorage() {
  const values = new Map()
  return {
    values,
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, String(value)) },
  }
}

test('a shareable URL round trip preserves every filter, sort and page', () => {
  const query = browseStateToQuery(fullState)
  const encoded = new URLSearchParams(query).toString()
  const restored = normalizeBrowseState(Object.fromEntries(new URLSearchParams(encoded)))
  assert.deepEqual(restored, fullState)
  assert.equal(query.tags, 'BIG_COMPANY,COLLEGE_REFERRAL')
  assert.equal(query.page, '8')
  assert.equal(hasBrowseQuery({ tracking: 'campaign' }), false)
  assert.equal(hasBrowseQuery({ keyword: '' }), true)
  assert.equal(hasBrowseQuery({ page: '8' }), true)
  assert.equal(sameBrowseState(fullState, restored), true)
  assert.equal(sameBrowseState(fullState, { ...restored, page: 9 }), false)
})

test('invalid query values cannot become backend filters or unsafe page numbers', () => {
  const restored = normalizeBrowseState({
    keyword: '  ' + 'a'.repeat(250) + '  ', province: '__proto__', city: '深圳',
    category: 'ADMIN', recruit: 'FULL_TIME', duration: '3-6', days: '3',
    mode: 'BOTH', salary: '1万/月', tags: ['COLLEGE_REFERRAL', 'UNKNOWN', 'COLLEGE_REFERRAL'],
    sort: 'salary; DROP TABLE job', page: String(Number.MAX_SAFE_INTEGER + 1),
  })
  assert.deepEqual(restored, {
    keyword: 'a'.repeat(200), province: '', city: '', category: '', recruit: '',
    duration: '', days: '', salary: '', mode: '', tags: ['COLLEGE_REFERRAL'],
    sort: 'newest', page: 1,
  })
  for (const page of ['', '-1', '0', '1.5', 'NaN', 'Infinity', null]) {
    assert.equal(normalizeBrowseState({ page }).page, 1)
  }
  assert.equal(normalizeBrowseState({ province: '江苏', city: '深圳' }).city, '')
  assert.equal(normalizeBrowseState({ city: '深圳' }).city, '')
  assert.deepEqual(normalizeBrowseState({ page: ['2', '5'], category: ['MEDIA', 'ENTERPRISE'] }), {
    ...normalizeBrowseState(), page: 2, category: 'MEDIA',
  })
})

test('changing a filter invalidates pagination while page and sort retain the same filter identity', () => {
  assert.equal(browseFilterKey(fullState), browseFilterKey({ ...fullState, page: 1, sort: 'newest' }))
  for (const [key, value] of Object.entries({
    keyword: '研发', province: '浙江', city: '广州', category: 'MEDIA',
    recruit: 'SMALL_INTERNSHIP', duration: 'MORE_THAN_SIX_MONTHS', days: 'FIVE_DAYS',
    salary: '200plus', mode: 'ONLINE', tags: ['BIG_COMPANY'],
  })) {
    assert.notEqual(browseFilterKey(fullState), browseFilterKey({ ...fullState, [key]: value }), key)
  }
})

test('session snapshots restore every filter, page and scroll without sharing accounts', () => {
  const storage = makeStorage()
  const ownerA = 'browse-test:student/a', ownerB = 'browse-test:student/b'
  saveBrowseSnapshot(fullState, 642, ownerA, storage)
  assert.deepEqual(readBrowseSnapshot(ownerA, storage), { state: fullState, scrollY: 642 })
  assert.equal(readBrowseSnapshot(ownerB, storage), null)
  saveBrowseSnapshot({ keyword: '新闻', page: 3 }, 125, ownerB, storage)
  assert.equal(readBrowseSnapshot(ownerA, storage).state.page, 8)
  assert.equal(readBrowseSnapshot(ownerB, storage).state.page, 3)
  assert.equal(storage.values.size, 2)
  const restored = readBrowseSnapshot(ownerA, storage)
  restored.state.tags.length = 0
  assert.deepEqual(readBrowseSnapshot(ownerA, storage).state.tags, fullState.tags)
})

test('long string account IDs remain distinct and invalid numeric or absent owners cannot save', () => {
  const storage = makeStorage()
  saveBrowseSnapshot({ keyword: 'A' }, 0, '9223372036854775806', storage)
  saveBrowseSnapshot({ keyword: 'B' }, 0, '9223372036854775807', storage)
  assert.equal(readBrowseSnapshot('9223372036854775806', storage).state.keyword, 'A')
  assert.equal(readBrowseSnapshot('9223372036854775807', storage).state.keyword, 'B')
  for (const owner of ['', '  ', undefined, null, Number.MAX_SAFE_INTEGER + 1]) {
    saveBrowseSnapshot(fullState, 642, owner, storage)
    assert.equal(readBrowseSnapshot(owner, storage), null)
  }
  assert.equal(storage.values.size, 2)
})

test('unreadable or unwritable session storage retains only the same-tab account snapshot', () => {
  const storage = {
    getItem() { throw new Error('Storage disabled') },
    setItem() { throw new Error('Quota exceeded') },
  }
  assert.doesNotThrow(() => saveBrowseSnapshot(fullState, 401, 'browse-test:blocked-a', storage))
  assert.deepEqual(readBrowseSnapshot('browse-test:blocked-a', storage), { state: fullState, scrollY: 401 })
  assert.equal(readBrowseSnapshot('browse-test:blocked-b', storage), null)
  saveBrowseSnapshot({ page: 2 }, -123, 'browse-test:negative-scroll', storage)
  assert.equal(readBrowseSnapshot('browse-test:negative-scroll', storage).scrollY, 0)
})

test('a browser SecurityError while accessing sessionStorage does not break navigation', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new DOMException('Storage access denied', 'SecurityError') },
  })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
    else delete globalThis.sessionStorage
  })
  assert.doesNotThrow(() => saveBrowseSnapshot(fullState, 707, 'browse-test:security-error'))
  assert.deepEqual(readBrowseSnapshot('browse-test:security-error'), { state: fullState, scrollY: 707 })
})

test('malformed session data is discarded and restored data is normalized', () => {
  const storage = makeStorage()
  const key = 'fusion-career-browse:v1:browse-test%3Acorrupt'
  for (const value of ['{broken', 'null', '{}', '{"scrollY":22}']) {
    storage.values.set(key, value)
    assert.equal(readBrowseSnapshot('browse-test:corrupt', storage), null)
  }
  storage.values.set(key, JSON.stringify({ state: { province: '上海', city: '北京', page: -2, tags: ['UNKNOWN'] }, scrollY: 'Infinity' }))
  assert.deepEqual(readBrowseSnapshot('browse-test:corrupt', storage), {
    state: { ...normalizeBrowseState(), province: '上海' }, scrollY: 0,
  })
})

test('page jumps accept first and last pages and reject blank, fractional or out-of-range input', () => {
  assert.equal(parsePageTarget('1', 40), 1)
  assert.equal(parsePageTarget(' 40 ', 40), 40)
  assert.equal(parsePageTarget(1, 1), 1)
  for (const value of [undefined, null, '', ' ', 0, -1, 1.5, 41, 'NaN', 'Infinity', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(parsePageTarget(value, 40), null, String(value))
  }
  for (const total of [0, -1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(parsePageTarget(1, total), null, String(total))
  }
})

test('all list filters use structured backend fields and real internship enums', () => {
  const params = buildJobListParams(fullState, { size: 10, jobTagsSupported: true })
  assert.deepEqual(Object.fromEntries(params), {
    page: '8', size: '10', sortBy: 'DEADLINE', keyword: '传媒 & AI/产品',
    workProvince: '广东', workCity: '深圳', jobCategory: 'ENTERPRISE', recruitType: 'BIG_INTERNSHIP',
    workPeriodType: 'THREE_TO_SIX_MONTHS', workDurationType: 'THREE_TO_FOUR_DAYS', workMode: 'HYBRID',
    salaryMin: '150', salaryMax: '199', jobTags: 'BIG_COMPANY,COLLEGE_REFERRAL',
  })
  for (const duration of ['LESS_THAN_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'MORE_THAN_SIX_MONTHS']) {
    assert.equal(buildJobListParams({ recruit: 'SMALL_INTERNSHIP', duration }).get('workPeriodType'), duration)
  }
  for (const days of ['ONE_TO_TWO_DAYS', 'THREE_TO_FOUR_DAYS', 'FIVE_DAYS']) {
    assert.equal(buildJobListParams({ recruit: 'BIG_INTERNSHIP', days }).get('workDurationType'), days)
  }
  const campus = buildJobListParams({ ...fullState, recruit: 'CAMPUS_RECRUITMENT', tags: [] })
  assert.equal(campus.has('workPeriodType'), false)
  assert.equal(campus.has('workDurationType'), false)
  assert.equal(campus.has('workMode'), false)
  assert.equal(buildJobListParams({}).get('sortBy'), 'NEWEST')
})

test('daily salary bands are disjoint and send the correct inclusive integer bounds', () => {
  const expected = [
    ['under100', '0', '99'], ['100to149', '100', '149'],
    ['150to199', '150', '199'], ['200plus', '200', null],
  ]
  for (const [salary, min, max] of expected) {
    const params = buildJobListParams({ salary })
    assert.equal(params.get('salaryMin'), min)
    assert.equal(params.get('salaryMax'), max)
  }
  for (const amount of [0, 99, 100, 149, 150, 199, 200, 1000]) {
    const bands = SALARY_RANGES.filter(range => amount >= range.min && (range.max == null || amount <= range.max))
    assert.equal(bands.length, 1, `${amount} yuan/day must belong to exactly one band`)
  }
  for (const salary of ['', '面议', '10000元/月']) {
    const params = buildJobListParams({ salary, salaryDisplay: '10000元/月' })
    assert.equal(params.has('salaryMin'), false)
    assert.equal(params.has('salaryMax'), false)
  }
})

test('job labels come exclusively from explicit jobTags and never from recommendation or source metadata', () => {
  assert.deepEqual(readJobTags({ jobTags: ['COLLEGE_REFERRAL', 'UNKNOWN', 'BIG_COMPANY', 'BIG_COMPANY'] }), ['BIG_COMPANY', 'COLLEGE_REFERRAL'])
  for (const job of [
    null, {}, { recommended: true }, { sourceType: 'COLLEGE_REFERRAL' },
    { recruitType: 'BIG_INTERNSHIP' }, { companyName: '腾讯' },
    { jobTags: 'BIG_COMPANY,COLLEGE_REFERRAL' }, { tags: ['BIG_COMPANY'] },
    { recommended: true, sourceType: 'INTERNAL', recruitType: 'BIG_INTERNSHIP', companyName: '腾讯' },
  ]) {
    assert.deepEqual(readJobTags(job), [], JSON.stringify(job))
  }
})

test('tag queries require explicit true filterCapabilities.jobTags; unknown capability refuses filtering', () => {
  for (const response of [
    undefined, null, {}, { list: [{ jobTags: ['BIG_COMPANY'] }] },
    { jobTags: true }, { filterCapabilities: {} },
    { filterCapabilities: { jobTags: false } }, { filterCapabilities: { jobTags: 'true' } },
    { filterCapabilities: { jobTags: 1 } },
  ]) {
    assert.equal(supportsJobTags(response), false)
    assert.throws(() => buildJobListParams(fullState, { jobTagsSupported: supportsJobTags(response) }), /标签暂不可用/)
    assert.equal(buildJobListParams({ ...fullState, tags: [] }).has('jobTags'), false)
  }
  const response = { filterCapabilities: { jobTags: true } }
  assert.equal(supportsJobTags(response), true)
  assert.equal(buildJobListParams(fullState, { jobTagsSupported: supportsJobTags(response) }).get('jobTags'), 'BIG_COMPANY,COLLEGE_REFERRAL')
})
