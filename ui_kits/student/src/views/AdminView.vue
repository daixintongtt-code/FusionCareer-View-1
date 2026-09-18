<template>
  <div>
    <!-- 管理员导航 -->
    <nav class="navbar">
      <!-- sidebar 区域：宽度与 --sidebar-w 对齐，品牌居中 -->
      <div class="navbar-brand-col">
        <RouterLink class="brand" to="/admin">
          <div class="brand-dot">
            <i class="ti ti-map-pin-filled" />
          </div>
          <div>
            <div class="brand-zh">复新生涯</div>
            <div class="brand-en">ADMIN CONSOLE</div>
          </div>
        </RouterLink>
      </div>
      <!-- main 区域：撑满剩余，右侧 padding 与 admin-main 对齐 -->
      <div class="navbar-main-col">
        <div class="nav-right">
          <div class="nav-avatar">{{ displayAdminInitial }}</div>
          <span style="font-size:.8rem;color:var(--ink-2)">{{ displayAdminName }}</span>
          <button type="button" class="btn btn-ghost btn-sm" @click="logoutSession()"><i class="ti ti-logout" /></button>
        </div>
      </div>
    </nav>

    <div class="admin-layout">
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-label">岗位管理</div>
        <button :class="['sidebar-link', v==='list'&&'active']" @click="showJobs"><i class="ti ti-list" />岗位列表</button>
        <button :class="['sidebar-link', v==='create'&&'active']" @click="startCreate"><i class="ti ti-plus" />新建岗位</button>
        <button :class="['sidebar-link', v==='drafts'&&'active']" @click="showDrafts"><i class="ti ti-inbox" />草稿箱<span v-if="readDraftTotal>0" class="sidebar-badge">{{ readDraftTotal }}</span></button>
        <button :class="['sidebar-link', v==='recycle'&&'active']" @click="showRecycleBin"><i class="ti ti-recycle" />回收站</button>
        <button :class="['sidebar-link', v==='resumes'&&'active']" @click="showResumes"><i class="ti ti-file-text" />简历管理</button>
        <template v-if="isSuperAdmin">
          <div class="sidebar-label">系统管理</div>
          <button :class="['sidebar-link', v==='users'&&'active']" @click="showUsers"><i class="ti ti-users" />用户管理</button>
        </template>
      </aside>

      <main class="admin-main">

        <!-- ───── 用户管理 ───── -->
        <div v-if="v==='users'">
          <div class="page-hd">
            <div><h1><i class="ti ti-users" />用户管理</h1></div>
          </div>

          <div style="display:flex;align-items:center;gap:.625rem;margin-bottom:1.1rem;flex-wrap:wrap">
            <input class="form-control" style="flex:1;min-width:180px;padding:.5rem .875rem" v-model="searchUsername" placeholder="搜索用户名..." @keyup.enter="searchUsers" />
            <select class="form-control" style="min-width:120px;padding:.5rem .875rem" v-model="searchUserRole" @change="searchUsers">
              <option value="">全部角色</option><option value="SUPER_ADMIN">超级管理员</option><option value="ADMIN">管理员</option><option value="NORMAL">普通用户</option>
            </select>
            <button class="btn btn-secondary btn-sm" @click="searchUsers"><i class="ti ti-search" />搜索</button>
          </div>

          <div class="card" style="overflow:auto">
            <table class="data-table">
              <thead>
                <tr><th>用户名</th><th>学工号</th><th>角色</th><th>注册时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-if="usersLoading"><td colspan="5" class="table-state">用户加载中…</td></tr>
                <tr v-else-if="displayUserError">
                  <td colspan="5" class="table-state" role="alert">
                    <div>{{ displayUserError }}</div>
                    <button class="btn btn-secondary btn-sm" @click="loadUsers">重新加载</button>
                  </td>
                </tr>
                <tr v-else-if="!displayUsers.length"><td colspan="5" class="table-state">暂无用户</td></tr>
                <tr v-for="user in displayUsers" v-else :key="user.id">
                  <td style="font-weight:600">{{ user.username || '—' }}</td>
                  <td style="font-family:monospace;color:var(--ink-2)">{{ user.studentId || '—' }}</td>
                  <td><span :class="['badge', roleClass(user.role)]">{{ roleLabel(user.role) }}</span></td>
                  <td style="color:var(--ink-3)">{{ user.createdAt?.replace('T', ' ').slice(0, 16) || '—' }}</td>
                  <td>
                    <select
                      class="form-control role-select"
                      :value="user.role"
                      :disabled="updatingUserId===user.id"
                      @change="changeRole(user, $event.target.value, $event)"
                    >
                      <option value="NORMAL">普通用户</option>
                      <option value="ADMIN">管理员</option>
                      <option value="SUPER_ADMIN">超级管理员</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!usersLoading && !displayUserError" class="pagination" style="margin-top:.875rem">
            <span style="font-size:.773rem;color:var(--ink-3);margin-right:auto">共 {{ readUserTotal }} 名用户</span>
            <button class="page-btn" :disabled="readUserPage<=1" @click="changeUserPage(readUserPage-1)"><i class="ti ti-chevron-left" /></button>
            <span style="font-size:.773rem;color:var(--ink-3)">第 {{ readUserPage }} / {{ readUserPages }} 页</span>
            <button class="page-btn" :disabled="readUserPage>=readUserPages" @click="changeUserPage(readUserPage+1)"><i class="ti ti-chevron-right" /></button>
            <PageJump :current="readUserPage" :total="readUserPages" @change="changeUserPage" />
          </div>
        </div>

        <!-- ───── 岗位列表 ───── -->
        <div v-if="v==='list'">
          <div class="page-hd">
            <div><h1><i class="ti ti-list" />岗位列表</h1></div>
          </div>

          <!-- 工具栏 -->
          <div style="display:flex;align-items:center;gap:.625rem;margin-bottom:1.1rem;flex-wrap:wrap">
            <input class="form-control" style="flex:1;min-width:180px;padding:.5rem .875rem" v-model="sk" placeholder="搜索岗位名称、公司..." @keyup.enter="searchJobs" />
            <select class="form-control" style="min-width:110px;padding:.5rem .875rem" v-model="sf" @change="searchJobs">
              <option value="">全部状态</option><option value="PUBLISHED">发布中</option><option value="RECOMMENDED">推荐中</option><option value="OFFLINE">未发布</option><option value="EXPIRED">已截止</option>
            </select>
            <button class="btn btn-secondary btn-sm" @click="searchJobs"><i class="ti ti-search" />搜索</button>
          </div>

          <!-- 批量操作栏 -->
          <div v-if="selected.length" style="display:flex;align-items:center;gap:.5rem;padding:.55rem .875rem;background:var(--red-light);border:1px solid var(--red-border);border-radius:var(--r-md);margin-bottom:.875rem;font-size:.8rem;color:var(--red);flex-wrap:wrap">
            已选 {{ selected.length }} 条 &nbsp;·&nbsp;
            <button v-if="publishableCount>0" class="btn btn-secondary btn-sm" :disabled="updatingJobs" @click="bulkPublish"><i class="ti ti-send" />发布（{{ publishableCount }} 条）</button>
            <button v-if="offlinableCount>0" class="btn btn-secondary btn-sm" :disabled="updatingJobs" @click="bulkOffline"><i class="ti ti-send-off" />停止发布（{{ offlinableCount }} 条）</button>
            <button v-if="recableCount>0" class="btn btn-secondary btn-sm" :disabled="updatingJobs" @click="bulkRec(true)"><i class="ti ti-star" />批量设为推荐</button>
            <button v-if="recableCount>0" class="btn btn-secondary btn-sm" :disabled="updatingJobs" @click="bulkRec(false)"><i class="ti ti-star-off" />取消推荐</button>
            <button class="btn btn-red-soft btn-sm" @click="bulkDelete"><i class="ti ti-trash" />批量删除</button>
          </div>

          <!-- 表格 -->
          <div class="card" style="overflow:hidden">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-check"><input type="checkbox" :checked="displayJobs.length>0 && displayJobs.every(j=>selected.includes(j.id))" @change="e=>toggleAll(e.target.checked)" /></th>
                  <th>岗位名称</th><th>公司</th><th>城市</th><th>投递截止</th><th>状态</th><th>投递数</th><th>推荐</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="jobsLoading"><td colspan="9" style="text-align:center;color:var(--ink-3)">岗位加载中…</td></tr>
                <tr v-else-if="displayJobError">
                  <td colspan="9" class="table-state" role="alert">
                    <div>{{ displayJobError }}</div>
                    <button class="btn btn-secondary btn-sm" @click="loadJobs">重新加载</button>
                  </td>
                </tr>
                <tr v-else-if="displayJobs.length===0"><td colspan="9" style="text-align:center;color:var(--ink-3)">暂无岗位</td></tr>
                <template v-else>
                <tr v-for="j in displayJobs" :key="j.id">
                  <td class="col-check"><input type="checkbox" :checked="selected.includes(j.id)" @change="toggleSel(j.id)" /></td>
                  <td><span style="font-weight:500;cursor:pointer;color:var(--ink)" @click="openEdit(j)">{{ j.positionName }}</span></td>
                  <td>{{ j.companyName }}</td>
                  <td>{{ j.workCity }}</td>
                  <td>{{ j.applicationDeadline || '—' }}</td>
                  <td><span :class="['badge', STATUS_CLASS[j.status]]">{{ STATUS_LABEL[j.status] }}</span></td>
                  <td>
                    <span v-if="j.sourceUrl" class="badge badge-gray" style="font-size:.72rem;gap:3px"><i class="ti ti-external-link" style="font-size:9px" />外部投递</span>
                    <span v-else>{{ j.apps ?? 0 }}</span>
                  </td>
                  <td><span v-if="j.status==='PUBLISHED'" :class="['rec-toggle', j.rec&&'on', updatingJobs&&'action-disabled']" @click="toggleRec(j)"><i :class="['ti', j.rec?'ti-star-filled':'ti-star']" />{{ j.rec?'推荐中':'设为推荐' }}</span><span v-else style="color:var(--ink-4);font-size:.78rem">—</span></td>
                  <td>
                    <div class="tbl-acts">
                      <div class="tbl-btn" @click="openEdit(j)"><span class="tbl-tip">编辑</span><i class="ti ti-edit" /></div>
                      <div v-if="j.status==='OFFLINE'" :class="['tbl-btn approve', updatingJobs&&'action-disabled']" @click="publish(j)"><span class="tbl-tip">发布上线</span><i class="ti ti-send" /></div>
                      <div v-else-if="j.status==='PUBLISHED'" :class="['tbl-btn', updatingJobs&&'action-disabled']" @click="offline(j)"><span class="tbl-tip">停止发布</span><i class="ti ti-send-off" /></div>
                      <div v-if="j.status!=='OFFLINE' && !j.sourceUrl" class="tbl-btn" @click="goJobResumes(j)"><span class="tbl-tip">查看简历</span><i class="ti ti-file-text" /></div>
                    </div>
                  </td>
                </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div v-if="!jobsLoading && !displayJobError" class="pagination" style="margin-top:.875rem">
            <span style="font-size:.773rem;color:var(--ink-3);margin-right:auto">共 {{ readJobTotal }} 条</span>
            <button class="page-btn" :disabled="readJobPage<=1" @click="changeJobPage(readJobPage-1)"><i class="ti ti-chevron-left" /></button>
            <span style="font-size:.773rem;color:var(--ink-3)">第 {{ readJobPage }} / {{ readJobPages }} 页</span>
            <button class="page-btn" :disabled="readJobPage>=readJobPages" @click="changeJobPage(readJobPage+1)"><i class="ti ti-chevron-right" /></button>
            <PageJump :current="readJobPage" :total="readJobPages" @change="changeJobPage" />
          </div>
        </div>

        <!-- ───── 新建/编辑岗位 ───── -->
        <div v-if="v==='create'">
          <div class="page-hd">
            <div>
              <h1><i :class="editingId?'ti ti-edit':'ti ti-plus'" />{{ editingId ? '编辑岗位' : '新建岗位' }}</h1>
              
            </div>
          </div>

          <div v-if="!editingId" class="create-entry-grid">
            <section class="card card-p create-entry-card">
              <div class="form-section-title">智能解析岗位描述</div>
              <div class="form-group">
                <label class="form-label">岗位原文</label>
                <textarea class="form-control" style="min-height:140px" v-model="rawJobText" placeholder="粘贴完整岗位描述，系统将提取公司、岗位、地点、薪资和任职要求等字段…" />
              </div>
              <div class="create-entry-actions">
                <span class="create-entry-hint">解析结果只会填入下方表单，请检查并编辑后再发布。</span>
                <button type="button" class="btn btn-primary btn-sm" :disabled="structuring || !rawJobText.trim()" @click="structureJob">
                  <i :class="['ti', structuring ? 'ti-loader-2' : 'ti-sparkles']" />{{ structuring ? '正在解析…' : '解析并填充' }}
                </button>
              </div>
              <div v-if="structureWarnings.length" class="structure-warning" role="alert">
                <div v-for="warning in structureWarnings" :key="warning">{{ warning }}</div>
              </div>
              <div v-if="structuredJobs.length>1" style="margin-top:.75rem">
                <div style="font-size:.78rem;color:var(--ink-2);margin-bottom:.45rem">识别到多个岗位，请选择一个继续编辑：</div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                  <button v-for="(job, index) in structuredJobs" :key="index" type="button" class="btn btn-secondary btn-sm" @click="applyStructuredJob(job)">
                    {{ job.companyName || '未知公司' }} · {{ job.positionName || `岗位 ${index + 1}` }}
                  </button>
                </div>
              </div>
            </section>

            <section class="card card-p create-entry-card">
              <div class="form-section-title">批量导入岗位</div>
              <div class="bulk-import-intro">
                <div><span>1</span>下载模板并按填写说明录入岗位</div>
                <div><span>2</span>上传 Excel，系统解析后统一存入草稿箱</div>
              </div>
              <a class="btn btn-secondary btn-sm bulk-template-link" :href="JOB_IMPORT_TEMPLATE_URL" download="岗位批量导入模板.xlsx">
                <i class="ti ti-download" />下载 Excel 模板
              </a>
              <input ref="bulkImportInput" class="sr-only" type="file" accept=".xlsx,.xls" @change="handleBulkImportChange" />
              <button
                type="button"
                :class="['bulk-upload-zone', bulkDragActive && 'dragging', bulkImportFile && 'has-file']"
                :disabled="bulkImporting"
                @click="bulkImportInput?.click()"
                @dragenter.prevent="bulkDragActive=true"
                @dragover.prevent="bulkDragActive=true"
                @dragleave.prevent="bulkDragActive=false"
                @drop.prevent="handleBulkImportDrop"
              >
                <i :class="['ti', bulkImporting ? 'ti-loader-2' : bulkImportFile ? 'ti-file-spreadsheet' : 'ti-cloud-upload']" />
                <template v-if="bulkImportFile">
                  <strong>{{ bulkImportFile.name }}</strong>
                  <span>{{ formatFileSize(bulkImportFile.size) }} · 点击可重新选择</span>
                </template>
                <template v-else>
                  <strong>点击选择或拖拽 Excel 文件到此处</strong>
                  <span>支持 .xlsx、.xls，文件不超过 10 MB</span>
                </template>
              </button>
              <div class="create-entry-actions">
                <span class="create-entry-hint">成功导入的岗位不会直接发布。</span>
                <button type="button" class="btn btn-primary btn-sm" :disabled="bulkImporting || !bulkImportFile" @click="importJobWorkbook">
                  <i :class="['ti', bulkImporting ? 'ti-loader-2' : 'ti-file-import']" />{{ bulkImporting ? '正在上传并解析…' : '上传并导入' }}
                </button>
              </div>
            </section>
          </div>

          <div class="card card-p" style="margin-bottom:1rem">
            <div class="form-section-title">基本信息</div>
            <div class="grid-2">
              <div class="form-group"><label class="form-label">岗位名称 <span class="req">*</span></label>
                <input class="form-control" v-model="nj.positionName" placeholder="如：新媒体编辑记者（2025校招）" />
              </div>
              <div class="form-group"><label class="form-label">所属公司 <span class="req">*</span></label>
                <input class="form-control" v-model="nj.companyName" placeholder="公司全称" />
              </div>
              <div class="form-group"><label class="form-label">所属部门</label>
                <input class="form-control" v-model="nj.department" placeholder="如：新媒体中心" />
              </div>
              <div class="form-group"><label class="form-label">招聘人数</label>
                <input class="form-control" type="number" min="1" v-model.number="nj.headcount" placeholder="若干" />
              </div>
              <div class="form-group"><label class="form-label">投递截止日期</label>
                <input class="form-control" type="date" v-model="nj.applicationDeadline" />
              </div>
              <div class="form-group"><label class="form-label">岗位大类 <span class="req">*</span></label>
                <select class="form-control" v-model="nj.jobCategory" @change="nj.jobSubCategory=''">
                  <option value="">请选择</option>
                  <option value="ACADEMIC">学术教职</option>
                  <option value="GOVERNMENT">党政机关</option>
                  <option value="MEDIA">新闻媒体</option>
                  <option value="ENTERPRISE">企业公司</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">岗位小类</label>
                <select class="form-control" v-model="nj.jobSubCategory" :disabled="!nj.jobCategory">
                  <option value="">请选择</option>
                  <template v-if="nj.jobCategory==='ACADEMIC'">
                    <option value="FURTHER_STUDY">升学深造</option>
                    <option value="TEACHING_POSITION">考取教职</option>
                    <option value="MIDDLE_SCHOOL_TEACHER">中学教师</option>
                  </template>
                  <template v-else-if="nj.jobCategory==='GOVERNMENT'">
                    <option value="SELECTED_GRADUATE">选调生</option>
                    <option value="CIVIL_SERVANT">公务员</option>
                    <option value="UNIVERSITY_ADMIN">高校行政</option>
                    <option value="HOSPITAL">医院</option>
                    <option value="BANK">银行</option>
                    <option value="OTHER_PUBLIC_INSTITUTION">其他事业单位</option>
                  </template>
                  <template v-else-if="nj.jobCategory==='MEDIA'">
                    <option value="CENTRAL_MEDIA">党报央媒</option>
                    <option value="REGIONAL_MEDIA">地区主流媒体</option>
                    <option value="OTHER_MEDIA">其他媒体机构</option>
                    <option value="SELF_MEDIA">自媒体</option>
                  </template>
                  <template v-else-if="nj.jobCategory==='ENTERPRISE'">
                    <option value="STATE_OWNED">国央企</option>
                    <option value="PRIVATE_ENTERPRISE">民企</option>
                    <option value="FOREIGN_ENTERPRISE">外企</option>
                  </template>
                  <option v-else value="OTHER">其他</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">招聘类型</label>
                <select class="form-control" v-model="nj.recruitType">
                  <option value="">请选择</option>
                  <option value="BIG_INTERNSHIP">大实习</option>
                  <option value="SMALL_INTERNSHIP">小实习</option>
                  <option value="DAILY_INTERNSHIP">日常实习</option>
                  <option value="CAMPUS_RECRUITMENT">应届生招聘</option>
                  <option value="CAMPUS_SCREENING">应届生摸排</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">学历要求</label>
                <select class="form-control" v-model="nj.reqEduLevel">
                  <option value="">不限</option>
                  <option value="UNDERGRADUATE">本科生</option>
                  <option value="ACADEMIC_MASTER">学术硕士研究生</option>
                  <option value="PROFESSIONAL_MASTER">专业硕士研究生</option>
                  <option value="DOCTORAL">博士研究生</option>
                </select>
              </div>
            </div>
          </div>

          <div class="card card-p" style="margin-bottom:1rem">
            <div class="form-section-title">工作安排</div>
            <div class="grid-2">
              <div class="form-group"><label class="form-label">工作开始日期</label>
                <input class="form-control" type="date" v-model="nj.workStartDate" />
              </div>
              <div class="form-group"><label class="form-label">工作结束日期</label>
                <input class="form-control" type="date" v-model="nj.workEndDate" />
              </div>
              <div class="form-group"><label class="form-label">工作省份</label>
                <input class="form-control" v-model="nj.workProvince" placeholder="如：上海市" />
              </div>
              <div class="form-group"><label class="form-label">工作城市</label>
                <input class="form-control" v-model="nj.workCity" placeholder="如：上海" />
              </div>
              <div class="form-group span-2"><label class="form-label">详细地点</label>
                <input class="form-control" v-model="nj.workLocation" placeholder="如：徐汇区某路某号" />
              </div>
              <div class="form-group"><label class="form-label">工作形式</label>
                <select class="form-control" v-model="nj.workMode">
                  <option value="">不限</option>
                  <option value="ONLINE">线上</option>
                  <option value="OFFLINE">线下</option>
                  <option value="HYBRID">线上线下均可</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">每周天数（区间）</label>
                <select class="form-control" v-model="nj.workDurationType">
                  <option value="">不限</option>
                  <option value="ONE_TO_TWO_DAYS">一周1-2天</option>
                  <option value="THREE_TO_FOUR_DAYS">一周3-4天</option>
                  <option value="FIVE_DAYS">一周5天</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">每周具体天数</label>
                <input class="form-control" type="number" min="1" max="7" v-model.number="nj.workDaysPerWeek" placeholder="如：3" />
              </div>
              <div class="form-group"><label class="form-label">实习时长</label>
                <select class="form-control" v-model="nj.workPeriodType">
                  <option value="">不限</option>
                  <option value="LESS_THAN_THREE_MONTHS">3个月以内</option>
                  <option value="THREE_TO_SIX_MONTHS">3-6个月</option>
                  <option value="MORE_THAN_SIX_MONTHS">6个月以上</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">薪资下限（元/天）</label>
                <input class="form-control" type="number" min="0" v-model.number="nj.salaryMin" placeholder="如：200" />
              </div>
              <div class="form-group"><label class="form-label">薪资上限（元/天）</label>
                <input class="form-control" type="number" min="0" v-model.number="nj.salaryMax" placeholder="如：400" />
              </div>
              <div class="form-group span-2"><label class="form-label">薪资展示文字</label>
                <input class="form-control" v-model="nj.salaryDisplay" placeholder="如：面议、200-400元/天，留空则自动生成" />
                <div style="font-size:.75rem;color:var(--ink-3);margin-top:.3rem"><i class="ti ti-info-circle" style="vertical-align:-1px" /> 填写后优先展示此文字，不填则由薪资上下限自动生成</div>
              </div>
            </div>
          </div>

          <div class="card card-p" style="margin-bottom:1rem">
            <div class="form-section-title">岗位详情</div>
            <div class="grid-2">
              <div class="form-group span-2"><label class="form-label">岗位描述</label>
                <textarea class="form-control" style="min-height:120px" v-model="nj.jobDesc" placeholder="描述岗位职责、日常工作内容等..." />
              </div>
              <div class="form-group"><label class="form-label">专业要求</label>
                <input class="form-control" v-model="nj.reqMajor" placeholder="如：新闻传播学、中文、汉语言文学" />
              </div>
              <div class="form-group"><label class="form-label">毕业年份要求</label>
                <input class="form-control" v-model="nj.reqGradYear" placeholder="如：2025、2025-2026" />
              </div>
              <div class="form-group span-2"><label class="form-label">技能要求</label>
                <input class="form-control" v-model="nj.reqSkills" placeholder="如：熟练使用 Premiere、有校媒经历优先" />
              </div>
              <div class="form-group span-2"><label class="form-label">其他要求</label>
                <textarea class="form-control" style="min-height:72px" v-model="nj.reqOther" placeholder="其他补充说明..." />
              </div>
            </div>
          </div>

          <!-- 投递设置 -->
          <div class="card card-p" style="margin-bottom:1rem">
            <div class="form-section-title">投递设置</div>

            <!-- 投递方式切换 -->
            <div style="display:flex;gap:.75rem;margin-bottom:1.25rem">
              <div class="mode-btn" :class="{active: deliveryMode==='internal'}" @click="deliveryMode='internal'; nj.sourceUrl=''">
                <i class="ti ti-inbox" />
                <div>
                  <div style="font-weight:600;font-size:.83rem">平台内投递</div>
                  <div style="font-size:.73rem;color:var(--ink-3);margin-top:2px">学生在平台填写问卷投递，可统计投递数</div>
                </div>
              </div>
              <div class="mode-btn" :class="{active: deliveryMode==='external'}" @click="deliveryMode='external'; nj.questions=[]">
                <i class="ti ti-external-link" />
                <div>
                  <div style="font-weight:600;font-size:.83rem">外部链接投递</div>
                  <div style="font-size:.73rem;color:var(--ink-3);margin-top:2px">学生点击跳转官网，无法统计投递数</div>
                </div>
              </div>
            </div>

            <!-- 外部链接模式 -->
            <div v-if="deliveryMode==='external'" class="form-group">
              <label class="form-label">官网投递链接 <span class="req">*</span></label>
              <input class="form-control" type="url" v-model="nj.sourceUrl" placeholder="https://..." />
              <div style="font-size:.75rem;color:var(--ink-3);margin-top:.3rem"><i class="ti ti-info-circle" style="vertical-align:-1px" /> 填写后「投递数」列将显示「外部投递」标签</div>
            </div>

            <!-- 平台内投递：问卷编辑器 -->
            <div v-else>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
                <div style="font-size:.8rem;font-weight:600;color:var(--ink-2)">投递问卷题目</div>
                <button class="btn btn-secondary btn-sm" @click="addQuestion"><i class="ti ti-plus" />添加题目</button>
              </div>

              <div v-if="nj.questions.length===0" style="text-align:center;padding:2rem;color:var(--ink-3);font-size:.8rem;border:1.5px dashed var(--border-mid);border-radius:var(--r-md)">
                <i class="ti ti-forms" style="font-size:1.5rem;display:block;margin-bottom:.4rem"></i>
                <span>暂无题目，点击「添加题目」开始设计投递问卷</span>
              </div>

              <div v-for="(q, qi) in nj.questions" :key="qi" class="q-card">
                <div class="q-card-head">
                  <span class="q-index">{{ qi + 1 }}</span>
                  <div style="flex:1;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
                    <input class="form-control" style="flex:1;min-width:160px" v-model="q.title" placeholder="题目标题" />
                    <select class="form-control" style="width:130px;flex-shrink:0" v-model="q.questionType" @change="q.options=q.questionType==='RADIO'||q.questionType==='CHECKBOX'?['']:[]">
                      <option value="TEXT">单行文本</option>
                      <option value="TEXTAREA">多行文本</option>
                      <option value="RADIO">单选</option>
                      <option value="CHECKBOX">多选</option>
                      <option value="FILE_UPLOAD">文件上传</option>
                    </select>
                    <label style="display:flex;align-items:center;gap:.3rem;font-size:.78rem;color:var(--ink-2);cursor:pointer;white-space:nowrap">
                      <input type="checkbox" v-model="q.required" style="accent-color:var(--red)" /> 必填
                    </label>
                  </div>
                  <div style="display:flex;gap:4px;flex-shrink:0">
                    <button class="icon-btn" :disabled="qi===0" @click="moveQ(qi,-1)"><i class="ti ti-chevron-up" /></button>
                    <button class="icon-btn" :disabled="qi===nj.questions.length-1" @click="moveQ(qi,1)"><i class="ti ti-chevron-down" /></button>
                    <button class="icon-btn danger" @click="nj.questions.splice(qi,1)"><i class="ti ti-trash" /></button>
                  </div>
                </div>

                <div v-if="q.questionType==='TEXT'||q.questionType==='TEXTAREA'" style="margin-top:.5rem">
                  <input class="form-control" v-model="q.placeholder" placeholder="输入提示文字（可选）" style="font-size:.8rem" />
                </div>

                <div v-if="q.questionType==='RADIO'||q.questionType==='CHECKBOX'" style="margin-top:.6rem">
                  <div v-for="(opt, oi) in q.options" :key="oi" style="display:flex;gap:.4rem;align-items:center;margin-bottom:.35rem">
                    <i :class="q.questionType==='RADIO'?'ti ti-circle':'ti ti-checkbox'" style="color:var(--ink-3);font-size:13px;flex-shrink:0" />
                    <input class="form-control" style="font-size:.8rem" v-model="q.options[oi]" :placeholder="`选项 ${oi+1}`" />
                    <button class="icon-btn danger" style="width:24px;height:24px;font-size:11px" @click="q.options.splice(oi,1)" :disabled="q.options.length<=1"><i class="ti ti-x" /></button>
                  </div>
                  <button class="btn btn-secondary btn-sm" style="font-size:.75rem;padding:.25rem .6rem;margin-top:.2rem" @click="q.options.push('')"><i class="ti ti-plus" />添加选项</button>
                </div>

                <div v-if="q.questionType==='FILE_UPLOAD'" style="margin-top:.5rem;font-size:.75rem;color:var(--ink-3)">
                  <i class="ti ti-info-circle" style="vertical-align:-1px" /> 学生将上传文件（如简历 PDF），后台可下载
                </div>
              </div>
            </div>
          </div>

          <div class="card card-p">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:.5rem">
              <button class="btn btn-secondary btn-sm" @click="v=editingId?'list':'list'; _resetForm()">取消</button>
              <button class="btn btn-secondary btn-sm" :disabled="savingJob" @click="saveDraft"><i class="ti ti-device-floppy" />保存草稿</button>
              <button class="btn btn-primary btn-sm" :disabled="savingJob" @click="publishJob"><i class="ti ti-send" />{{ savingJob ? '提交中…' : '发布上线' }}</button>
            </div>
          </div>
        </div>

        <!-- ───── 草稿箱 ───── -->
        <div v-if="v==='drafts'">
          <div class="page-hd">
            <div><h1><i class="ti ti-inbox" />草稿箱</h1></div>
          </div>
          <div v-if="bulkImportResult" :class="['bulk-import-result', (bulkImportResult.failedCount > 0 || bulkImportResult.warnings.length > 0) && 'has-warnings']" role="status">
            <i :class="['ti', (bulkImportResult.failedCount > 0 || bulkImportResult.warnings.length > 0) ? 'ti-alert-circle' : 'ti-circle-check-filled']" />
            <div style="flex:1;min-width:0">
              <strong>{{ bulkImportResult.failedCount > 0 ? '批量导入已完成，请检查失败记录' : bulkImportResult.warnings.length > 0 ? '岗位已导入草稿箱，请复核提醒' : '岗位已批量导入草稿箱' }}</strong>
              <div>
                <template v-if="bulkImportResult.successCount != null">成功 {{ bulkImportResult.successCount }} 条</template>
                <template v-else>导入请求已完成</template>
                <template v-if="bulkImportResult.failedCount > 0">，失败 {{ bulkImportResult.failedCount }} 条</template>
              </div>
              <ul v-if="bulkImportResult.errors.length">
                <li v-for="error in bulkImportResult.errors.slice(0, 5)" :key="error">{{ error }}</li>
                <li v-if="bulkImportResult.errors.length > 5">另有 {{ bulkImportResult.errors.length - 5 }} 条错误，请修改文件后重新导入。</li>
              </ul>
              <div v-if="bulkImportResult.warnings.length" class="bulk-import-warnings">
                <b>待复核 {{ bulkImportResult.warnings.length }} 条：</b>
                <ul>
                  <li v-for="warning in bulkImportResult.warnings.slice(0, 5)" :key="warning">{{ warning }}</li>
                  <li v-if="bulkImportResult.warnings.length > 5">另有 {{ bulkImportResult.warnings.length - 5 }} 条提醒。</li>
                </ul>
              </div>
            </div>
            <button type="button" class="btn-icon" aria-label="关闭导入结果" @click="bulkImportResult=null"><i class="ti ti-x" /></button>
          </div>
          <div v-if="draftsLoading" class="card table-state">草稿加载中…</div>
          <div v-else-if="displayDraftError" class="card table-state" role="alert">
            <div>{{ displayDraftError }}</div>
            <button class="btn btn-secondary btn-sm" @click="loadDrafts">重新加载</button>
          </div>
          <div v-else-if="displayDraftJobs.length===0" style="text-align:center;padding:3rem;color:var(--ink-3);font-size:.86rem">
            <i class="ti ti-inbox" style="font-size:2rem;display:block;margin-bottom:.5rem" />暂无草稿
          </div>
          <template v-else>
            <!-- 批量操作栏 -->
            <div v-if="draftSelected.length" style="display:flex;align-items:center;gap:.5rem;padding:.55rem .875rem;background:var(--red-light);border:1px solid var(--red-border);border-radius:var(--r-md);margin-bottom:.875rem;font-size:.8rem;color:var(--red);flex-wrap:wrap">
              已选 {{ draftSelected.length }} 条 &nbsp;·&nbsp;
              <button class="btn btn-secondary btn-sm" :disabled="updatingJobs" @click="draftBulkPublish"><i class="ti ti-player-play" />批量发布上线</button>
              <button class="btn btn-red-soft btn-sm" @click="draftBulkDelete"><i class="ti ti-trash" />批量删除</button>
            </div>
            <div class="card" style="overflow:hidden">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-check"><input type="checkbox" :checked="displayDraftJobs.length>0 && displayDraftJobs.every(j=>draftSelected.includes(j.id))" @change="e=>draftToggleAll(e.target.checked)" /></th>
                    <th>岗位名称</th><th>公司</th><th>城市</th><th>投递截止</th><th>来源</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="j in displayDraftJobs" :key="j.id">
                    <td class="col-check"><input type="checkbox" :checked="draftSelected.includes(j.id)" @change="draftToggleSel(j.id)" /></td>
                    <td><span style="font-weight:500;color:var(--ink)">{{ j.positionName }}</span></td>
                    <td>{{ j.companyName }}</td>
                    <td>{{ j.workCity }}</td>
                    <td>{{ j.applicationDeadline || '—' }}</td>
                    <td>
                      <span v-if="j.sourceType==='CRAWL'" class="badge" style="background:var(--blue-bg,#eaf0fb);color:var(--blue,#1b4f9c);gap:3px;font-size:.7rem"><i class="ti ti-robot" style="font-size:9px" />自动导入</span>
                      <span v-else-if="['EXCEL','IMPORT','BATCH_IMPORT'].includes(j.sourceType)" class="badge badge-gold" style="font-size:.7rem"><i class="ti ti-file-spreadsheet" />表格导入</span>
                      <span v-else class="badge badge-gray" style="font-size:.7rem">手动录入</span>
                    </td>
                    <td>
                      <div class="tbl-acts">
                        <div class="tbl-btn" @click="openEdit(j)"><span class="tbl-tip">继续编辑</span><i class="ti ti-edit" /></div>
                        <div :class="['tbl-btn approve', updatingJobs&&'action-disabled']" @click="publish(j)"><span class="tbl-tip">发布上线</span><i class="ti ti-send" /></div>
                        <div class="tbl-btn danger" @click="bulkDelete([j.id])"><span class="tbl-tip">删除草稿</span><i class="ti ti-trash" /></div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pagination" style="margin-top:.875rem">
              <span style="font-size:.773rem;color:var(--ink-3);margin-right:auto">共 {{ readDraftTotal }} 条草稿</span>
              <button class="page-btn" :disabled="readDraftPage<=1" @click="changeDraftPage(readDraftPage-1)"><i class="ti ti-chevron-left" /></button>
              <span style="font-size:.773rem;color:var(--ink-3)">第 {{ readDraftPage }} / {{ readDraftPages }} 页</span>
              <button class="page-btn" :disabled="readDraftPage>=readDraftPages" @click="changeDraftPage(readDraftPage+1)"><i class="ti ti-chevron-right" /></button>
              <PageJump :current="readDraftPage" :total="readDraftPages" @change="changeDraftPage" />
            </div>
          </template>
        </div>

        <!-- ───── 岗位回收站 ───── -->
        <div v-if="v==='recycle'">
          <div class="page-hd">
            <div><h1><i class="ti ti-recycle" />岗位回收站</h1></div>
          </div>
          <div style="display:flex;align-items:center;gap:.625rem;margin-bottom:1.1rem">
            <input class="form-control" style="flex:1;padding:.5rem .875rem" v-model="recycleKeyword" placeholder="搜索岗位名称、公司..." @keyup.enter="searchRecycleBin" />
            <button class="btn btn-secondary btn-sm" @click="searchRecycleBin"><i class="ti ti-search" />搜索</button>
          </div>
          <div v-if="recycleLoading" class="card table-state">回收站加载中…</div>
          <div v-else-if="displayRecycleError" class="card table-state" role="alert">
            <div>{{ displayRecycleError }}</div>
            <button class="btn btn-secondary btn-sm" @click="loadRecycleBin">重新加载</button>
          </div>
          <div v-else-if="!displayRecycleJobs.length" class="card table-state">回收站为空</div>
          <template v-else>
            <div class="card" style="overflow:auto">
              <table class="data-table">
                <thead><tr><th>岗位名称</th><th>公司</th><th>投递截止</th><th>回收原因</th><th>回收时间</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="job in displayRecycleJobs" :key="job.id">
                    <td style="font-weight:500">{{ job.positionName }}</td>
                    <td>{{ job.companyName }}</td>
                    <td>{{ job.applicationDeadline || '—' }}</td>
                    <td style="max-width:360px;white-space:normal;line-height:1.5">{{ job.recycleReason || '未记录原因' }}</td>
                    <td>{{ job.recycledAt?.replace('T', ' ').slice(0, 16) || '—' }}</td>
                    <td><button class="btn btn-secondary btn-sm" :disabled="updatingJobs" @click="restoreJob(job)"><i class="ti ti-restore" />恢复为草稿</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pagination" style="margin-top:.875rem">
              <span style="font-size:.773rem;color:var(--ink-3);margin-right:auto">共 {{ readRecycleTotal }} 条</span>
              <button class="page-btn" :disabled="readRecyclePage<=1" @click="changeRecyclePage(readRecyclePage-1)"><i class="ti ti-chevron-left" /></button>
              <span style="font-size:.773rem;color:var(--ink-3)">第 {{ readRecyclePage }} / {{ readRecyclePages }} 页</span>
              <button class="page-btn" :disabled="readRecyclePage>=readRecyclePages" @click="changeRecyclePage(readRecyclePage+1)"><i class="ti ti-chevron-right" /></button>
              <PageJump :current="readRecyclePage" :total="readRecyclePages" @change="changeRecyclePage" />
            </div>
          </template>
        </div>

        <!-- ───── 简历管理：岗位列表 ───── -->
        <div v-if="v==='resumes'">
          <div class="page-hd">
            <div><h1><i class="ti ti-file-text" />简历管理</h1></div>
          </div>

          <div v-if="resumeJobsLoading" class="card table-state">岗位加载中…</div>
          <div v-else-if="displayResumeJobError" class="card table-state" role="alert">
            <div>{{ displayResumeJobError }}</div>
            <button class="btn btn-secondary btn-sm" @click="loadResumeJobs">重新加载</button>
          </div>
          <div v-else-if="!jobGroups.length" class="card table-state">暂无发布中的岗位</div>
          <div v-else class="card" style="overflow:hidden">
            <div
              v-for="jg in jobGroups" :key="jg.jobId"
              class="jrc-row"
              @click="openJobResumes(jg)"
            >
              <div class="jrc-row-icon"><i class="ti ti-building-skyscraper" /></div>
              <div class="jrc-row-main">
                <div class="jrc-row-title">{{ jg.title }}</div>
                <div class="jrc-row-sub">{{ jg.company }}</div>
              </div>
              <div class="jrc-row-meta">
                <span class="badge badge-green" style="font-size:.7rem">发布中</span>
                <span v-if="jg.dl" style="font-size:.75rem;color:var(--ink-3)">截止 {{ jg.dl }}</span>
              </div>
              <div class="jrc-row-count">
                <span class="jrc-count-num">{{ jg.applicationCount }}</span>
                <span class="jrc-count-label">份投递</span>
              </div>
              <i class="ti ti-chevron-right" style="color:var(--ink-4);font-size:1rem;flex-shrink:0" />
            </div>
          </div>
          <div v-if="!resumeJobsLoading && !displayResumeJobError && jobGroups.length" class="pagination" style="margin-top:.875rem">
            <span style="font-size:.773rem;color:var(--ink-3);margin-right:auto">共 {{ readResumeJobTotal }} 个发布岗位</span>
            <button class="page-btn" :disabled="readResumeJobPage<=1" @click="changeResumeJobPage(readResumeJobPage-1)"><i class="ti ti-chevron-left" /></button>
            <span style="font-size:.773rem;color:var(--ink-3)">第 {{ readResumeJobPage }} / {{ readResumeJobPages }} 页</span>
            <button class="page-btn" :disabled="readResumeJobPage>=readResumeJobPages" @click="changeResumeJobPage(readResumeJobPage+1)"><i class="ti ti-chevron-right" /></button>
            <PageJump :current="readResumeJobPage" :total="readResumeJobPages" @change="changeResumeJobPage" />
          </div>
        </div>

        <!-- ───── 简历管理：某岗位问卷列表 ───── -->
        <div v-if="v==='resumeDetail'">
          <div class="page-hd">
            <div>
              <h1><i class="ti ti-clipboard-list" />{{ currentJobGroup?.title }}</h1>
            </div>
            <div class="page-hd-actions">
              <button class="btn btn-secondary btn-sm" @click="showResumes"><i class="ti ti-arrow-left" />返回</button>
              <div class="export-dropdown" :class="{open: exportMenuOpen}">
                <button class="btn btn-primary btn-sm" @click.stop="exportMenuOpen=!exportMenuOpen">
                  <i class="ti ti-package-export" />导出
                  <i class="ti ti-chevron-down" style="font-size:11px;margin-left:2px" />
                </button>
                <div class="export-menu" @click.stop>
                  <div class="export-menu-item" @click="exportData('csv'); exportMenuOpen=false">
                    <i class="ti ti-table-export" />仅导出问卷数据
                    <span>CSV（Excel 可打开）</span>
                  </div>
                  <div class="export-menu-item" @click="exportData('zip'); exportMenuOpen=false">
                    <i class="ti ti-package-export" />导出问卷 + 简历
                    <span>ZIP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 批量操作条 -->
          <div v-if="resumeSel.length" style="display:flex;align-items:center;gap:.5rem;padding:.55rem .875rem;background:var(--red-light);border:1px solid var(--red-border);border-radius:var(--r-md);margin-bottom:.875rem;font-size:.8rem;color:var(--red);flex-wrap:wrap">
            已选 {{ resumeSel.length }} 份 &nbsp;·&nbsp;
            <div class="export-dropdown" :class="{open: exportMenuOpen2}">
              <button class="btn btn-secondary btn-sm" @click.stop="exportMenuOpen2=!exportMenuOpen2">
                <i class="ti ti-package-export" />导出所选
                <i class="ti ti-chevron-down" style="font-size:11px;margin-left:2px" />
              </button>
              <div class="export-menu" @click.stop>
                <div class="export-menu-item" @click="exportData('csv'); exportMenuOpen2=false">
                  <i class="ti ti-table-export" />仅导出问卷数据<span>CSV（Excel 可打开）</span>
                </div>
                <div class="export-menu-item" @click="exportData('zip'); exportMenuOpen2=false">
                  <i class="ti ti-package-export" />导出问卷 + 简历<span>ZIP</span>
                </div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" @click="reviewAnswers(true)">全部待审核通过</button>
            <button class="btn btn-secondary btn-sm" @click="reviewAnswers(false)">全部待审核不通过</button>
            <button class="btn btn-secondary btn-sm" @click="resumeSel=[]">取消选择</button>
          </div>

          <div v-if="answersLoading" class="card table-state">投递加载中…</div>
          <div v-else-if="displayAnswerError" class="card table-state" role="alert">
            <div>{{ displayAnswerError }}</div>
            <button class="btn btn-secondary btn-sm" @click="loadAnswers">重新加载</button>
          </div>
          <div v-else-if="!currentJobGroup?.resumes.length" class="card table-state">暂无投递记录</div>
          <div v-else class="card" style="overflow:hidden">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-check">
                    <input type="checkbox"
                      :checked="currentJobGroup?.resumes.length>0 && resumeSel.length===currentJobGroup.resumes.length"
                      @change="e=>resumeSel=e.target.checked?currentJobGroup.resumes.map(r=>r.id):[]" />
                  </th>
                  <th>学生姓名</th>
                  <th>学号</th>
                  <th>投递时间</th>
                  <th>问卷详情</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="r in currentJobGroup?.resumes" :key="r.id">
                  <tr :class="expandedRow===r.id?'row-expanded':''">
                    <td class="col-check">
                      <input type="checkbox"
                        :checked="resumeSel.includes(r.id)"
                        @change="toggleResumeSel(r.id)" />
                    </td>
                    <td style="font-weight:600">
                      <div style="display:flex;align-items:center;gap:.4rem">
                        {{ r.name }}

                      </div>
                    </td>
                    <td style="color:var(--ink-2);font-size:.773rem;font-family:monospace">{{ r.sid }}</td>
                    <td style="color:var(--ink-2);font-size:.8rem">
                      <div>{{ r.date }}</div>
                      <div v-if="r.reviewedAt" style="font-size:.7rem;color:var(--ink-3)">审核于 {{ r.reviewedAt.replace('T', ' ').slice(0, 16) }}</div>
                    </td>
                    <td>
                      <button class="btn btn-ghost btn-sm" style="font-size:.78rem" @click="expandedRow=expandedRow===r.id?null:r.id">
                        <i :class="['ti', expandedRow===r.id?'ti-chevron-up':'ti-chevron-down']" />
                        {{ expandedRow===r.id?'收起':'查看问卷' }}
                      </button>
                    </td>
                    <td>
                      <div class="tbl-acts">
                        <button v-if="r.submissionStatus==='SUBMITTED'" class="btn btn-ghost btn-sm" @click="reviewAnswer(r,true)">通过</button>
                        <button v-if="r.submissionStatus==='SUBMITTED'" class="btn btn-ghost btn-sm" @click="reviewAnswer(r,false)">不通过</button>
                        <span v-else class="badge badge-gray">{{ r.statusLabel || r.submissionStatus }}</span>
                      </div>
                    </td>
                  </tr>
                  <!-- 展开问卷详情 -->
                  <tr v-if="expandedRow===r.id" class="detail-row">
                    <td colspan="6">
                      <div class="questionnaire-detail">
                        <div class="qd-title"><i class="ti ti-clipboard-list" />问卷填写内容</div>
                        <div style="font-size:.78rem;color:var(--ink-2);margin-bottom:.75rem">
                          状态：{{ r.statusLabel || r.submissionStatus }}
                          <template v-if="r.reviewedAt">
                            · 结果：{{ r.reviewPassed ? '通过' : '不通过' }}
                            · 意见：{{ r.reviewComments || '无' }}
                          </template>
                        </div>
                        <div class="qd-grid">
                          <div
                            v-for="qa in parseAnswers(currentJobGroup.questions, r.answers)"
                            :key="qa.id"
                            :class="['qd-item', (qa.questionType==='TEXTAREA'||qa.questionType==='FILE_UPLOAD') ? 'qd-item-wide' : '']"
                          >
                            <div class="qd-q">
                              {{ qa.title }}
                              <span v-if="qa.required" style="color:var(--red);margin-left:2px">*</span>
                            </div>

                            <!-- TEXT：单行文本 -->
                            <div v-if="qa.questionType==='TEXT'" class="qd-a">
                              {{ qa.value ?? '（未作答）' }}
                            </div>

                            <!-- TEXTAREA：多行文本 -->
                            <div v-else-if="qa.questionType==='TEXTAREA'" class="qd-a" style="white-space:pre-wrap">
                              {{ qa.value ?? '（未作答）' }}
                            </div>

                            <!-- RADIO：单选，高亮选中项 -->
                            <div v-else-if="qa.questionType==='RADIO'" style="display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.4rem">
                              <span
                                v-for="opt in qa.options" :key="opt"
                                :class="['qd-option', qa.value===opt ? 'qd-option-selected' : '']"
                              >{{ opt }}</span>
                              <span v-if="!qa.value" style="font-size:.78rem;color:var(--ink-3)">（未作答）</span>
                            </div>

                            <!-- CHECKBOX：多选，高亮选中的 -->
                            <div v-else-if="qa.questionType==='CHECKBOX'" style="display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.4rem">
                              <span
                                v-for="opt in qa.options" :key="opt"
                                :class="['qd-option', qa.value&&qa.value.split(',').map(s=>s.trim()).includes(opt) ? 'qd-option-selected' : '']"
                              >{{ opt }}</span>
                              <span v-if="!qa.value" style="font-size:.78rem;color:var(--ink-3)">（未作答）</span>
                            </div>

                            <!-- FILE_UPLOAD：文件下载链接 -->
                            <div v-else-if="qa.questionType==='FILE_UPLOAD'" style="margin-top:.4rem">
                              <span v-if="qa.value" class="qd-file-link">
                                <i class="ti ti-file-type-pdf" />
                                文件 ID {{ qa.value }}（请通过 ZIP 导出）
                              </span>
                              <span v-else style="font-size:.78rem;color:var(--ink-3)">（未上传）</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div v-if="!answersLoading && !displayAnswerError && currentJobGroup?.resumes.length" class="pagination" style="margin-top:.875rem">
            <span style="font-size:.773rem;color:var(--ink-3);margin-right:auto">共 {{ readAnswerTotal }} 份投递</span>
            <button class="page-btn" :disabled="readAnswerPage<=1" @click="changeAnswerPage(readAnswerPage-1)"><i class="ti ti-chevron-left" /></button>
            <span style="font-size:.773rem;color:var(--ink-3)">第 {{ readAnswerPage }} / {{ readAnswerPages }} 页</span>
            <button class="page-btn" :disabled="readAnswerPage>=readAnswerPages" @click="changeAnswerPage(readAnswerPage+1)"><i class="ti ti-chevron-right" /></button>
            <PageJump :current="readAnswerPage" :total="readAnswerPages" @change="changeAnswerPage" />
          </div>
        </div>

      </main>
    </div>

    <!-- ── 确认弹窗 ── -->
    <div v-if="show_confirm" class="modal-mask" @click.self="cancelConfirm">
      <div class="modal-box">
        <div class="modal-icon"><i class="ti ti-alert-triangle" /></div>
        <div class="modal-msg">{{ confirm_msg }}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" @click="cancelConfirm">取消</button>
          <button class="btn btn-primary btn-sm" @click="doConfirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { apiDownloadBlob, apiForm, apiJson, logoutSession } from '@/lib/api'
import {
  JOB_IMPORT_ENDPOINT,
  JOB_IMPORT_TEMPLATE_PATH,
  normalizeJobImportResult,
  validateJobImportFile,
} from '@/lib/jobImport.mjs'
import PageJump from '@/components/PageJump.vue'

const toast = useToast()
const v     = ref('list')
const sk    = ref('')
const sf    = ref('')
const selected     = ref([])
const draftSelected = ref([])
const displayAdminName = ref('管理员')
const displayAdminInitial = computed(() => displayAdminName.value.trim().charAt(0) || '管')
const adminRole = ref('')
const isSuperAdmin = computed(() => adminRole.value === 'SUPER_ADMIN')
const jobsLoading = ref(true)
const displayJobError = ref('')
const draftsLoading = ref(true)
const displayDraftError = ref('')
const updatingJobs = ref(false)
const savingJob = ref(false)
const rawJobText = ref('')
const structuring = ref(false)
const structuredJobs = ref([])
const structureWarnings = ref([])
const bulkImportInput = ref(null)
const bulkImportFile = ref(null)
const bulkImporting = ref(false)
const bulkDragActive = ref(false)
const bulkImportResult = ref(null)
const JOB_IMPORT_TEMPLATE_URL = `${import.meta.env.BASE_URL}${JOB_IMPORT_TEMPLATE_PATH}`
const displayUsers = ref([])
const searchUsername = ref('')
const searchUserRole = ref('')
const usersLoading = ref(false)
const displayUserError = ref('')
const updatingUserId = ref(null)
const readUserPage = ref(1)
const readUserTotal = ref(0)
const readUserPages = ref(1)
const ROLE_LABEL = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  NORMAL: '普通用户',
}
const ROLE_CLASS = {
  SUPER_ADMIN: 'badge-gold',
  ADMIN: 'badge-red',
  NORMAL: 'badge-gray',
}
const roleLabel = readRole => ROLE_LABEL[readRole] || readRole || '未知角色'
const roleClass = readRole => ROLE_CLASS[readRole] || 'badge-gray'

// 通用确认弹窗
const show_confirm = ref(false)
const confirm_msg  = ref('')
const confirm_cb   = ref(null)
function doConfirm() { confirm_cb.value?.(); show_confirm.value = false }
function cancelConfirm() { show_confirm.value = false }

async function loadUsers() {
  usersLoading.value = true
  displayUserError.value = ''
  try {
    const readParams = new URLSearchParams({
      page:String(readUserPage.value), size:String(readPageSize),
    })
    if (searchUsername.value.trim()) readParams.set('username', searchUsername.value.trim())
    if (searchUserRole.value) readParams.set('role', searchUserRole.value)
    const readPage = await apiJson(`/admin/user/list?${readParams}`)
    const readPages = Math.max(1, Number(readPage?.totalPages || 1))
    if (readUserPage.value > readPages) {
      readUserPage.value = readPages
      return loadUsers()
    }
    displayUsers.value = readPage?.list || []
    readUserTotal.value = Number(readPage?.total || 0)
    readUserPages.value = readPages
  } catch (readError) {
    displayUsers.value = []
    readUserTotal.value = 0
    readUserPages.value = 1
    displayUserError.value = readError?.message || '用户列表加载失败'
  } finally {
    usersLoading.value = false
  }
}

function showUsers() {
  if (!isSuperAdmin.value) return
  v.value = 'users'
  loadUsers()
}

function searchUsers() {
  readUserPage.value = 1
  loadUsers()
}

function changeUserPage(readPage) {
  if (readPage < 1 || readPage > readUserPages.value || readPage === readUserPage.value) return
  readUserPage.value = readPage
  loadUsers()
}

function changeRole(updateUser, updateRole, readEvent) {
  if (readEvent?.target) readEvent.target.value = updateUser.role
  if (!updateRole || updateRole === updateUser.role) return
  confirm_msg.value = `确认将“${updateUser.username || updateUser.studentId}”的权限修改为${roleLabel(updateRole)}？`
  confirm_cb.value = () => updateUserRole(updateUser, updateRole)
  show_confirm.value = true
}

async function updateUserRole(updateUser, updateRole) {
  updatingUserId.value = updateUser.id
  try {
    const readUser = await apiJson(`/admin/user/${updateUser.id}/role?role=${updateRole}`, {
      method:'PUT',
    })
    Object.assign(updateUser, readUser)
    toast.success(`已修改为${roleLabel(updateRole)}`)
  } catch (readError) {
    toast.error(readError?.message || '管理员权限修改失败')
  } finally {
    updatingUserId.value = null
  }
}


const displayJobs = ref([])
const displayDraftJobs = ref([])
const displayRecycleJobs = ref([])
const readPageSize = 20
const readJobPage = ref(1)
const readJobTotal = ref(0)
const readJobPages = ref(1)
const readDraftPage = ref(1)
const readDraftTotal = ref(0)
const readDraftPages = ref(1)
const readRecyclePage = ref(1)
const readRecycleTotal = ref(0)
const readRecyclePages = ref(1)
const recycleLoading = ref(false)
const displayRecycleError = ref('')
const recycleKeyword = ref('')
const STATUS_LABEL = { PUBLISHED:'发布中', OFFLINE:'未发布', EXPIRED:'已截止', RECYCLED:'回收站' }
const STATUS_CLASS = { PUBLISHED:'badge-green', OFFLINE:'badge-gray', EXPIRED:'badge-amber', RECYCLED:'badge-gray' }

function toggleAll(c) { selected.value = c ? displayJobs.value.map(j=>j.id) : [] }
function toggleSel(id) { selected.value.includes(id) ? selected.value = selected.value.filter(i=>i!==id) : selected.value.push(id) }

function mapJob(job) {
  return { ...job, rec: !!job.recommended, apps: Number(job.applicationCount || 0) }
}

function jobPayload(job, status = job.status) {
  const body = {}
  for (const key of Object.keys(NJ_INIT())) {
    if (key === 'questions') continue
    const value = job[key]
    body[key] = value === '' ? null : value
  }
  body.sourceType = job.sourceType || 'PLATFORM'
  body.recommended = job.recommended ?? job.rec ?? false
  body.status = status
  return body
}

async function loadAdmin() {
  try {
    const [readUser, readProfile] = await Promise.all([
      apiJson('/user/me'), apiJson('/user/profile/get'),
    ])
    displayAdminName.value = readProfile?.realName
      || readUser?.username || readUser?.studentId || '管理员'
    adminRole.value = readUser?.role || ''
  } catch {
    displayAdminName.value = '管理员'
    adminRole.value = ''
  }
}

async function loadJobs() {
  jobsLoading.value = true
  displayJobError.value = ''
  try {
    const readParams = new URLSearchParams({
      page:String(readJobPage.value), size:String(readPageSize),
    })
    if (sk.value.trim()) readParams.set('keyword', sk.value.trim())
    if (sf.value === 'RECOMMENDED') {
      readParams.set('status', 'PUBLISHED')
      readParams.set('recommended', 'true')
    } else if (sf.value) readParams.set('status', sf.value)
    const readPage = await apiJson(`/admin/job-post/list?${readParams}`)
    const readPages = Math.max(1, Number(readPage?.totalPages || 1))
    if (readJobPage.value > readPages) {
      readJobPage.value = readPages
      return loadJobs()
    }
    displayJobs.value = (readPage?.list || []).map(mapJob)
    readJobTotal.value = Number(readPage?.total || 0)
    readJobPages.value = readPages
  } catch (error) {
    displayJobs.value = []
    readJobTotal.value = 0
    readJobPages.value = 1
    displayJobError.value = error?.message || '岗位列表加载失败'
  } finally {
    jobsLoading.value = false
  }
}

async function loadDrafts() {
  draftsLoading.value = true
  displayDraftError.value = ''
  try {
    const readPage = await apiJson(
      `/admin/job-post/list?page=${readDraftPage.value}&size=${readPageSize}&status=OFFLINE`)
    const readPages = Math.max(1, Number(readPage?.totalPages || 1))
    if (readDraftPage.value > readPages) {
      readDraftPage.value = readPages
      return loadDrafts()
    }
    displayDraftJobs.value = (readPage?.list || []).map(mapJob)
    readDraftTotal.value = Number(readPage?.total || 0)
    readDraftPages.value = readPages
  } catch (error) {
    displayDraftJobs.value = []
    readDraftTotal.value = 0
    readDraftPages.value = 1
    displayDraftError.value = error?.message || '草稿列表加载失败'
  } finally {
    draftsLoading.value = false
  }
}

async function loadRecycleBin() {
  recycleLoading.value = true
  displayRecycleError.value = ''
  try {
    const readParams = new URLSearchParams({
      page:String(readRecyclePage.value), size:String(readPageSize), status:'RECYCLED',
    })
    if (recycleKeyword.value.trim()) readParams.set('keyword', recycleKeyword.value.trim())
    const readPage = await apiJson(`/admin/job-post/list?${readParams}`)
    const readPages = Math.max(1, Number(readPage?.totalPages || 1))
    if (readRecyclePage.value > readPages) {
      readRecyclePage.value = readPages
      return loadRecycleBin()
    }
    displayRecycleJobs.value = (readPage?.list || []).map(mapJob)
    readRecycleTotal.value = Number(readPage?.total || 0)
    readRecyclePages.value = readPages
  } catch (error) {
    displayRecycleJobs.value = []
    readRecycleTotal.value = 0
    readRecyclePages.value = 1
    displayRecycleError.value = error?.message || '回收站加载失败'
  } finally {
    recycleLoading.value = false
  }
}

async function refreshJobs() {
  await Promise.all([loadJobs(), loadDrafts(), loadRecycleBin()])
}

function searchJobs() {
  readJobPage.value = 1
  selected.value = []
  loadJobs()
}

function showJobs() {
  v.value = 'list'
  loadJobs()
}

function showDrafts() {
  v.value = 'drafts'
  loadDrafts()
}

function showRecycleBin() {
  v.value = 'recycle'
  loadRecycleBin()
}

function searchRecycleBin() {
  readRecyclePage.value = 1
  loadRecycleBin()
}

function changeJobPage(readPage) {
  if (readPage < 1 || readPage > readJobPages.value || readPage === readJobPage.value) return
  readJobPage.value = readPage
  selected.value = []
  loadJobs()
}

function changeDraftPage(readPage) {
  if (readPage < 1 || readPage > readDraftPages.value || readPage === readDraftPage.value) return
  readDraftPage.value = readPage
  draftSelected.value = []
  loadDrafts()
}

function changeRecyclePage(readPage) {
  if (readPage < 1 || readPage > readRecyclePages.value || readPage === readRecyclePage.value) return
  readRecyclePage.value = readPage
  loadRecycleBin()
}

async function restoreJob(job) {
  if (updatingJobs.value) return
  updatingJobs.value = true
  try {
    await apiJson(`/admin/job-post/${job.id}/restore`, { method:'PUT' })
    toast.success('已恢复为草稿')
    await refreshJobs()
  } catch (error) {
    toast.error(error?.message || '恢复失败')
  } finally {
    updatingJobs.value = false
  }
}

async function updateListedJob(job, patch, message) {
  if (updatingJobs.value) return
  updatingJobs.value = true
  try {
    await apiJson(`/admin/job-post/${job.id}`, {
      method: 'PUT',
      body: JSON.stringify(jobPayload({ ...job, ...patch }, patch.status ?? job.status)),
    })
    toast.success(message)
    await refreshJobs()
  } catch (error) {
    toast.error(error?.message || '岗位更新失败')
  } finally {
    updatingJobs.value = false
  }
}

function toggleRec(job) { return updateListedJob(job, { recommended: !job.rec }, job.rec ? '已取消推荐' : '已设为推荐') }
function publish(job) { return updateListedJob(job, { status: 'PUBLISHED' }, '已发布上线') }
function offline(job) { return updateListedJob(job, { status: 'OFFLINE' }, '已停止发布') }

// 批量操作
const publishableCount = computed(() => selected.value.filter(id => displayJobs.value.find(j=>j.id===id)?.status === 'OFFLINE').length)
const offlinableCount  = computed(() => selected.value.filter(id => displayJobs.value.find(j=>j.id===id)?.status === 'PUBLISHED').length)
const recableCount = computed(() => selected.value.filter(id => displayJobs.value.find(j=>j.id===id)?.status === 'PUBLISHED').length)

async function bulkUpdate(filter, patch, message) {
  if (updatingJobs.value) return
  const readJobs = v.value === 'drafts' ? displayDraftJobs.value : displayJobs.value
  const targets = readJobs.filter(job => selected.value.includes(job.id) && filter(job))
  if (!targets.length) return
  updatingJobs.value = true
  try {
    await Promise.all(targets.map(job => apiJson(`/admin/job-post/${job.id}`, {
      method: 'PUT', body: JSON.stringify(jobPayload({ ...job, ...patch }, patch.status ?? job.status)),
    })))
    toast.success(`${message} ${targets.length} 条`)
    selected.value = []
    draftSelected.value = []
    await refreshJobs()
  } catch (error) {
    toast.error(error?.message || '批量操作失败，请刷新后确认结果')
    await refreshJobs()
  } finally {
    updatingJobs.value = false
  }
}
function bulkPublish() { return bulkUpdate(job => job.status === 'OFFLINE', { status: 'PUBLISHED' }, '已发布') }
function bulkRec(on) { return bulkUpdate(job => job.status === 'PUBLISHED', { recommended: on }, on ? '已设为推荐' : '已取消推荐') }
function bulkOffline() { return bulkUpdate(job => job.status === 'PUBLISHED', { status: 'OFFLINE' }, '已停止发布') }
function bulkDelete(ids) {
  const targets = ids ?? selected.value
  const n = targets.length
  confirm_msg.value = `确认将选中的 ${n} 条岗位移入回收站？之后可以恢复。`
  confirm_cb.value = async () => {
    if (updatingJobs.value) return
    updatingJobs.value = true
    try {
      await Promise.all(targets.map(id => apiJson(`/admin/job-post/${id}`, { method: 'DELETE' })))
      toast.success(`已移入回收站 ${n} 条`)
      selected.value = []
      draftSelected.value = []
      await refreshJobs()
    } catch (error) {
      toast.error(error?.message || '删除失败，请刷新后确认结果')
      await refreshJobs()
    } finally {
      updatingJobs.value = false
    }
  }
  show_confirm.value = true
}

// 草稿箱批量操作
function draftToggleAll(c) { draftSelected.value = c ? displayDraftJobs.value.map(j=>j.id) : [] }
function draftToggleSel(id) { draftSelected.value.includes(id) ? draftSelected.value = draftSelected.value.filter(i=>i!==id) : draftSelected.value.push(id) }
function draftBulkPublish() { selected.value = [...draftSelected.value]; return bulkPublish() }
function draftBulkDelete() { bulkDelete([...draftSelected.value]) }

function formatFileSize(bytes) {
  const readBytes = Number(bytes || 0)
  if (readBytes < 1024) return `${readBytes} B`
  if (readBytes < 1024 * 1024) return `${(readBytes / 1024).toFixed(1)} KB`
  return `${(readBytes / 1024 / 1024).toFixed(1)} MB`
}

function selectBulkImportFile(file) {
  const readError = validateJobImportFile(file)
  if (readError) {
    bulkImportFile.value = null
    toast.error(readError)
    return
  }
  bulkImportFile.value = file
}

function handleBulkImportChange(event) {
  selectBulkImportFile(event.target.files?.[0])
  event.target.value = ''
}

function handleBulkImportDrop(event) {
  bulkDragActive.value = false
  selectBulkImportFile(event.dataTransfer?.files?.[0])
}

async function importJobWorkbook() {
  if (!bulkImportFile.value || bulkImporting.value) return
  const readError = validateJobImportFile(bulkImportFile.value)
  if (readError) {
    toast.error(readError)
    return
  }

  bulkImporting.value = true
  bulkImportResult.value = null
  const readForm = new FormData()
  readForm.append('file', bulkImportFile.value)
  try {
    // 后端联调约定：multipart 字段名为 file；解析成功的岗位统一保存为 OFFLINE 草稿。
    const readResult = await apiForm(JOB_IMPORT_ENDPOINT, readForm)
    bulkImportResult.value = normalizeJobImportResult(readResult)
    bulkImportFile.value = null
    readDraftPage.value = 1
    await loadDrafts()
    v.value = 'drafts'
    if (bulkImportResult.value.failedCount > 0) {
      toast.error(`导入完成，${bulkImportResult.value.failedCount} 条记录失败`)
    } else if (bulkImportResult.value.warnings.length > 0) {
      toast.success(`已导入草稿箱，${bulkImportResult.value.warnings.length} 条需复核`)
    } else if (bulkImportResult.value.successCount != null) {
      toast.success(`已导入 ${bulkImportResult.value.successCount} 条岗位到草稿箱`)
    } else {
      toast.success('岗位已导入草稿箱')
    }
  } catch (error) {
    toast.error(error?.message || '岗位批量导入失败，请检查模板后重试')
  } finally {
    bulkImporting.value = false
  }
}

const NJ_INIT = () => ({
  sourceType: 'PLATFORM',
  sourceUrl: '',
  positionName: '', companyName: '', department: '', headcount: null,
  jobCategory: '', jobSubCategory: '',
  recruitType: '', reqEduLevel: '',
  workStartDate: '', workEndDate: '', applicationDeadline: '',
  workProvince: '', workCity: '', workLocation: '',
  workMode: '', workDurationType: '', workDaysPerWeek: null, workPeriodType: '',
  salaryMin: null, salaryMax: null, salaryDisplay: '',
  jobDesc: '', reqMajor: '', reqGradYear: '', reqSkills: '', reqOther: '',
  // 问卷题目（平台内投递时使用）对应 JobPostQuestionRequest[]
  questions: [{
    sortOrder: 1,
    title: '个人简历',
    questionType: 'FILE_UPLOAD',
    options: [],
    required: true,
    placeholder: '',
  }],
})
const isExternal = ref(false)  // 兼容旧引用，不再使用
const deliveryMode = ref('internal')  // 'internal' | 'external'

function addQuestion() {
  nj.value.questions.push({
    sortOrder: nj.value.questions.length + 1,
    title: '',
    questionType: 'TEXT',
    options: [],
    required: false,
    placeholder: '',
  })
}
function moveQ(idx, dir) {
  const qs = nj.value.questions
  const target = idx + dir
  if (target < 0 || target >= qs.length) return
  ;[qs[idx], qs[target]] = [qs[target], qs[idx]]
  qs.forEach((q, i) => { q.sortOrder = i + 1 })
}
const nj = ref(NJ_INIT())
const editingId = ref(null)

async function structureJob() {
  if (!rawJobText.value.trim() || structuring.value) return
  structuring.value = true
  structureWarnings.value = []
  structuredJobs.value = []
  try {
    const result = await apiJson('/admin/job-post/structure', {
      method: 'POST', body: JSON.stringify({ text: rawJobText.value }),
    })
    structuredJobs.value = result?.jobs || []
    structureWarnings.value = result?.warnings || []
    if (structuredJobs.value.length === 1) applyStructuredJob(structuredJobs.value[0])
    else if (!structuredJobs.value.length) toast.error('未识别出有效岗位，请调整原文后重试')
    else toast.success(`识别到 ${structuredJobs.value.length} 个岗位，请选择一个`)
  } catch (error) {
    toast.error(error?.message || '岗位解析失败，请稍后重试')
  } finally {
    structuring.value = false
  }
}

function applyStructuredJob(job) {
  const questions = nj.value.questions
  nj.value = { ...NJ_INIT(), ...job, sourceType: 'PLATFORM', status: 'OFFLINE', questions }
  deliveryMode.value = job.sourceUrl ? 'external' : 'internal'
  structuredJobs.value = []
  toast.success('已填入标准字段，请检查后保存或发布')
}

async function openEdit(job) {
  editingId.value = job.id
  v.value = 'create'
  savingJob.value = true
  try {
    const [detail, questions] = await Promise.all([
      apiJson(`/admin/job-post/${job.id}`),
      apiJson(`/admin/questionnaire/questions/${job.id}`),
    ])
    nj.value = { ...NJ_INIT(), ...detail, questions: questions || [] }
    deliveryMode.value = detail.sourceUrl ? 'external' : 'internal'
  } catch (error) {
    toast.error(error?.message || '岗位详情加载失败')
    v.value = 'list'
    editingId.value = null
  } finally {
    savingJob.value = false
  }
}
function _validate() {
  if (!nj.value.positionName || !nj.value.companyName) { toast.error('请填写岗位名称和公司'); return false }
  if (!nj.value.jobCategory) { toast.error('请选择岗位大类'); return false }
  if (deliveryMode.value === 'external' && !nj.value.sourceUrl) { toast.error('请填写官网投递链接'); return false }
  if (deliveryMode.value === 'internal' && nj.value.questions.some(question => !question.title?.trim())) {
    toast.error('请补全问卷题目标题')
    return false
  }
  return true
}
function _resetForm() {
  nj.value = NJ_INIT()
  editingId.value = null
  isExternal.value = false
  deliveryMode.value = 'internal'
  rawJobText.value = ''
  structuredJobs.value = []
  structureWarnings.value = []
  bulkImportFile.value = null
  bulkDragActive.value = false
}

function startCreate() {
  _resetForm()
  v.value = 'create'
}

async function saveQuestions(jobId) {
  if (deliveryMode.value === 'external' || !nj.value.questions.length) {
    if (editingId.value) await apiJson(`/admin/questionnaire/questions/${jobId}`, { method: 'DELETE' })
    return
  }
  const questions = nj.value.questions.map((question, index) => ({
    sortOrder: index + 1,
    title: question.title.trim(),
    questionType: question.questionType,
    options: (question.options || []).map(option => option.trim()).filter(Boolean),
    required: !!question.required,
    placeholder: question.placeholder || '',
  }))
  await apiJson(`/admin/questionnaire/questions/batch/${jobId}`, {
    method: 'POST', body: JSON.stringify(questions),
  })
}

async function persistJob(targetStatus) {
  if (!_validate()) return
  savingJob.value = true
  let jobId = editingId.value
  try {
    if (!jobId) {
      const created = await apiJson('/admin/job-post', {
        method: 'POST', body: JSON.stringify(jobPayload(nj.value, 'OFFLINE')),
      })
      jobId = created.id
    } else {
      await apiJson(`/admin/job-post/${jobId}`, {
        method: 'PUT', body: JSON.stringify(jobPayload(nj.value, 'OFFLINE')),
      })
    }
    await saveQuestions(jobId)
    if (targetStatus === 'PUBLISHED') {
      await apiJson(`/admin/job-post/${jobId}`, {
        method: 'PUT', body: JSON.stringify(jobPayload(nj.value, 'PUBLISHED')),
      })
    }
    toast.success(targetStatus === 'PUBLISHED' ? '已发布，学生可见' : '已保存为草稿')
    v.value = 'list'
    _resetForm()
    await refreshJobs()
  } catch (error) {
    if (!editingId.value && jobId) editingId.value = jobId
    toast.error(error?.message || '保存失败；新岗位已保留为未发布草稿')
    await refreshJobs()
  } finally {
    savingJob.value = false
  }
}

function saveDraft() { return persistJob('OFFLINE') }

function publishJob() {
  const current = [...displayJobs.value, ...displayDraftJobs.value]
    .find(job => job.id === editingId.value)
  if (current?.status === 'PUBLISHED') {
    confirm_cb.value = () => persistJob('PUBLISHED')
    confirm_msg.value = '该岗位当前已发布，修改将立即对学生生效。确认保存？'
    show_confirm.value = true
    return
  }
  return persistJob('PUBLISHED')
}

// ── 简历管理 ──
const resumeSel     = ref([])
const expandedRow   = ref(null)
const currentJobGroup = ref(null)

const displayResumeJobs = ref([])
const resumeJobsLoading = ref(false)
const displayResumeJobError = ref('')
const readResumeJobPage = ref(1)
const readResumeJobTotal = ref(0)
const readResumeJobPages = ref(1)
const answersLoading = ref(false)
const displayAnswerError = ref('')
const readAnswerPage = ref(1)
const readAnswerTotal = ref(0)
const readAnswerPages = ref(1)
const jobGroups = computed(() => displayResumeJobs.value.map(mapResumeJob))
// 解析 QuestionnaireAnswerResponse.answers JSON → [{...题目字段, value}]
// CHECKBOX value 为逗号分隔字符串，FILE_UPLOAD value 为文件 ID
function parseAnswers(questions, answersJson) {
  try {
    const arr = JSON.parse(answersJson)
    return questions
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(q => ({
        ...q,
        value: arr.find(a => String(a.questionId) === String(q.id))?.value ?? null
      }))
  } catch { return [] }
}

function mapResumeJob(readJob) {
  return {
    jobId:readJob.id,
    title:readJob.positionName,
    company:readJob.companyName,
    dl:(readJob.applicationDeadline || '').slice(5, 10),
    applicationCount:Number(readJob.applicationCount || 0),
    questions:[],
    resumes:[],
  }
}

async function loadResumeJobs() {
  resumeJobsLoading.value = true
  displayResumeJobError.value = ''
  try {
    const readPage = await apiJson(
      `/admin/job-post/list?page=${readResumeJobPage.value}&size=${readPageSize}&status=PUBLISHED&internalApply=true`)
    const readPages = Math.max(1, Number(readPage?.totalPages || 1))
    if (readResumeJobPage.value > readPages) {
      readResumeJobPage.value = readPages
      return loadResumeJobs()
    }
    displayResumeJobs.value = (readPage?.list || []).map(mapJob)
    readResumeJobTotal.value = Number(readPage?.total || 0)
    readResumeJobPages.value = readPages
  } catch (readError) {
    displayResumeJobs.value = []
    readResumeJobTotal.value = 0
    readResumeJobPages.value = 1
    displayResumeJobError.value = readError?.message || '投递岗位加载失败'
  } finally {
    resumeJobsLoading.value = false
  }
}

function showResumes() {
  v.value = 'resumes'
  currentJobGroup.value = null
  resumeSel.value = []
  expandedRow.value = null
  loadResumeJobs()
}

function changeResumeJobPage(readPage) {
  if (readPage < 1 || readPage > readResumeJobPages.value
      || readPage === readResumeJobPage.value) return
  readResumeJobPage.value = readPage
  loadResumeJobs()
}

function mapAnswer(readAnswer) {
  return {
    id:readAnswer.id,
    name:readAnswer.username || '未知学生',
    sid:readAnswer.studentId || '',
    date:(readAnswer.updatedAt || readAnswer.createdAt || '').slice(0, 10),
    answers:readAnswer.answers || '[]',
    submissionStatus:readAnswer.submissionStatus,
    statusLabel:readAnswer.statusLabel || '',
    reviewPassed:readAnswer.reviewPassed,
    reviewComments:readAnswer.reviewComments || '',
    reviewedAt:readAnswer.reviewedAt || '',
  }
}

async function loadAnswers() {
  if (!currentJobGroup.value) return
  answersLoading.value = true
  displayAnswerError.value = ''
  try {
    const readJobId = currentJobGroup.value.jobId
    const [readQuestions, readPage] = await Promise.all([
      apiJson(`/admin/questionnaire/questions/${readJobId}`),
      apiJson(`/admin/questionnaire/answers/job/${readJobId}?page=${readAnswerPage.value}&size=${readPageSize}`),
    ])
    const readPages = Math.max(1, Number(readPage?.totalPages || 1))
    if (readAnswerPage.value > readPages) {
      readAnswerPage.value = readPages
      return loadAnswers()
    }
    currentJobGroup.value = {
      ...currentJobGroup.value,
      questions:readQuestions || [],
      resumes:(readPage?.list || []).map(mapAnswer),
    }
    readAnswerTotal.value = Number(readPage?.total || 0)
    readAnswerPages.value = readPages
  } catch (readError) {
    currentJobGroup.value = { ...currentJobGroup.value, questions:[], resumes:[] }
    readAnswerTotal.value = 0
    readAnswerPages.value = 1
    displayAnswerError.value = readError?.message || '投递记录加载失败'
  } finally {
    answersLoading.value = false
  }
}

function openJobResumes(readGroup) {
  currentJobGroup.value = { ...readGroup, questions:[], resumes:[] }
  readAnswerPage.value = 1
  resumeSel.value = []
  expandedRow.value = null
  v.value = 'resumeDetail'
  loadAnswers()
}

function goJobResumes(readJob) {
  openJobResumes(mapResumeJob(readJob))
}

function changeAnswerPage(readPage) {
  if (readPage < 1 || readPage > readAnswerPages.value || readPage === readAnswerPage.value) return
  readAnswerPage.value = readPage
  resumeSel.value = []
  expandedRow.value = null
  loadAnswers()
}

function toggleResumeSel(readId) {
  resumeSel.value.includes(readId)
    ? resumeSel.value = resumeSel.value.filter(readValue => readValue !== readId)
    : resumeSel.value.push(readId)
}

const exportMenuOpen  = ref(false)
const exportMenuOpen2 = ref(false)

async function reviewAnswer(updateAnswer, updatePassed) {
  const updateComments = window.prompt('请输入审核意见', updatePassed ? '审核通过' : '审核未通过')
  if (!updateComments) return
  try {
    const readAnswer = await apiJson(`/admin/questionnaire/answers/${updateAnswer.id}/review`, {
      method:'PUT', body:JSON.stringify({ passed:updatePassed, comments:updateComments }),
    })
    Object.assign(updateAnswer, mapAnswer(readAnswer))
    toast.success('审核完成')
  } catch (readError) {
    toast.error(readError?.message || '审核失败')
  }
}

async function reviewAnswers(updatePassed) {
  if (!currentJobGroup.value) return
  const updateComments = window.prompt('请输入批量审核意见', updatePassed ? '批量审核通过' : '批量审核未通过')
  if (!updateComments) return
  try {
    const readCount = await apiJson(
      `/admin/questionnaire/answers/job/${currentJobGroup.value.jobId}/review-batch`, {
        method:'PUT', body:JSON.stringify({ passed:updatePassed, comments:updateComments }),
      })
    await loadAnswers()
    toast.success(`已审核 ${readCount} 条投递`)
  } catch (readError) {
    toast.error(readError?.message || '批量审核失败')
  }
}

onMounted(() => {
  loadAdmin()
  loadJobs()
  loadDrafts()
  loadRecycleBin()
  window.addEventListener('click', () => {
    exportMenuOpen.value = false
    exportMenuOpen2.value = false
  })
})

async function exportData(readFormat) {
  if (!currentJobGroup.value) return
  const readParams = new URLSearchParams({ format:readFormat })
  resumeSel.value.forEach(readId => readParams.append('answerIds', readId))
  try {
    const readBlob = await apiDownloadBlob(
      `/admin/questionnaire/answers/job/${currentJobGroup.value.jobId}/export?${readParams}`)
    const readUrl = URL.createObjectURL(readBlob)
    const createLink = document.createElement('a')
    createLink.href = readUrl
    createLink.download = `applications-${currentJobGroup.value.jobId}.${readFormat}`
    createLink.click()
    URL.revokeObjectURL(readUrl)
    resumeSel.value = []
  } catch (readError) {
    toast.error(readError?.message || '导出失败')
  }
}
</script>

<style scoped>
.action-disabled {
  cursor: wait;
  opacity: .6;
  pointer-events: none;
}
.role-select {
  width: 128px;
  min-height: 30px;
  padding: .3rem 1.7rem .3rem .6rem;
  font-size: .75rem;
}
.table-state {
  padding: 2.5rem !important;
  text-align: center;
  color: var(--ink-3);
}
.table-state .btn { margin-top: .75rem; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── 新建岗位入口：智能解析 + 表格批量导入 ── */
.create-entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}
.create-entry-card { min-width: 0; }
.create-entry-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  flex-wrap: wrap;
  margin-top: .875rem;
}
.create-entry-hint { font-size: .75rem; color: var(--ink-3); }
.structure-warning {
  margin-top: .75rem;
  padding: .65rem .8rem;
  border-radius: var(--r-md);
  background: var(--amber-bg);
  color: var(--amber);
  font-size: .76rem;
}
.bulk-import-intro {
  display: grid;
  gap: .4rem;
  color: var(--ink-2);
  font-size: .78rem;
  margin-bottom: .75rem;
}
.bulk-import-intro div { display: flex; align-items: center; gap: .45rem; }
.bulk-import-intro span {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--gold-light);
  color: var(--gold);
  font-size: .68rem;
  font-weight: 700;
}
.bulk-template-link { margin-bottom: .75rem; }
.bulk-upload-zone {
  width: 100%;
  min-height: 140px;
  padding: 1rem;
  border: 1.5px dashed var(--border-mid);
  border-radius: var(--r-lg);
  background: var(--bg-soft);
  color: var(--ink-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .4rem;
  text-align: center;
  transition: border-color var(--t), background var(--t), color var(--t);
}
.bulk-upload-zone:hover,
.bulk-upload-zone:focus-visible,
.bulk-upload-zone.dragging {
  outline: none;
  border-color: var(--gold);
  background: var(--gold-light);
}
.bulk-upload-zone.has-file { border-style: solid; border-color: var(--gold); background: var(--gold-light); }
.bulk-upload-zone:disabled { cursor: wait; opacity: .7; }
.bulk-upload-zone > i { font-size: 1.75rem; color: var(--gold); }
.bulk-upload-zone strong { font-size: .84rem; font-weight: 600; max-width: 100%; overflow-wrap: anywhere; }
.bulk-upload-zone span { font-size: .73rem; color: var(--ink-3); }
.bulk-upload-zone .ti-loader-2,
.create-entry-actions .ti-loader-2 { animation: import-spin .8s linear infinite; }
@keyframes import-spin { to { transform: rotate(360deg); } }

.bulk-import-result {
  display: flex;
  align-items: flex-start;
  gap: .75rem;
  padding: .8rem 1rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(30, 102, 54, .25);
  border-radius: var(--r-md);
  background: var(--green-bg);
  color: var(--green);
  font-size: .78rem;
}
.bulk-import-result > i { font-size: 1.2rem; margin-top: .1rem; }
.bulk-import-result strong { display: block; margin-bottom: .15rem; font-size: .82rem; }
.bulk-import-result ul { margin-top: .45rem; padding-left: 1rem; list-style: disc; color: var(--ink-2); }
.bulk-import-warnings { margin-top: .55rem; color: var(--amber); }
.bulk-import-warnings ul { margin-top: .25rem; }
.bulk-import-result.has-warnings { border-color: rgba(122, 79, 0, .25); background: var(--amber-bg); color: var(--amber); }
.bulk-import-result .btn-icon { margin-left: auto; flex-shrink: 0; }

@media (max-width: 1050px) {
  .create-entry-grid { grid-template-columns: 1fr; }
}

/* ── PDF 预览弹窗 ── */
.preview-box {
  background: var(--bg-card);
  border-radius: var(--r-lg);
  width: min(860px, 92vw);
  height: min(90vh, 900px);
  display: flex; flex-direction: column;
  box-shadow: 0 16px 48px rgba(28,26,24,.2);
  overflow: hidden;
  animation: slideUp .2s ease;
}
.preview-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: .75rem 1rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.preview-iframe {
  flex: 1; width: 100%; border: none;
  background: #f5f5f5;
}

/* ── 导出下拉菜单 ── */
.export-dropdown { position: relative; }
.export-menu {
  position: absolute; top: calc(100% + 6px); right: 0;
  background: var(--bg-card); border: 1px solid var(--border-mid);
  border-radius: var(--r-md); box-shadow: 0 8px 24px rgba(28,26,24,.12);
  min-width: 180px; z-index: 50; overflow: hidden;
  opacity: 0; transform: translateY(-6px); pointer-events: none;
  transition: opacity .15s, transform .15s;
}
.export-dropdown.open .export-menu { opacity: 1; transform: none; pointer-events: auto; }
.export-menu-item {
  display: flex; align-items: center; gap: .5rem;
  padding: .6rem .9rem; font-size: .8rem; color: var(--ink-2);
  cursor: pointer; transition: background var(--t);
}
.export-menu-item:hover { background: var(--bg-soft); color: var(--ink); }
.export-menu-item i { font-size: 14px; color: var(--ink-3); flex-shrink: 0; }
.export-menu-item span {
  margin-left: auto; font-size: .7rem; color: var(--ink-3);
  background: var(--bg-sunken); padding: 1px 5px; border-radius: var(--r-sm);
}
.export-menu-divider { height: 1px; background: var(--border); margin: 3px 0; }

/* ── 投递模式切换 ── */
.mode-btn {
  flex: 1; display: flex; align-items: center; gap: .75rem;
  padding: .875rem 1rem; border-radius: var(--r-md);
  border: 1.5px solid var(--border-mid); cursor: pointer;
  transition: all var(--t); background: var(--bg-card);
}
.mode-btn:hover { border-color: var(--red-border); background: var(--red-light); }
.mode-btn.active { border-color: var(--red); background: var(--red-light); }
.mode-btn i { font-size: 1.3rem; color: var(--ink-3); flex-shrink: 0; }
.mode-btn.active i { color: var(--red); }

/* ── 问卷题目卡片 ── */
.q-card {
  border: 1px solid var(--border); border-radius: var(--r-md);
  padding: .875rem 1rem; margin-bottom: .6rem;
  background: var(--bg-soft);
}
.q-card-head { display: flex; align-items: center; gap: .6rem; }
.q-index {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--red-light); color: var(--red);
  font-size: .72rem; font-weight: 700; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.icon-btn.danger:hover { border-color: #e53e3e; color: #e53e3e; background: #fff5f5; }

/* ── 表单分节标题 ── */
.form-section-title {
  font-size: .8rem;
  font-weight: 600;
  color: var(--ink-3);
  letter-spacing: .06em;
  text-transform: uppercase;
  margin-bottom: .875rem;
  padding-bottom: .6rem;
  border-bottom: 1px solid var(--border);
}

/* ── 操作按钮 tooltip ── */
.tbl-btn { position: relative; }
.tbl-tip {
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(28,26,24,.78);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
  padding: 3px 7px;
  border-radius: var(--r-sm);
  pointer-events: none;
  opacity: 0;
  transition: opacity .15s;
}
.tbl-btn:hover .tbl-tip { opacity: 1; }

/* ── Navbar 分栏对齐 ── */
/* brand 列宽度 = sidebar 宽度，让品牌 logo 和下方 sidebar 左对齐 */
.navbar-brand-col {
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 18px;
  border-right: 1px solid var(--border);
}
/* main 列撑满剩余宽度，右侧 padding 与 admin-main 一致 */
.navbar-main-col {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 2rem;
}

/* ── 简历管理：岗位列表行 ── */
.jrc-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: .9rem 1.25rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t);
}
.jrc-row:last-child { border-bottom: none; }
.jrc-row:hover { background: var(--bg-soft); }

.jrc-row-icon {
  width: 2rem; height: 2rem; border-radius: var(--r-sm);
  background: var(--red-light); color: var(--red);
  display: flex; align-items: center; justify-content: center;
  font-size: .95rem; flex-shrink: 0;
}
.jrc-row-main { flex: 1; min-width: 0; }
.jrc-row-title { font-weight: 600; font-size: .86rem; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jrc-row-sub { font-size: .75rem; color: var(--ink-3); margin-top: .1rem; }
.jrc-row-meta { display: flex; align-items: center; gap: .5rem; flex-shrink: 0; }
.jrc-row-count { display: flex; flex-direction: column; align-items: center; min-width: 3rem; flex-shrink: 0; }
.jrc-count-num { font-family: 'Noto Serif SC', serif; font-weight: 700; font-size: 1.3rem; color: var(--ink); line-height: 1; }
.jrc-count-label { font-size: .68rem; color: var(--ink-3); margin-top: .15rem; }

/* ── 确认弹窗 ── */
.modal-mask {
  position: fixed; inset: 0;
  background: rgba(28,26,24,.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 999;
}
.modal-box {
  background: var(--bg-card);
  border-radius: var(--r-xl);
  padding: 2rem 2rem 1.5rem;
  width: 360px;
  box-shadow: 0 8px 32px rgba(28,26,24,.18);
  display: flex; flex-direction: column; align-items: center; gap: 1rem;
  animation: slideUp .2s ease;
}
@keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
.modal-icon { font-size: 2rem; color: var(--amber); line-height: 1 }
.modal-msg { font-size: .86rem; color: var(--ink-2); text-align: center; line-height: 1.6 }
.modal-actions { display:flex; gap:.5rem; justify-content:center; width:100% }

/* ── 问卷详情展开行 ── */
.row-expanded > td { background: var(--red-light) !important; }

.detail-row > td {
  padding: 0 !important;
  border-bottom: 2px solid var(--red-border) !important;
}

.revised-badge {
  font-size: .67rem;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 999px;
  padding: .1rem .45rem;
  white-space: nowrap;
}
.questionnaire-detail {
  padding: 1.1rem 1.4rem;
  background: var(--surface);
  border-top: 1px dashed var(--border-mid);
}
.qd-title {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .83rem;
  font-weight: 600;
  color: var(--red);
  margin-bottom: .85rem;
}
.qd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: .75rem;
}
.qd-item {
  background: var(--bg);
  border: 1px solid var(--border-mid);
  border-radius: var(--r-md);
  padding: .7rem .875rem;
}
.qd-item-wide { grid-column: 1 / -1; }
.qd-option {
  display: inline-flex; align-items: center;
  padding: .2rem .6rem; border-radius: var(--r-full);
  font-size: .75rem; border: 1px solid var(--border-mid);
  color: var(--ink-3); background: var(--bg-card);
}
.qd-option-selected {
  background: var(--red-light); color: var(--red);
  border-color: var(--red-border); font-weight: 600;
}
.qd-file-link {
  display: inline-flex; align-items: center; gap: .35rem;
  font-size: .8rem; color: var(--red); text-decoration: none;
  padding: .3rem .7rem; border-radius: var(--r-sm);
  border: 1px solid var(--red-border); background: var(--red-light);
  transition: background var(--t);
}
.qd-file-link:hover { background: var(--red); color: #fff; }

.qd-q {
  font-size: .75rem;
  font-weight: 600;
  color: var(--ink-2);
  margin-bottom: .35rem;
}
.qd-a {
  font-size: .82rem;
  color: var(--ink);
  line-height: 1.55;
}
</style>
