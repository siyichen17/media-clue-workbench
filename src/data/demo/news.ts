import { MEDIA, PLATFORMS, TOPICS, topicById } from './catalog.ts'
import { addDays, DATA_AS_OF, DATA_START, formatChineseDay } from '../../lib/dates.ts'
import type { NewsItem } from '../../types/domain.ts'

interface EventSeed {
  id: string
  topicId: string
  name: string
  place: string
  figure: string
  summary: string
  headlines: [string, string, string]
  paragraphs: [string, string, string]
  count: number
  hours: number[]
}

const EVENTS: EventSeed[] = [
  {
    id: 'e01',
    topicId: 't01',
    name: '淮州至洛带载人航线首飞',
    place: '成都金堂淮州机场',
    figure: '首飞搭载 6 名乘客，航程约 28 公里',
    summary: '首条载人试点航线完成往返，起降窗口和乘客核验被分开记录。',
    headlines: ['淮州至洛带载人航线完成首飞', '低空航线首飞日的起降窗口', '乘客核验与航线首飞同时公布'],
    paragraphs: [
      '上午的试飞没有安排观礼人群。地面人员先核对空域释放时间，再按座位引导 6 名乘客登机，往返航程约 28 公里，降落后再补做一次设备检查。',
      '运营方把这次首飞拆成申请、放行、飞行和复盘四段，并留下每段的完成时间。负责空域的人员说，能否复制到下一班，要看同一窗口里有没有临时限制。',
      '现场没有公布票价。工作人员只确认，试飞乘客来自已报名的体验名单，常规售票仍要等后续班次计划。金堂到洛带的地面车程通常超过一小时，空中航线被用来对照这段距离。',
    ],
    count: 12,
    hours: [9, 10, 11, 15, 16],
  },
  {
    id: 'e02',
    topicId: 't01',
    name: '试点空域阶段性批复',
    place: '成都东部新区',
    figure: '阶段性批复空域约 120 平方公里',
    summary: '东部新区一段约 120 平方公里的空域获得阶段性批复，用途限定在试航和训练。',
    headlines: ['东部新区试点空域获阶段性批复', '120 平方公里空域只用于试航训练', '低空空域批复写明使用边界'],
    paragraphs: [
      '批复文本把可用空域写在东部新区一组坐标内，面积约 120 平方公里，并注明当前只服务试航和训练，不直接等于开放经营。',
      '申请方需要按批次提交机型、飞行员和起降点。窗口期外的飞行仍要单独报批，不能用这次批复代替临时申请。',
      '邻近乡镇拿到的说明只有一张范围示意图。村组干部更关心噪声和临时禁飞怎么通知，文件里把告知责任写给了运营单位。',
    ],
    count: 8,
    hours: [9, 10, 14, 15],
  },
  {
    id: 'e03',
    topicId: 't01',
    name: '低空经济供需对接会',
    place: '成都科创生态岛',
    figure: '会上发布 18 条航线需求',
    summary: '对接会现场列出 18 条航线需求，医疗转运和城际通勤被分开登记。',
    headlines: ['对接会列出 18 条航线需求', '低空供需会上的通勤与医疗清单', '航线需求登记没有直接签约'],
    paragraphs: [
      '对接会使用了一份公开需求表，18 条航线按医疗转运、商务通勤和文旅观光分类。表上有起降设想，没有承诺开通日期。',
      '医院代表关心的是样本和急救设备能不能进舱，通勤需求则集中在高峰时段的地面耗时。两类问题被记在不同栏目，避免合成一个笼统结论。',
      '会后只交换了联系人和补充材料清单。组织者说，进入评审的航线还要再核空域、机型和地面保障，这次会议本身不是签约仪式。',
    ],
    count: 8,
    hours: [10, 11, 15, 16],
  },
  {
    id: 'e04',
    topicId: 't02',
    name: '医院检验样本无人机配送',
    place: '成都高新区',
    figure: '单程由约 70 分钟缩短到 18 分钟',
    summary: '两家医院之间的检验样本改走无人机，单程用时从约 70 分钟减到 18 分钟。',
    headlines: ['检验样本无人机配送跑通单程', '样本运送改走空中后的交接记录', '医院无人机配送只覆盖检验样本'],
    paragraphs: [
      '样本箱从门诊检验科封签后送到楼顶起降点，无人机单程约 18 分钟。同一路线的地面转运此前大约需要 70 分钟，且高峰期更不稳定。',
      '接收医院按封签号核对温度和开箱时间。这次试点不运送急诊病人，只覆盖已经打包的检验样本，班次也只排在白天。',
      '配送日志保留了起飞、到达和签收三个时间。院方说，若天气或空域临时关闭，样本会立刻改回地面车辆，不会在楼顶等待。',
    ],
    count: 8,
    hours: [8, 9, 11, 14, 16],
  },
  {
    id: 'e05',
    topicId: 't02',
    name: '山区寄递航线试运行',
    place: '雅安芦山',
    figure: '每周 4 个班次，覆盖 11 个乡镇',
    summary: '芦山一段山区寄递航线每周飞 4 个班次，对应 11 个乡镇的固定集散点。',
    headlines: ['芦山山区寄递航线按周飞行', '11 个乡镇接入固定集散点', '山区寄递先飞信件和轻小包裹'],
    paragraphs: [
      '航线从县城集散点飞往 11 个乡镇的固定降落点，每周 4 个班次。邮件在起飞前完成称重，超重件仍走公路。',
      '乡镇点只接收信件和轻小包裹，现场用纸质签收表备份电子记录。遇到低云或大风，班次会顺延到下一飞行日，不临时改点。',
      '当地邮政把这条航线当作公路中断时的补充，而不是替代全部班车。试运行阶段不承诺当日达，只公布计划飞行日。',
    ],
    count: 6,
    hours: [9, 10, 15],
  },
  {
    id: 'e06',
    topicId: 't03',
    name: '周五地铁末班延长',
    place: '成都地铁',
    figure: '1、2、3 号线周五末班延长 60 分钟',
    summary: '1、2、3 号线在周五把末班车延长 60 分钟，其余日期维持原时刻。',
    headlines: ['三条地铁线路周五末班延长一小时', '地铁末班调整只覆盖周五', '延长末班后的站台值班安排'],
    paragraphs: [
      '时刻表调整只出现在周五：1 号线、2 号线和 3 号线末班车各延长 60 分钟。周六到周四仍按原时刻收车。',
      '车站在延长时段保留站台值班和安检，末班后的清站时间相应后移。运营方提醒乘客以车站当日公告为准，不把试运行当成永久改点。',
      '延长的直接原因是周五夜间换乘和活动散场叠加。公司没有同时调整首班车，白天行车间隔也保持不变。',
    ],
    count: 12,
    hours: [7, 8, 12, 18, 21],
  },
  {
    id: 'e07',
    topicId: 't03',
    name: '换乘站夜间客流观察',
    place: '成都火车南站',
    figure: '延长时段进站约 2.3 万人次',
    summary: '火车南站在末班延长的一个周五记录到约 2.3 万人次进站，客流集中在演出散场之后。',
    headlines: ['火车南站延长时段进站约 2.3 万人次', '夜间换乘客流集中在散场后', '末班延长后的站内疏导记录'],
    paragraphs: [
      '观察选在末班延长后的一个周五。火车南站统计，延长的 60 分钟内进站约 2.3 万人次，其中大头出现在附近演出散场后的 25 分钟。',
      '站内增开了两组临时引导，把出站铁路客流和进站地铁客流分成两条通道。安检口没有关闭，只是增加了人手。',
      '这份记录只说明当天的到达高峰，不能直接外推到没有活动的周五。车站把人数和开始疏导的时间一起留档，方便下次对照。',
    ],
    count: 8,
    hours: [7, 18, 19, 21, 22],
  },
  {
    id: 'e08',
    topicId: 't04',
    name: '二环公交专用道时段调整',
    place: '成都二环路',
    figure: '工作日 7:00–9:00 与 17:00–19:00 双向启用',
    summary: '二环公交专用道改为工作日早晚各两小时双向启用，午间恢复社会车辆通行。',
    headlines: ['二环公交专用道改为早晚启用', '专用道午间恢复社会车辆通行', '双向专用道只保留四个小时'],
    paragraphs: [
      '新的启用时段是工作日 7:00 至 9:00、17:00 至 19:00，方向为双向。午间和其他时段，社会车辆可以进入原专用道范围。',
      '路口电子屏改成了分时段提示。公交驾驶员拿到的说明要求在启用前五分钟进入车道，避免和社会车辆抢口。',
      '交管部门同时公布了抓拍口径：只在启用时段内记录占用。非启用时段的通行不按专用道违章处理。',
    ],
    count: 8,
    hours: [7, 8, 9, 17, 18],
  },
  {
    id: 'e09',
    topicId: 't04',
    name: '高峰公交准点率回升',
    place: '成都中心城区',
    figure: '早高峰准点率由 78% 回到 86%',
    summary: '专用道调整后的两周，中心城区样本线路早高峰准点率从 78% 回到 86%。',
    headlines: ['样本线路早高峰准点率回到 86%', '公交准点统计只覆盖 12 条线路', '专用道调整后的两周对照'],
    paragraphs: [
      '准点统计选取 12 条经过二环的线路，比较专用道调整前后各十个工作日。早高峰准点率由 78% 回到 86%，晚高峰只提高了 3 个百分点。',
      '统计口径是计划发车时间前后两分钟内离站。大间隔和临停被单独列出，没有算进准点率。',
      '公交集团认为早高峰改善和车道启用重合，但晚高峰仍受施工占道影响。因此这次只公布样本线路，不写成全网结论。',
    ],
    count: 6,
    hours: [8, 9, 17, 18],
  },
  {
    id: 'e10',
    topicId: 't05',
    name: '秋季文旅消费券开领',
    place: '四川省文旅平台',
    figure: '首日核销 46 万张',
    summary: '秋季文旅消费券开领首日核销 46 万张，餐饮和景区门票是主要去向。',
    headlines: ['秋季文旅消费券首日核销 46 万张', '消费券核销集中在餐饮和门票', '文旅券领取页显示分时段放量'],
    paragraphs: [
      '领取入口按整点放量。平台统计，开领首日核销 46 万张，其中餐饮券和景区门票券占七成以上，住宿券明显少一些。',
      '每张券对应一次订单，退单后名额不回到当日池子，而是计入次日库存。这个规则写在领取页的折叠说明里。',
      '核销商户需要在订单完成后再发起结算。首日的数字只代表核销，不代表已经打款，也不包含未使用的领取量。',
    ],
    count: 14,
    hours: [10, 11, 12, 15, 16, 20],
  },
  {
    id: 'e11',
    topicId: 't05',
    name: '景区门票核销抽查',
    place: '都江堰和三星堆',
    figure: '抽查 32 家景区，发现异常订单 17 笔',
    summary: '文旅部门抽查 32 家景区的消费券订单，核对出 17 笔重复核销或时间异常。',
    headlines: ['32 家景区被抽查消费券订单', '核销抽查发现 17 笔异常订单', '门票券异常单被要求逐笔复核'],
    paragraphs: [
      '抽查范围是都江堰、三星堆及相关联票点共 32 家景区。工作人员对照券码、入园时间和闸机记录，标出 17 笔异常。',
      '异常包括同一券码两次核销，以及入园时间早于核销时间。这些订单被暂停结算，等待景区提交闸机日志。',
      '其余订单未发现同类问题。通报强调 17 笔是抽查样本中的异常数，不是全部景区的总差错，也没有公布游客姓名。',
    ],
    count: 10,
    hours: [10, 11, 15, 16],
  },
  {
    id: 'e12',
    topicId: 't06',
    name: '博物馆夜游首周',
    place: '成都博物馆',
    figure: '首周五场预约额度 4000 人次全部约满',
    summary: '成都博物馆夜游首周开放五个周五场次，4000 个预约名额在放票当天约满。',
    headlines: ['博物馆夜游首周五个场次约满', '4000 个夜场名额当日预约结束', '夜游路线只开放两个展厅'],
    paragraphs: [
      '夜游首周排了五个场次，每个场次 800 人，合计 4000 个预约名额。放票当天全部约满，候补没有打开。',
      '开放范围只有两个常设展厅和一条固定动线，临时展不在夜场门票内。闭馆前 40 分钟开始清场，和白天一致。',
      '馆方把约满理解为时间方便，而不是新增展览。下一周是否加场，要等安保和保洁班次排完再决定。',
    ],
    count: 8,
    hours: [11, 15, 19, 20, 21],
  },
  {
    id: 'e13',
    topicId: 't06',
    name: '夜场预约限流',
    place: '成都博物馆',
    figure: '每场上限 800 人，闭馆前 40 分钟停止入场',
    summary: '夜场维持每场 800 人上限，闭馆前 40 分钟停止入场，现场不再加售。',
    headlines: ['博物馆夜场维持 800 人上限', '闭馆前 40 分钟停止入场', '夜场不设现场加售'],
    paragraphs: [
      '限流规则在第二周没有放宽。每个夜场仍是 800 人，入口只认预约码，工作人员不接受现场补票。',
      '停止入场的时间定在闭馆前 40 分钟。迟到观众不能改到下一场，需要重新预约尚未约满的日期。',
      '馆方解释，上限同时受安检通过速度和展厅楼梯宽度约束。只增加入口人手，并不能提高展厅内容纳人数。',
    ],
    count: 6,
    hours: [14, 16, 19, 20],
  },
  {
    id: 'e14',
    topicId: 't07',
    name: '新生儿一件事上线',
    place: '四川政务服务网',
    figure: '出生医学证明等 6 个事项可一次提交',
    summary: '新生儿一件事把出生医学证明、户口和医保等 6 个事项收成一次提交。',
    headlines: ['新生儿一件事合并 6 个事项', '出生医学证明可随户口一次提交', '一件事办理仍需到场核验证件'],
    paragraphs: [
      '上线版本包含出生医学证明、预防接种、户口登记、医保、社保卡和生育津贴查询，共 6 个事项。申请人一次填写，材料分发到对应部门。',
      '出生医学证明仍需医院先出具。网上提交不能代替医院盖章，系统会在证明编号通过后再开放后续事项。',
      '窗口保留了人工通道。工作人员说，材料缺页或姓名生僻字的申请会被退回补正，不会在后台直接修改。',
    ],
    count: 7,
    hours: [9, 10, 11, 15],
  },
  {
    id: 'e15',
    topicId: 't07',
    name: '跨省通办窗口扩项',
    place: '成都天府市民云',
    figure: '新增 24 项跨省通办',
    summary: '天府市民云窗口新增 24 项跨省通办，主要是社保记录和公积金证明。',
    headlines: ['市民云新增 24 项跨省通办', '公积金证明纳入跨省窗口', '跨省通办事项逐项列明办理时限'],
    paragraphs: [
      '新增的 24 项里，一半以上是社保缴费记录、养老保险关系转移和公积金贷款证明。每项旁边标了承诺时限。',
      '窗口不代办需要原件核验的户籍事项。工作人员会在取号单上写明缺少的材料，避免只给一个口头答复。',
      '系统按事项编号回传办理状态。申请人看到的“已提交”只说明材料入列，不表示对方省份已经办结。',
    ],
    count: 5,
    hours: [9, 10, 14, 16],
  },
  {
    id: 'e16',
    topicId: 't08',
    name: '社区养老驿站集中开放',
    place: '成都武侯区和锦江区',
    figure: '首批 36 个驿站提供日间照料',
    summary: '武侯、锦江首批 36 个社区养老驿站开放日间照料，不提供长期住宿。',
    headlines: ['36 个社区养老驿站开放日间照料', '养老驿站明确不提供长期住宿', '驿站服务按社区登记使用'],
    paragraphs: [
      '首批 36 个驿站分布在武侯和锦江，白天提供休息、助餐和简单测压。站点不设过夜床位，关闭时间统一在 18:30。',
      '使用前需要在社区登记紧急联系人。登记名单不公开，只供站点在身体不适时联系家属。',
      '助餐需要提前一天预订。驿站工作人员说，首周人流不稳定，没有对外宣布“满员”，只按预订份数出餐。',
    ],
    count: 6,
    hours: [9, 10, 15],
  },
  {
    id: 'e17',
    topicId: 't08',
    name: '助餐服务扩面',
    place: '成都中心城区',
    figure: '助餐点增加到 210 个',
    summary: '中心城区助餐点增加到 210 个，60 岁以上登记居民可以按社区选择取餐点。',
    headlines: ['中心城区助餐点增加到 210 个', '助餐扩面后仍需提前预订', '取餐点按社区而不是按距离分配'],
    paragraphs: [
      '民政部门更新了助餐点名录，中心城区合计 210 个。新增点位多设在已有养老驿站里，没有另外租用商铺。',
      '60 岁以上居民在社区登记后选择一个固定取餐点。临时更换需要提前一天，系统不支持当天跨区取餐。',
      '价格仍按原补贴标准执行。名录只统计可供餐的点位，暂停营业的站点被单独标出，不计入 210 个。',
    ],
    count: 4,
    hours: [10, 11, 15],
  },
  {
    id: 'e18',
    topicId: 't09',
    name: '人工智能产业园开工',
    place: '成都新津',
    figure: '规划建筑面积 42 万平方米',
    summary: '新津人工智能产业园开工，规划建筑面积 42 万平方米，先建公共实验楼。',
    headlines: ['新津人工智能产业园开工', '产业园先建公共实验楼', '42 万平方米规划分三期实施'],
    paragraphs: [
      '开工段是公共实验楼和一条内部道路，规划总建筑面积 42 万平方米，分成三期。仪式上没有宣布入驻企业名单。',
      '实验楼预留了机房荷载和货运电梯，用来承接稍后启用的公共算力测试，不在本期安装生产设备。',
      '施工说明书写明工期到下一年度雨季前完成主体。周边道路改建另案审批，没有算进这次开工范围。',
    ],
    count: 10,
    hours: [9, 10, 11, 15, 16],
  },
  {
    id: 'e19',
    topicId: 't09',
    name: '产业园首批企业签约',
    place: '成都新津',
    figure: '首批签约 27 家企业',
    summary: '产业园首批签约 27 家企业，多数为算法和行业软件团队，生产类项目只有 4 个。',
    headlines: ['产业园首批签约 27 家企业', '签约项目以算法和软件团队为主', '27 家企业里只有 4 个生产项目'],
    paragraphs: [
      '签约名单公布了 27 家企业的名称和主要业务。算法、行业软件和数据标注占了大部分，明确写有生产线的项目是 4 个。',
      '合同阶段还没有统一交付厂房。多数团队先使用实验楼的临时工位，能否转入正式载体要看主体工程进度。',
      '园区没有公布投资总额。负责人说，27 家是已签框架或租赁意向的数量，和实际纳税、用工不是同一口径。',
    ],
    count: 8,
    hours: [10, 11, 14, 16],
  },
  {
    id: 'e20',
    topicId: 't10',
    name: '城市算力中心启用',
    place: '成都双流',
    figure: '首期通用算力 1200 PFLOPS',
    summary: '双流城市算力中心启用首期通用算力 1200 PFLOPS，优先供给已签约的公共实验。',
    headlines: ['双流算力中心启用首期 1200 PFLOPS', '公共实验优先使用首期算力', '算力中心启用不等于全部机柜上电'],
    paragraphs: [
      '启用范围是已经完成测试的第一组机柜，对外口径为首期通用算力 1200 PFLOPS。其余机房仍在布线，没有同时上电。',
      '优先队列给了产业园公共实验和两家医院的影像训练任务。商业租用需要另走容量评估，不能直接引用启用新闻里的数字下单。',
      '运维记录按小时保存负载。启用当天的峰值没有达到标称值，中心把标称和实测分成两列公布。',
    ],
    count: 8,
    hours: [9, 10, 11, 15, 16],
  },
  {
    id: 'e21',
    topicId: 't10',
    name: '公共算力券申领',
    place: '成都双流',
    figure: '面向中小企业发放 2000 万元算力券',
    summary: '中小企业可申领合计 2000 万元公共算力券，单家上限 30 万元，不能折现。',
    headlines: ['2000 万元公共算力券开放申领', '算力券单家上限 30 万元且不能折现', '算力券只抵扣指定机房账单'],
    paragraphs: [
      '算力券总额 2000 万元，面向注册在本地的中小企业。单家累计不超过 30 万元，审核通过后直接抵扣指定机房账单。',
      '券不能转让，也不能换成现金或云厂商的通用代金券。申请表要求写明训练任务和预计卡时，空表会被退回。',
      '首批审核按周公布通过名单和抵扣金额。名单不包含被拒绝的原因细节，只显示“材料不齐”或“超出上限”两类结果。',
    ],
    count: 6,
    hours: [10, 11, 14, 16],
  },
  {
    id: 'e22',
    topicId: 't11',
    name: '湿地生态补水',
    place: '成都兴隆湖湿地',
    figure: '本轮补水 180 万立方米',
    summary: '兴隆湖湿地本轮计划补水 180 万立方米，补水口和观鸟区被临时隔开。',
    headlines: ['兴隆湖湿地本轮补水 180 万立方米', '补水口与观鸟区临时隔离', '湿地补水按水位而不是按日期停止'],
    paragraphs: [
      '本轮补水从兴隆湖上游口进入，计划水量 180 万立方米。管理方用围栏把补水施工和原有观鸟栈道隔开。',
      '停止条件是目标水位，不是固定日期。若上游来水减少，日程会延长，已经注入的水量每天更新一次。',
      '补水期间游船航线缩短，靠近施工口的栈道关闭。公告写明关闭路段，没有把整个湖区标成停园。',
    ],
    count: 10,
    hours: [8, 9, 10, 15],
  },
  {
    id: 'e23',
    topicId: 't11',
    name: '候鸟同步调查',
    place: '兴隆湖和青龙湖',
    figure: '记录水鸟 46 种、约 6200 只',
    summary: '两处湖区同一天调查记录水鸟 46 种、约 6200 只，调查只覆盖上午三个小时。',
    headlines: ['两湖同步调查记录水鸟 46 种', '候鸟调查统计约 6200 只', '调查窗口只有上午三个小时'],
    paragraphs: [
      '调查在兴隆湖和青龙湖同时开始，窗口是上午三个小时。记录到水鸟 46 种、约 6200 只，数量按观测分区加总。',
      '计数使用定点而不是全湖搜索，避开了补水围栏内的区域。因此这份数字不包含施工区内可能停歇的鸟群。',
      '组织者没有把结果和去年全天调查直接对比。他们标明了时长和范围，方便下一轮用同样的三个小时再做一次。',
    ],
    count: 8,
    hours: [7, 8, 9, 16],
  },
  {
    id: 'e24',
    topicId: 't12',
    name: '口袋公园集中开放',
    place: '成都老城区',
    figure: '新开放 12 处口袋公园',
    summary: '老城区新开放 12 处口袋公园，单处面积都不大，主要补的是街角停留空间。',
    headlines: ['老城区新开放 12 处口袋公园', '口袋公园补的是街角停留空间', '12 处公园不设大型商业'],
    paragraphs: [
      '12 处口袋公园分布在旧居住区街角，单处面积有限，配置为座椅、遮阴和一处直饮水。没有停车场，也没有商铺招标。',
      '开放名单附了具体路口。其中 3 处因为地下管线还在收尾，只开放了一半场地，名单里用备注标出。',
      '管护责任写到所在街道。公园不设闭园时间，夜间照明沿用街道原有路灯，没有单独增加亮化工程。',
    ],
    count: 5,
    hours: [9, 10, 16],
  },
  {
    id: 'e25',
    topicId: 't12',
    name: '滨水绿道贯通',
    place: '锦江沿线',
    figure: '新增贯通绿道 8.6 公里',
    summary: '锦江沿线新增 8.6 公里贯通绿道，打通两处原先需要绕行机动车道的断点。',
    headlines: ['锦江绿道新增贯通 8.6 公里', '两处绕行断点改成慢行通过', '绿道贯通后仍保留防洪通道'],
    paragraphs: [
      '新贯通的 8.6 公里连接了原先中断的两段滨河路。骑行和步行可以不再绕上机动车道，防洪闸位置保留了宽度。',
      '断点改造使用了已有堤顶，没有加宽河道。施工期间的临时绕行在贯通当天撤除，只留下一处仍在养护的短段。',
      '绿道管护方公布了夜间照明开启时间，并提醒洪水预警时堤顶会临时封闭。8.6 公里指的是本次贯通长度，不是全河绿道总长。',
    ],
    count: 4,
    hours: [8, 10, 16],
  },
  {
    id: 'e26',
    topicId: 't12',
    name: '年度增绿计划公布',
    place: '成都',
    figure: '年内计划新增绿地 150 公顷',
    summary: '年度增绿计划提出新增绿地 150 公顷，其中已开工的是 46 公顷。',
    headlines: ['年度计划新增绿地 150 公顷', '增绿计划里已开工 46 公顷', '150 公顷包含公园和道路绿化'],
    paragraphs: [
      '计划文本把年内新增绿地写成 150 公顷，包括公园、街头绿地和道路绿化带。已经开工的是 46 公顷，其余还在设计或征地。',
      '道路绿化带按长度折算面积，和公园用地分开列表。把两类数字加总时，文本要求保留类别，避免看成同一类公园。',
      '年底将按竣工测绘复核，而不是按开工公告累计。因此 150 公顷是年度目标，46 公顷才是当前已动工的部分。',
    ],
    count: 5,
    hours: [9, 11, 15],
  },
]

/** 事件发生地原文。地图只使用这份地点，不用媒体所在地。 */
export const EVENT_PLACES: Readonly<Record<string, string>> = Object.fromEntries(EVENTS.map((event) => [event.id, event.place]))
export const EVENT_BRIEFS: Readonly<Record<string, string>> = Object.fromEntries(EVENTS.map((event) => [event.id, event.summary]))

const MEDIA_WEIGHTS = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 4, 5, 6, 7]
const PLATFORM_WEIGHTS = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 4]
const DAY_BUDGETS = [6, 8, 10, 9, 14, 16, 12, 18, 22, 20, 15, 11, 17, 22]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildDayQueue(): number[] {
  const queue: number[] = []
  DAY_BUDGETS.forEach((count, day) => {
    for (let index = 0; index < count; index += 1) queue.push(day)
  })
  const random = mulberry32(20261110)
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = queue[index]
    queue[index] = queue[swapIndex]
    queue[swapIndex] = current
  }
  return queue
}

/**
 * e01 事实底稿（只约束演示稿，不作为新闻来源）：
 * 2026-11-05 上午，金堂淮州机场至洛带完成一次载人试飞。
 * 6 名乘客来自体验名单，往返约 28 公里，未售票、未公布票价。
 * 环节为申请、放行、飞行、复盘；四段完成时间在 11 月 6 日及以后的复盘稿中出现。
 * 2026-11-10 才公布下一班窗口为 11 月 12 日上午，仍不售票。
 * 地面车程通常超过 1 小时。采访对象均为虚构角色。
 */
function flightStory(publishedAt: string, index: number, mediaName: string): { headline: string; summary: string; body: string } {
  const day = publishedAt.slice(0, 10)
  const hour = Number(publishedAt.slice(11, 13))
  const when = hour < 12 ? '上午' : '下午'
  const afterFlight = day >= '2026-11-05'
  const afterReview = day >= '2026-11-06'
  const afterNext = day >= '2026-11-10'
  const role = afterNext && index % 3 === 0 ? 'follow' : (['scene', 'rules', 'service', 'business', 'rider'] as const)[index % 5]
  if (!afterFlight) {
    return {
      headline: '淮州至洛带航线仍在等候首飞窗口',
      summary: '体验名单已经成立，常规售票和票价都还没有公布。',
      body: [
        `${mediaName}记者${when}在金堂淮州机场看到，淮州至洛带航线的候机区只保留了核验台，没有开售票窗口。`,
        '现场工作人员说，目前只接受已经报名的体验名单，乘客需要携带报名回执和身份证件。常规售票什么时候开始、票价是多少，现场都没有答复。',
        '一名负责接驳的调度员介绍，金堂到洛带的地面车程通常超过一小时。空域释放时间尚未固定，不能把等候理解成已经起飞。',
        '截至发稿，机场没有宣布首飞完成，也没有公布下一班日期。',
      ].join('\n\n'),
    }
  }
  if (role === 'follow' && afterNext) {
    return {
      headline: '淮州至洛带航线公布下一班试飞窗口',
      summary: '下一班窗口定在 11 月 12 日上午，仍只安排体验名单，票价未公布。',
      body: [
        `金堂淮州机场${when}确认，淮州至洛带载人航线的下一班试飞窗口安排在 11 月 12 日上午。`,
        '工作人员重申，这一班仍只从已报名的体验名单里安排乘客，常规售票没有开始，票价也没有数字。首飞当天的记录不变：6 名乘客，往返约 28 公里。',
        '负责空域协调的值班员说，12 日上午能不能按窗口起飞，还要看当天有没有临时限制。限制如果出现，班次会改期，而不是改成售票航班。',
        '机场没有把下一班窗口解释成航线已经常态化运行。',
      ].join('\n\n'),
    }
  }
  if (role === 'rules') {
    const times = afterReview
      ? '复盘表把四个环节的完成时间分开记下：申请在起飞前夜收齐，放行在起飞前约 40 分钟完成，飞行本身约 25 分钟，降落后一小时内做完复盘。'
      : '现场只确认四个环节都会留下时间，具体钟点还没有整理成可以公开的表。'
    return {
      headline: '首飞按申请、放行、飞行、复盘四段记录',
      summary: '四个环节被分开记录。能否复制到下一班，取决于同一窗口有没有临时限制。',
      body: [
        `淮州至洛带航线 11 月 5 日上午的试飞，被运营方拆成申请、放行、飞行和复盘四段。${mediaName}记者核对的是已经飞完的这一班，不是预告。`,
        '这一班搭载 6 名体验名单上的乘客，往返航程约 28 公里。地面人员先核对空域释放，再按座位引导登机，降落后补做设备检查。',
        times,
        '负责空域的人员说，下一班能不能照同一套流程飞，要看窗口里有没有临时限制。限制条件没有写成可以天天使用的许可，票价也仍未公布。',
      ].join('\n\n'),
    }
  }
  if (role === 'service') {
    return {
      headline: '体验乘客需持名单核验，接驳只到机场',
      summary: '参加方式仍是体验名单。接驳车只负责抵达淮州机场，回程地面交通要自行安排。',
      body: [
        `11 月 5 日首飞使用的是体验名单，不是开放售票。${mediaName}记者在核验台看到，乘客要同时出示报名回执和身份证件，工作人员按座位号引导，不接受现场加塞。`,
        '6 名乘客完成了约 28 公里往返。接驳车只把名单内乘客送到金堂淮州机场，没有安排洛带一侧的回程专车。工作人员提醒，金堂到洛带地面通常要一个小时以上，下机后的地面行程需自己衔接。',
        '核验台旁的说明写着：常规售票未开放，票价未公布，体验名单不能转让。记者询问能否为下一次预留座位，得到的答复是等后续班次计划，现场不办理。',
      ].join('\n\n'),
    }
  }
  if (role === 'business') {
    return {
      headline: '首飞未公布票价，不能据此计算盈亏',
      summary: '运营方确认成本科目包括空域协调、机务和接驳，但没有给出票价或载客收入。',
      body: [
        `淮州至洛带航线完成了 6 名乘客、约 28 公里的首飞，但现场没有任何票价。${mediaName}就此询问运营方，对方说这一班不产生票款。`,
        '一名不具名的运营对接人列举了已发生的成本：空域协调、当班机务和机场接驳。他没有提供金额，也拒绝把首飞描述成盈利或亏损。',
        '因为票价和常规班次都未公布，这篇稿件不计算单座成本，也不推断商业化时间。能够核对的仍是体验名单这一班已经飞完，售票没有开始。',
      ].join('\n\n'),
    }
  }
  if (role === 'scene') {
    return {
      headline: '淮州至洛带载人航线完成首飞',
      summary: '6 名体验名单乘客完成约 28 公里往返。现场没有观礼人群，也没有公布票价。',
      body: [
        `11 月 5 日上午，淮州至洛带载人航线在金堂淮州机场完成首飞。${mediaName}记者在停机坪看到，地面没有组织观礼。`,
        '这一班搭载 6 名乘客，全部来自已报名的体验名单。飞机往返约 28 公里，降落后地面人员又做了一轮设备检查。',
        '核验台按座位引导登机。记者询问票价和如何购买下一班，工作人员说常规售票没有开始，现场不报价。',
        '金堂到洛带走地面通常超过一小时。首飞已经结束，但这不表示航线已经按同一方式天天飞行。',
      ].join('\n\n'),
    }
  }
  return {
    headline: '体验乘客回忆首飞：核验后登机，途中约二十五分钟',
    summary: '体验者描述了核验、登机和约 25 分钟飞行，没有提到票价。',
    body: [
      `11 月 5 日上午，淮州至洛带载人航线完成首飞，6 名乘客全部来自体验名单，往返约 28 公里。${mediaName}记者在降落后采访了其中一名体验者。`,
      '体验者林女士说，她前天收到名单短信，当天在淮州机场核验身份和回执，随后按座位登机。她记得飞行大约 25 分钟，途中能看到地面道路，机组没有介绍票价或下一班怎么买票。',
      '她补充，现场没有观礼人群，降落后地面人员又做了一轮设备检查。林女士只在演示稿中出现，不对应真实乘客。',
      '工作人员确认，常规售票和票价都还没有公布。金堂到洛带若走地面，通常要一个多小时。',
    ].join('\n\n'),
  }
}

function composeArticle(event: EventSeed, index: number, publishedAt: string, mediaName: string): { headline: string; summary: string; body: string } {
  if (event.id === 'e01') return flightStory(publishedAt, index, mediaName)
  const headline = event.headlines[index % event.headlines.length]
  const lead = `${event.place}，${event.summary}`
  const detail = event.paragraphs[index % event.paragraphs.length]
  const extra = event.paragraphs[(index + 1) % event.paragraphs.length]
  const open = event.paragraphs[(index + 2) % event.paragraphs.length]
  const body = [
    `${mediaName}记者了解到，${lead}`,
    detail,
    extra,
    `仍待公开核对的一点是：${event.figure}。${open}`,
  ].join('\n\n')
  return {
    headline,
    summary: `${event.summary}可核对的记录是：${event.figure}。`,
    body,
  }
}

function buildNews(): NewsItem[] {
  const dayQueue = buildDayQueue()
  let cursor = 0
  const usedTitles = new Set<string>()
  const items: NewsItem[] = []

  EVENTS.forEach((event, eventIndex) => {
    const topic = topicById[event.topicId]
    for (let index = 0; index < event.count; index += 1) {
      const dayIndex = dayQueue[cursor]
      cursor += 1
      const date = addDays(DATA_START, dayIndex)
      let hour = event.hours[(index + eventIndex) % event.hours.length]
      if (date === '2026-11-10' && hour > 17) hour = 9 + (hour % 8)
      const minute = (index * 11 + eventIndex * 5) % 60
      const publishedAt = `${date}T${pad(hour)}:${pad(minute)}:00+08:00`
      const media = MEDIA[MEDIA_WEIGHTS[(index * 3 + eventIndex * 2) % MEDIA_WEIGHTS.length]]
      const columnName = media.columns[(index + eventIndex) % media.columns.length]
      const platform = PLATFORMS[PLATFORM_WEIGHTS[(index * 2 + eventIndex) % PLATFORM_WEIGHTS.length]]
      const story = composeArticle(event, index, publishedAt, media.name)
      const dayLabel = formatChineseDay(date)
      let title = `${story.headline}（${media.name}，${dayLabel}）`
      while (usedTitles.has(title)) title = `${title}·补充`
      usedTitles.add(title)
      const body = `${story.body}\n\n截至${dayLabel} ${pad(hour)}:${pad(minute)}发稿，上述可以核对的口径没有变化。`
      items.push({
        id: `n${String(items.length + 1).padStart(3, '0')}`,
        title,
        summary: story.summary,
        body,
        publishedAt,
        topicId: event.topicId,
        eventId: event.id,
        eventName: event.name,
        categoryId: topic.categoryId,
        mediaId: media.id,
        mediaName: media.name,
        columnName,
        platform,
      })
    }
  })

  if (cursor !== 200 || items.length !== 200) {
    throw new Error(`演示新闻数量异常：${items.length}`)
  }
  const bodies = new Set(items.map((item) => item.body))
  if (bodies.size !== items.length) throw new Error('演示新闻正文出现重复')
  if (items.some((item) => item.publishedAt > DATA_AS_OF)) throw new Error('存在超出截止时间的新闻')
  if (TOPICS.some((topic) => !items.some((item) => item.topicId === topic.id))) {
    throw new Error('有话题没有新闻')
  }
  return items
}

export const NEWS: NewsItem[] = buildNews()

/** 事件种子里已有的地点和概括，不是模型生成。 */
export const EVENT_META: Record<string, { place: string; summary: string }> = Object.fromEntries(
  EVENTS.map((event) => [event.id, { place: event.place, summary: event.summary }]),
)
