import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSubmitBody } from '../src/lib/questionnairePayload.mjs'

test('keeps 64-bit job, question, and file IDs exact in a submission', () => {
  const jobId = '9007199254740993'
  const questionId = '9007199254740995'
  const fileId = '9007199254740997'
  const body = buildSubmitBody(jobId,
    [{ id: questionId, type: 'FILE_UPLOAD' }], {},
    { [questionId]: { id: fileId, name: 'resume.pdf' } })

  assert.equal(body.jobPostId, jobId)
  assert.deepEqual(JSON.parse(body.answers), [{ questionId, value: fileId }])
})
