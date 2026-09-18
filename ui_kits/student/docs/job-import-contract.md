# 岗位批量导入接口约定

前端页面和 Excel 模板以平台岗位字段为主，学院历史大/小实习表仅作为兼容参考。后端接入时如需调整路径，只需修改 `src/lib/jobImport.mjs` 中的 `JOB_IMPORT_ENDPOINT`。

## 请求

- 方法：`POST /admin/job-post/import`
- 类型：`multipart/form-data`
- 文件字段：`file`
- 支持格式：`.xlsx`、`.xls`
- 前端限制：最大 10 MB

## 工作簿识别

优先解析新模板中名为 `岗位数据` 的工作表。第 1 行为固定表头，第 2 行起每行代表一个岗位；空白行忽略。`填写说明`不参与导入。

如不存在 `岗位数据` 工作表，后端应尝试兼容学院历史表：

- 第 2 行为表头的 12 列、15 列或 16 列格式。
- 关键列为“单位名称/公司名称”、“实习岗位”、“需求人数”。
- 单位、部门等因合并单元格产生的空白值，先向下填充再解析。
- 第 3 行如为填写示例则跳过。
- 联系人、联系电话和“不对外”备注不写入公开岗位。

新模板的管理员填写说明记录在 `public/templates/job-import-template.xlsx` 的 `填写说明` 工作表。历史表兼容规则以本文档为准。

## 关键转换规则

- `单位名称/公司名称` → `companyName`。
- `岗位名称/实习部门` → `department`。
- `实习岗位` → `positionName`。
- `需求人数` 仅在能确定为单一正整数时写入 `headcount`；“若干”、“1-2人”或“大实习 2、小实习 2”保存为 `null`，并返回提醒。
- `岗位职责` → `jobDesc`。
- `招聘要求`、`实习时间及频次要求`、`职场发展方向` 保留原文，分别加前缀后合并到 `reqOther`。
- `大实习` → `BIG_INTERNSHIP`，`小实习` → `SMALL_INTERNSHIP`，`大/小均可` → `null`。
- `线上` → `ONLINE`，`线下` → `OFFLINE`，`线上线下均可` → `HYBRID`。
- `实习地点/单位地址` 写入 `workLocation`；能可靠识别时可补充 `workProvince` 和 `workCity`。
- 新模板中的日期、省市、每周天数、实习时长等结构化列优先于自由文本。
- 历史表缺少岗位大类时，允许暂存 `OTHER`，并通过 `warnings` 提示管理员复核。

## 薪资隐私规则

- `薪资/补贴说明` 用于管理员核对，默认不写入 `salaryMin`、`salaryMax`或 `salaryDisplay`；历史表头 `薪资/补贴说明（不对外）` 仍按同样规则兼容。
- 只有新模板的 `薪资是否公开` 明确为“是”时，后端才处理公开薪资列。
- 如选择“否”，即使公开薪资列有值，也必须忽略并返回提醒。

## 保存规则

- 每条成功解析的岗位都以 `OFFLINE` 状态保存，进入草稿箱，不直接发布。
- `recommended` 默认为 `false`。
- 如岗位来源枚举支持，建议将 `sourceType` 设为 `BATCH_IMPORT`；暂不支持时可使用 `PLATFORM`。
- `官网投递链接` 为空时按平台内投递处理，并创建默认必填问卷题目“个人简历”（`FILE_UPLOAD`）。
- `官网投递链接` 不为空时按外部链接投递处理，不创建投递问卷。
- 允许部分成功：合法行进入草稿箱，不合法行通过 `errors` 返回原因。可修正但需复核的行通过 `warnings` 返回。

## 响应

沿用项目统一的 `R<T>` 包装：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "successCount": 3,
    "failedCount": 1,
    "errors": [
      {
        "rowNumber": 5,
        "message": "缺少实习岗位"
      }
    ],
    "warnings": [
      {
        "rowNumber": 3,
        "message": "需求人数为“若干”，headcount 已留空"
      }
    ]
  }
}
```

前端也兼容联调期间常见的 `importedCount`、`createdCount`、`failureCount`、`failedRows`和 `warningMessages` 等字段名，但正式接口建议使用上面的字段。
