# 管理端岗位列表筛选接入说明

本轮仅修改前端。入口为管理端“岗位列表”上方筛选区，继续请求现有 `GET /api/admin/job-post/list`；未新增、实现或部署后端接口。

## 查询参数

| 参数 | 含义 |
| --- | --- |
| `page`、`size` | 从 1 开始的页码，每页 20 条 |
| `keyword` | 去除首尾空白的岗位名称、公司关键词，最多 200 字符 |
| `workProvince` | 省份，名称与学生端 `PROVINCES` 枚举一致 |
| `workCity` | 当前省份内选择的城市 |
| `jobCategory` | `MEDIA`、`ENTERPRISE`、`GOVERNMENT`、`ACADEMIC`、`OTHER` |
| `recruitType` | `BIG_INTERNSHIP`、`SMALL_INTERNSHIP`、`DAILY_INTERNSHIP`、`CAMPUS_RECRUITMENT` |
| `status` | `PUBLISHED`、`OFFLINE`、`EXPIRED`，不传时查询所有状态 |
| `recommended` | 仅选择“推荐中”时发送 `true`，同时发送 `status=PUBLISHED`，保留原有约定 |

空条件不发送。各条件以 AND 组合。更换省份清除旧城市；切换筛选或搜索回到第 1 页，翻页保留已应用条件。关键词正在输入但尚未点击搜索或回车时，翻页及下拉条件变化仍使用上次已应用的关键词。重置清除关键词、地区、两种类型及状态。

示例：

```text
/api/admin/job-post/list?page=1&size=20&workProvince=广东&workCity=深圳&jobCategory=MEDIA&recruitType=DAILY_INTERNSHIP&status=PUBLISHED&recommended=true
```

实际 URL 由 URLSearchParams 编码，认证沿用统一 API 客户端的 Fusion-Token。

## 响应与完整结果集

成功沿用 `{code:200,message,data}`，`data` 包含 `list`、`total`、`totalPages`。服务器应先在完整数据上筛选，再分页，并返回同一组条件下的总数和总页数。前端不会过滤已分页的当前 20 条，也不会下载所有岗位后代替服务器计算总数。

加载时清除旧行和勾选并禁用翻页；迟到响应、失败或卸载后响应不能覆盖最新查询。错误显示为错误并可重试；真实空结果显示“暂无符合条件的岗位”。发布、停止发布和批量修改状态后按当前条件刷新，避免原状态中的岗位继续残留在列表中。批量发布、下线或调整推荐等待全部写入结束再刷新，部分失败时分别报告成功和失败数量，不能提前宣称整批成功。

## 必须与实际后端核对的边界

公开候选 [FusionCareer-Backend](https://github.com/AUSIO2/FusionCareer-Backend) 在核对版本 `09867fd308802fdd61d8c52fc26ca8fd0f0c600c` 的 `JobPostQueryRequest` 中已有 `workCity`、`jobCategory`、`recruitType`，内部控制器使用 `/internal/job-post/list` 并共用查询服务。但此版本早于当前前端，不能认定就是当前部署。

该候选版本未声明 `workProvince`、`recommended`；城市查询是单字符串相等条件。因此需由实际后端维护者核对：

- 当前 `/admin/job-post/list` 是否支持上述参数，尤其省份和推荐条件；省份参数应查询整个省份而非静默忽略。
- 当前岗位支持多城市 `workCities`；选择一座城市是否匹配包含该城市的岗位，不能只对拼接后的 `workCity` 作整串相等比较。
- 所有条件共同作用于全集，过滤后的 `total` 和 `totalPages` 准确；不能忽略未知条件并返回未筛选列表。
- 省份、城市的数据规范化与既有学生端一致，避免“上海”与“上海市”等命名差异。

本次前端已沿用学生端参数命名接入，实际后台对这些字段的支持仍需联调验证。前端无法仅凭 HTTP 200 判断服务器是否静默忽略某个条件。本地测试的拦截响应不构成真实后端支持证明。

## 验收

1. 不选条件时保留全部状态列表。分别选择城市、岗位类型、招聘类型和状态，验证参数和结果。
2. 组合省市、两种类型、关键词及推荐状态，核对 AND 语义、完整结果总数和第 2 页数据。
3. 在非首页选择新条件应回到首页并清空勾选；仅翻页保留条件；更换省份清除原城市。
4. 输入新的关键词但不搜索，翻页仍用旧关键词；搜索后才应用新关键词。重置后请求只含 page 和 size。
5. 使用原本分布在多页的数据验证地区筛选仍能命中；多城市岗位应按维护者确认的成员匹配规则命中。
6. 模拟快速切换筛选、慢请求、失败和重试，核对旧结果不会覆盖新结果，错误和空结果可区分。
7. 发布或下线当前状态中的岗位后，列表、总数和页码按当前条件刷新。所有批量操作仅作用于当前明确勾选的岗位。
