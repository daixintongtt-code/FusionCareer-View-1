import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANY_PREFERENCE,
  CITY_INTENTION_OPTIONS,
  JOB_INTENTION_OPTIONS,
  collectPreferencePaths,
  normalizePreferenceList,
  parsePreferenceList,
  serializeCityIntentions,
  serializeJobIntentions,
} from '../src/lib/profilePreferences.mjs'

test('parses legacy delimited values and JSON array values', () => {
  assert.deepEqual(parsePreferenceList('学术教职,企业公司-外企-宣传岗'), [
    '学术教职', '企业公司-外企-宣传岗',
  ])
  assert.deepEqual(parsePreferenceList('["上海","山东-济南","江苏"]'), [
    '上海', '山东-济南', '江苏',
  ])
})

test('keeps 都可以 exclusive and removes duplicate values', () => {
  assert.deepEqual(normalizePreferenceList(['上海', '上海', '山东']), ['上海', '山东'])
  assert.deepEqual(normalizePreferenceList(['上海', ANY_PREFERENCE, '江苏']), [ANY_PREFERENCE])
})

test('serializes values with the existing backend field contracts', () => {
  assert.equal(serializeJobIntentions(['学术教职', '党政机关-选调生']), '学术教职,党政机关-选调生')
  assert.equal(serializeCityIntentions(['上海', '山东-威海']), '["上海","山东-威海"]')
})

test('contains selectable paths required by the profile design', () => {
  const readJobPaths = new Set(collectPreferencePaths(JOB_INTENTION_OPTIONS))
  const readCityPaths = new Set(collectPreferencePaths(CITY_INTENTION_OPTIONS))
  assert.equal(readJobPaths.has('学术教职'), true)
  assert.equal(readJobPaths.has('学术教职-升学深造-出国（境）留学'), true)
  assert.equal(readJobPaths.has('学术教职-考取教职-中学教师'), true)
  assert.equal(readJobPaths.has('党政机关-选调生'), true)
  assert.equal(readJobPaths.has('党政机关-高校行政-专职辅导员'), true)
  assert.equal(readJobPaths.has('党政机关-国际组织-宣传岗'), true)
  assert.equal(readJobPaths.has('新闻媒体-党报央媒-传媒业务岗'), true)
  assert.equal(readJobPaths.has('新闻媒体-自媒体'), true)
  assert.equal(readJobPaths.has('企业公司-民企（按行业细分）-互联网科技类'), true)
  assert.equal(readJobPaths.has('企业公司-外企-宣传岗'), true)
  assert.equal(readJobPaths.has('新闻媒体-自媒体-/'), false)
  assert.equal(readCityPaths.has('上海'), true)
  assert.equal(readCityPaths.has('山东'), true)
  assert.equal(readCityPaths.has('山东-济南'), true)
  assert.equal(readCityPaths.has('山东-威海'), true)
})
