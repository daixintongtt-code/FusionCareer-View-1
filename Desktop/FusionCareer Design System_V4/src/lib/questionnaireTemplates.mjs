export const TEMPLATE_ENDPOINT = '/admin/questionnaire/templates'

export const QUESTION_TYPE_LABELS = Object.freeze({
  TEXT: '单行文本',
  TEXTAREA: '多行文本',
  RADIO: '单选',
  CHECKBOX: '多选',
  FILE_UPLOAD: '文件上传',
})

function templateName(value) {
  if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > 80) {
    throw new Error('模板名称须为 1 至 80 个字符')
  }
  return value.trim()
}

function templateId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  throw new Error('模板标识无效，请重新加载')
}

// Templates contain definitions only. IDs, answers and file references never cross jobs.
export function cloneTemplateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('请先添加至少一道题目')
  }
  return Array.from(questions, (question, index) => {
    const prefix = `第 ${index + 1} 道题`
    if (!question || typeof question.title !== 'string' || !question.title.trim()) {
      throw new Error(`${prefix}的标题不能为空`)
    }
    if (typeof question.questionType !== 'string' || !Object.hasOwn(QUESTION_TYPE_LABELS, question.questionType)) {
      throw new Error(`${prefix}的题型无效`)
    }
    const isChoice = question.questionType === 'RADIO' || question.questionType === 'CHECKBOX'
    const options = isChoice && Array.isArray(question.options) ? Array.from(question.options) : []
    if (isChoice && (!Array.isArray(question.options) || options.length === 0
      || options.some(option => typeof option !== 'string' || !option.trim()))) {
      throw new Error(`${prefix}需要填写完整的选项`)
    }
    if (question.required != null && typeof question.required !== 'boolean') {
      throw new Error(`${prefix}的必填设置无效`)
    }
    if (question.placeholder != null && typeof question.placeholder !== 'string') {
      throw new Error(`${prefix}的输入提示无效`)
    }
    return {
      sortOrder: index + 1,
      title: question.title,
      questionType: question.questionType,
      options,
      required: question.required ?? false,
      placeholder: question.placeholder ?? '',
    }
  })
}

export function buildTemplatePayload(name, questions) {
  return { name: templateName(name), questions: cloneTemplateQuestions(questions) }
}

export function normalizeTemplateList(data) {
  if (!Array.isArray(data)) throw new Error('模板列表格式无效，请稍后重试')
  return data.map(row => {
    if (!row || !Number.isSafeInteger(row.questionCount) || row.questionCount < 1) {
      throw new Error('模板列表内容不完整，请稍后重试')
    }
    return {
      id: templateId(row.id),
      name: templateName(row.name),
      questionCount: row.questionCount,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    }
  })
}

export function normalizeTemplateDetail(data) {
  if (!data || typeof data !== 'object') throw new Error('模板内容不完整，请稍后重试')
  return { id: templateId(data.id), ...buildTemplatePayload(data.name, data.questions) }
}

export function canApplyTemplateToJob(editingId, job = {}) {
  if (editingId == null || editingId === '') return true
  return job?.status === 'OFFLINE'
    && (job.applicationCount === 0 || job.applicationCount === '0')
}

// readJson supplies the shared authentication, envelope handling and 401 behavior.
export function createTemplateApi(readJson) {
  return {
    async list() {
      return normalizeTemplateList(await readJson(TEMPLATE_ENDPOINT))
    },
    async get(id) {
      return normalizeTemplateDetail(await readJson(`${TEMPLATE_ENDPOINT}/${encodeURIComponent(templateId(id))}`))
    },
    async create(name, questions) {
      const payload = buildTemplatePayload(name, questions)
      return normalizeTemplateDetail(await readJson(TEMPLATE_ENDPOINT, {
        method: 'POST', body: JSON.stringify(payload),
      }))
    },
  }
}
