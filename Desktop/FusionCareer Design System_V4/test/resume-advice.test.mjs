import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeResumeAdvice,
  normalizeResumeFiles,
  parseInlineMarkdown,
  parseMarkdownBlocks,
  validateResumeAdviceFile,
} from '../src/lib/resumeAdvice.mjs'

test('normalizes resume file records for the picker', () => {
  assert.deepEqual(normalizeResumeFiles({ files:[{
    fileId:15,
    fileName:'摄影简历.pdf',
    size:2048,
  }] }), [{
    fileId:15,
    fileName:'摄影简历.pdf',
    size:2048,
    id:'15',
    name:'摄影简历.pdf',
    fileSize:2048,
    mimeType:'',
  }])
})

test('accepts all supported live-upload resume formats and enforces size', () => {
  assert.equal(validateResumeAdviceFile({ name:'简历.docx', size:1024 }), '')
  assert.equal(validateResumeAdviceFile({ name:'简历.JPEG', size:1024 }), '')
  assert.match(validateResumeAdviceFile({ name:'简历.doc', size:1024 }), /仅支持/)
  assert.match(validateResumeAdviceFile({ name:'简历.pdf', size:21 * 1024 * 1024 }), /20 MB/)
})

test('normalizes supported algorithm response fields', () => {
  assert.deepEqual(normalizeResumeAdvice('# 建议'), { markdown:'# 建议' })
  assert.equal(normalizeResumeAdvice({ report:'## 优先修改', matchConclusion:'mixed' }).markdown, '## 优先修改')
  assert.throws(() => normalizeResumeAdvice({ result:null }), /未返回可展示/)
})

test('parses text and comparison tables without injecting HTML', () => {
  const readMarkdown = [
    '# 简历修改建议',
    '',
    '| 岗位要求 | 判断 | 简历证据 | 建议动作 |',
    '| --- | --- | --- | --- |',
    '| 摄影能力 | **部分匹配** | 有校园拍摄经历 | 补充设备型号 |',
    '',
    '> 量化数据仅在属实时使用。',
    '',
    '- 优先补充作品链接',
    '- 再精简自我评价',
  ].join('\n')
  const readBlocks = parseMarkdownBlocks(readMarkdown)
  assert.equal(readBlocks[0].type, 'heading')
  assert.equal(readBlocks[1].type, 'table')
  assert.equal(readBlocks[1].headers.length, 4)
  assert.equal(readBlocks[1].rows[0][1][0].type, 'strong')
  assert.equal(readBlocks[2].type, 'quote')
  assert.equal(readBlocks[3].type, 'list')
  assert.equal(readBlocks[3].items.length, 2)
})

test('inline parser keeps unknown HTML as text', () => {
  assert.deepEqual(parseInlineMarkdown('<script>alert(1)</script>'), [{
    type:'text',
    text:'<script>alert(1)</script>',
  }])
})
