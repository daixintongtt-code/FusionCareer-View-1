# 岗位定向简历修改接口约定

岗位详情页的 AI 助手通过同一个接口处理“我的简历”和“实时上传”两种来源。前端不会先把实时上传文件保存到“我的简历”。

## 接口

`POST /job/{jobPostId}/resume/advice`

请求需要携带现有登录态 `Fusion-Token`。`jobPostId` 为当前岗位详情页路由参数。

### 使用已上传简历

`Content-Type: application/json`

```json
{
  "resumeFileId": "2099149765045182470"
}
```

### 实时上传简历

`Content-Type: multipart/form-data`

- 文件字段名：`file`
- 支持格式：PDF、DOCX、JPG、JPEG、PNG
- 最大文件大小：20 MB

## 成功响应

建议返回统一响应外壳，并在 `data.markdown` 中返回完整 Markdown。Markdown 可包含标题、正文、引用、无序/有序列表和表格。

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "markdown": "# 简历修改建议\n\n## 岗位要求对照表\n\n| 岗位要求 | 判断 | 简历证据 | 建议动作 |\n| --- | --- | --- | --- |\n| 熟悉新媒体平台 | 部分匹配 | 有公众号经历 | 补充账号名称与数据 |",
    "matchLevel": "mixed"
  }
}
```

为便于联调，前端也兼容 `data` 直接为 Markdown 字符串，以及 `content`、`advice`、`result`、`report`、`text` 字段；后端正式实现仍建议固定使用 `markdown`。

## 内容规则

- 所有结论必须基于简历与岗位原文，不推断不存在的经历或数据。
- 不确定的量化信息使用“待确认”，并明确提示“仅在属实时使用”。
- 建议包含岗位要求对照表、分优先级修改建议、模块顺序和确认问题。
- 表格单元格中不要输出 HTML；前端会将 Markdown 当作纯文本解析，避免脚本注入。

## 错误响应

沿用项目现有响应格式：

```json
{
  "code": 400,
  "message": "暂不支持该文件格式",
  "data": null
}
```

建议的状态/业务错误包括：未登录、岗位不存在、简历不存在、文件格式或大小不合法、文档解析失败、算法服务超时。
