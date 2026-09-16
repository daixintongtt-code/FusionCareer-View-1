import assert from 'node:assert/strict'
import test from 'node:test'
import {
  JOB_IMPORT_MAX_BYTES,
  normalizeJobImportResult,
  validateJobImportFile,
} from '../src/lib/jobImport.mjs'

test('accepts Excel workbooks within the size limit', () => {
  assert.equal(validateJobImportFile({ name: '岗位模板.XLSX', size: 1024 }), '')
  assert.equal(validateJobImportFile({ name: '岗位模板.xls', size: JOB_IMPORT_MAX_BYTES }), '')
})

test('rejects unsupported or oversized files', () => {
  assert.match(validateJobImportFile({ name: '岗位模板.csv', size: 1024 }), /仅支持/)
  assert.match(validateJobImportFile({ name: '岗位模板.xlsx', size: JOB_IMPORT_MAX_BYTES + 1 }), /10 MB/)
})

test('normalizes import counts and row errors', () => {
  assert.deepEqual(normalizeJobImportResult({
    importedCount: 3,
    failureCount: 1,
    failedRows: [{ rowNumber: 5, reason: '缺少岗位名称' }],
  }), {
    successCount: 3,
    failedCount: 1,
    errors: ['第 5 行：缺少岗位名称'],
    warnings: [],
  })
})

test('normalizes review warnings from legacy workbooks', () => {
  assert.deepEqual(normalizeJobImportResult({
    successCount: 2,
    warnings: [{ row: 3, message: '需求人数为“若干”，headcount 已留空' }],
  }), {
    successCount: 2,
    failedCount: 0,
    errors: [],
    warnings: ['第 3 行：需求人数为“若干”，headcount 已留空'],
  })
})

test('supports a numeric success response', () => {
  assert.deepEqual(normalizeJobImportResult(4), {
    successCount: 4,
    failedCount: 0,
    errors: [],
    warnings: [],
  })
})
