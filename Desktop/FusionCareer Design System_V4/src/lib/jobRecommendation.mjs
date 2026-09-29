import { readJson } from '@/lib/api'

export const JOB_RECOMMENDATION_ENDPOINT = '/job/recommend'

export const INTENTION_OPTIONS = [
  { value:'MEDIA', label:'新闻媒体' },
  { value:'ENTERPRISE', label:'企业公司' },
  { value:'GOVERNMENT', label:'党政机关' },
  { value:'ACADEMIC', label:'学术教职' },
  { value:'OTHER', label:'其他方向' },
]

export const CITY_GROUPS = [
  { province:'不限', cities:['不限城市'] },
  { province:'直辖市', cities:['北京', '上海', '天津', '重庆'] },
  { province:'江苏', cities:['南京', '苏州', '无锡', '南通', '常州', '扬州', '徐州', '盐城', '泰州', '镇江', '宿迁', '淮安', '连云港'] },
  { province:'浙江', cities:['杭州', '宁波', '温州', '绍兴', '嘉兴', '金华', '台州', '舟山', '湖州', '衢州', '丽水'] },
  { province:'安徽', cities:['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '铜陵', '安庆', '黄山', '阜阳', '宿州'] },
  { province:'福建', cities:['福州', '厦门', '泉州', '漳州', '莆田', '三明', '南平', '龙岩', '宁德'] },
  { province:'山东', cities:['济南', '青岛', '烟台', '潍坊', '济宁', '临沂', '淄博', '菏泽', '威海', '东营', '滨州'] },
  { province:'河北', cities:['石家庄', '唐山', '保定', '邯郸', '沧州', '廊坊', '张家口', '承德', '秦皇岛'] },
  { province:'山西', cities:['太原', '大同', '运城', '临汾', '长治', '晋城'] },
  { province:'内蒙古', cities:['呼和浩特', '包头', '鄂尔多斯', '赤峰'] },
  { province:'广东', cities:['广州', '深圳', '东莞', '佛山', '珠海', '惠州', '中山', '汕头', '江门', '湛江', '茂名'] },
  { province:'广西', cities:['南宁', '桂林', '柳州', '梧州', '北海'] },
  { province:'海南', cities:['海口', '三亚', '儋州'] },
  { province:'湖北', cities:['武汉', '宜昌', '襄阳', '黄石', '荆州', '十堰'] },
  { province:'湖南', cities:['长沙', '株洲', '湘潭', '衡阳', '常德', '郴州', '岳阳'] },
  { province:'河南', cities:['郑州', '洛阳', '开封', '南阳', '许昌', '新乡', '焦作', '安阳'] },
  { province:'江西', cities:['南昌', '赣州', '九江', '上饶', '吉安', '宜春'] },
  { province:'四川', cities:['成都', '绵阳', '德阳', '南充', '宜宾', '达州', '乐山', '泸州'] },
  { province:'云南', cities:['昆明', '大理', '丽江', '曲靖', '玉溪', '西双版纳'] },
  { province:'贵州', cities:['贵阳', '遵义', '六盘水', '安顺'] },
  { province:'西藏', cities:['拉萨', '日喀则', '昌都'] },
  { province:'陕西', cities:['西安', '咸阳', '宝鸡', '渭南', '汉中', '延安'] },
  { province:'甘肃', cities:['兰州', '天水', '白银', '酒泉', '张掖'] },
  { province:'新疆', cities:['乌鲁木齐', '喀什', '伊宁', '库尔勒'] },
  { province:'青海', cities:['西宁', '海东'] },
  { province:'宁夏', cities:['银川', '石嘴山', '吴忠'] },
  { province:'辽宁', cities:['沈阳', '大连', '鞍山', '抚顺', '锦州', '盘锦'] },
  { province:'吉林', cities:['长春', '吉林市', '四平', '延吉'] },
  { province:'黑龙江', cities:['哈尔滨', '齐齐哈尔', '牡丹江', '大庆', '佳木斯'] },
]

export function normalizeRecommendedJobs(readValue) {
  const list = Array.isArray(readValue)
    ? readValue
    : readValue?.list || readValue?.jobs || readValue?.recommendations || []
  return list.map(item => ({
    ...item,
    id:item.id ?? item.jobId ?? item.jobPostId,
    positionName:item.positionName || item.title || '未命名岗位',
    companyName:item.companyName || item.company || '',
    workCity:item.workCity || item.city || '',
    matchScore:item.matchScore ?? item.score ?? null,
    recommendationReason:item.recommendationReason || item.reason || '',
  })).filter(item => item.id != null)
}

export async function requestJobRecommendations(intentions, cities) {
  const readResult = await readJson(JOB_RECOMMENDATION_ENDPOINT, {
    method:'POST',
    body:JSON.stringify({
      intentions,
      cities:cities.includes('不限城市') ? [] : cities,
    }),
  })
  return normalizeRecommendedJobs(readResult)
}
