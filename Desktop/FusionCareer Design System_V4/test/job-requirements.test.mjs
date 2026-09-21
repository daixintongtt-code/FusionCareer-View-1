import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCities, formatEducation, normalizeJobRequirements } from '../src/lib/jobRequirements.mjs'

test('normalizes multi-value job requirements and preserves legacy fields', () => {
  const job = normalizeJobRequirements({
    reqEduLevels: ['ACADEMIC_MASTER', 'PROFESSIONAL_MASTER'],
    workCities: ['上海', '北京'],
  })
  assert.equal(job.reqEduLevel, 'ACADEMIC_MASTER')
  assert.equal(job.workCity, '上海')
  assert.equal(formatEducation(job), '学术硕士研究生、专业硕士研究生')
  assert.equal(formatCities(job), '上海、北京')
})

test('reads existing singular requirements without changing their meaning', () => {
  const job = normalizeJobRequirements({ reqEduLevel: 'DOCTORAL', workCity: '广州' })
  assert.deepEqual(job.reqEduLevels, ['DOCTORAL'])
  assert.deepEqual(job.workCities, ['广州'])
  assert.equal(formatEducation({ reqEduLevel: 'BACHELOR' }), '本科生')
})
