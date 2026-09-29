export const ANY_PREFERENCE = '都可以'

function leafOptions(readLabels) {
  return readLabels.map(readLabel => (
    typeof readLabel === 'string' ? { label: readLabel } : readLabel
  ))
}

export const JOB_INTENTION_OPTIONS = [
  { label: ANY_PREFERENCE },
  {
    label: '学术教职',
    children: [
      {
        label: '升学深造',
        children: leafOptions(['保研', '考研', '硕博连读', '考博', '出国（境）留学']),
      },
      {
        label: '考取教职',
        children: leafOptions(['博士后', '高校教师', '中学教师', '小学教师', '机构教师']),
      },
    ],
  },
  {
    label: '党政机关',
    children: [
      {
        label: '选调生',
        children: leafOptions(['央选', '省直', '市直', '基层（县/乡镇/街道）']),
      },
      {
        label: '公务员',
        children: leafOptions(['部委', '省直', '市直', '基层（县/乡镇/街道）']),
      },
      {
        label: '高校行政',
        children: leafOptions(['专职辅导员', '管理岗', '其他']),
      },
      ...['医院', '银行', '国际组织', '其他事业单位'].map(readLabel => ({
        label: readLabel,
        children: leafOptions(['综合管理岗', '宣传岗', '其他']),
      })),
    ],
  },
  {
    label: '新闻媒体',
    children: [
      ...['党报央媒', '地区主流媒体', '其他媒体机构'].map(readLabel => ({
        label: readLabel,
        children: leafOptions([
          {
            label: '传媒业务岗',
            description: '记者、编辑、编导、策划、运营、制片、主持人等',
          },
          '综合管理岗',
          '其他',
        ]),
      })),
      { label: '自媒体' },
    ],
  },
  {
    label: '企业公司',
    children: [
      {
        label: '国央企',
        children: leafOptions(['宣传岗', '行政岗', '运营岗', '市场岗', '产品岗', '技术岗', '其他']),
      },
      {
        label: '民企（按行业细分）',
        children: leafOptions([
          '互联网科技类', '金融/咨询类', '快消/零售类', '广告/公关/传媒类',
          '房地产/建筑类', '先进制造/汽车类', '生物医药/大健康类', '其他行业',
        ]),
      },
      {
        label: '外企',
        children: leafOptions(['宣传岗', '行政岗', '运营岗', '市场岗', '产品岗', '技术岗', '其他']),
      },
    ],
  },
]

export const REGION_CITY_MAP = {
  上海: ['上海'],
  江苏: ['南京', '苏州', '无锡', '南通', '常州', '扬州', '徐州', '盐城', '泰州', '镇江', '宿迁', '淮安', '连云港'],
  浙江: ['杭州', '宁波', '温州', '绍兴', '嘉兴', '金华', '台州', '舟山', '湖州', '衢州', '丽水'],
  安徽: ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '铜陵', '安庆', '黄山', '阜阳', '宿州'],
  福建: ['福州', '厦门', '泉州', '漳州', '莆田', '三明', '南平', '龙岩', '宁德'],
  山东: ['济南', '青岛', '烟台', '潍坊', '济宁', '临沂', '淄博', '菏泽', '威海', '东营', '滨州'],
  北京: ['北京'],
  天津: ['天津'],
  河北: ['石家庄', '唐山', '保定', '邯郸', '沧州', '廊坊', '张家口', '承德', '秦皇岛'],
  山西: ['太原', '大同', '运城', '临汾', '长治', '晋城'],
  内蒙古: ['呼和浩特', '包头', '鄂尔多斯', '赤峰'],
  广东: ['广州', '深圳', '东莞', '佛山', '珠海', '惠州', '中山', '汕头', '江门', '湛江', '茂名'],
  广西: ['南宁', '桂林', '柳州', '梧州', '北海'],
  海南: ['海口', '三亚', '儋州'],
  湖北: ['武汉', '宜昌', '襄阳', '黄石', '荆州', '十堰'],
  湖南: ['长沙', '株洲', '湘潭', '衡阳', '常德', '郴州', '岳阳'],
  河南: ['郑州', '洛阳', '开封', '南阳', '许昌', '新乡', '焦作', '安阳'],
  江西: ['南昌', '赣州', '九江', '上饶', '吉安', '宜春'],
  四川: ['成都', '绵阳', '德阳', '南充', '宜宾', '达州', '乐山', '泸州'],
  重庆: ['重庆'],
  云南: ['昆明', '大理', '丽江', '曲靖', '玉溪', '西双版纳'],
  贵州: ['贵阳', '遵义', '六盘水', '安顺'],
  西藏: ['拉萨', '日喀则', '昌都'],
  陕西: ['西安', '咸阳', '宝鸡', '渭南', '汉中', '延安'],
  甘肃: ['兰州', '天水', '白银', '酒泉', '张掖'],
  新疆: ['乌鲁木齐', '喀什', '伊宁', '库尔勒'],
  青海: ['西宁', '海东'],
  宁夏: ['银川', '石嘴山', '吴忠'],
  辽宁: ['沈阳', '大连', '鞍山', '抚顺', '锦州', '盘锦'],
  吉林: ['长春', '吉林市', '四平', '延吉'],
  黑龙江: ['哈尔滨', '齐齐哈尔', '牡丹江', '大庆', '佳木斯'],
  香港: ['香港'],
  澳门: ['澳门'],
  台湾: ['台北', '新北', '桃园', '台中', '台南', '高雄'],
}

export const CITY_INTENTION_OPTIONS = [
  { label: ANY_PREFERENCE },
  ...Object.entries(REGION_CITY_MAP).map(([readProvince, readCities]) => {
    if (readCities.length === 1 && readCities[0] === readProvince) return { label: readProvince }
    return { label: readProvince, children: leafOptions(readCities) }
  }),
]

export function preferencePathValue(readPath) {
  return readPath.filter(Boolean).join('-')
}

export function normalizePreferenceList(readValue) {
  const readList = Array.isArray(readValue) ? readValue : []
  const updateList = [...new Set(readList
    .map(readItem => String(readItem || '').trim())
    .filter(Boolean))]
  return updateList.includes(ANY_PREFERENCE) ? [ANY_PREFERENCE] : updateList
}

export function parsePreferenceList(readValue) {
  if (Array.isArray(readValue)) return normalizePreferenceList(readValue)
  if (readValue == null || readValue === '') return []

  const readText = String(readValue).trim()
  if (!readText) return []
  if (readText.startsWith('[')) {
    try {
      const readParsed = JSON.parse(readText)
      if (Array.isArray(readParsed)) return normalizePreferenceList(readParsed)
    } catch { /* fall through to legacy delimiter parsing */ }
  }

  return normalizePreferenceList(readText.split(/[,，、;；\n]+/))
}

export function serializeJobIntentions(readValue) {
  return normalizePreferenceList(readValue).join(',')
}

export function serializeCityIntentions(readValue) {
  return JSON.stringify(normalizePreferenceList(readValue))
}

export function collectPreferencePaths(readOptions, readParent = []) {
  return (readOptions || []).flatMap(readOption => {
    const readPath = [...readParent, readOption.label]
    return [
      preferencePathValue(readPath),
      ...collectPreferencePaths(readOption.children, readPath),
    ]
  })
}
