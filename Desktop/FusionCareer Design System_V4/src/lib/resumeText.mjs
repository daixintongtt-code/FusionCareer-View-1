export function isResumeExperienceField(field) {
  return ['education', 'internship', 'campus'].includes(field)
}

export function splitResumeParagraphs(value, field) {
  if (typeof value !== 'string') return []
  const text = value.replace(/\r\n?/g, '\n')
  const separator = isResumeExperienceField(field) ? /\n(?:[ \t]*\n)+/ : /\n+/
  return text.split(separator).map(paragraph => paragraph.trim()).filter(Boolean)
}
