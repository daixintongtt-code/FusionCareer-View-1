// Java Long IDs can exceed JavaScript's safe integer range. Keep them as strings.
export function apiId(value) {
  return value == null ? '' : String(value)
}

export function buildAnswersJson(questions, textAnswers, fileAnswersOrIds) {
  const rows = []
  for (const question of questions) {
    const questionId = apiId(question.id)
    if (question.type === 'FILE_UPLOAD') {
      const fileAnswer = fileAnswersOrIds[question.id]
      const fileId = typeof fileAnswer === 'object' && fileAnswer != null
        ? fileAnswer.id : fileAnswer
      rows.push({ questionId, value: apiId(fileId) })
    } else if (question.type === 'CHECKBOX') {
      rows.push({ questionId, value: (textAnswers[question.id] || []).join(',') })
    } else {
      rows.push({ questionId, value: String(textAnswers[question.id] ?? '') })
    }
  }
  return JSON.stringify(rows)
}

export function buildSubmitBody(jobPostId, questions, textAnswers, fileAnswersOrIds) {
  return {
    jobPostId: apiId(jobPostId),
    answers: buildAnswersJson(questions, textAnswers, fileAnswersOrIds),
  }
}
