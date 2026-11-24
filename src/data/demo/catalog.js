export const CATEGORIES = [
    { id: 'low-air', name: '低空经济' },
    { id: 'traffic', name: '城市交通' },
    { id: 'culture', name: '文旅消费' },
    { id: 'public', name: '公共服务' },
    { id: 'tech', name: '科技产业' },
    { id: 'eco', name: '生态保护' },
];
export const TOPICS = [
    { id: 't01', name: '低空经济试点航线', categoryId: 'low-air' },
    { id: 't02', name: '无人机城际物流', categoryId: 'low-air' },
    { id: 't03', name: '地铁末班延时', categoryId: 'traffic' },
    { id: 't04', name: '公交专用道调优', categoryId: 'traffic' },
    { id: 't05', name: '文旅消费券发放', categoryId: 'culture' },
    { id: 't06', name: '博物馆夜场', categoryId: 'culture' },
    { id: 't07', name: '一网通办服务', categoryId: 'public' },
    { id: 't08', name: '社区养老驿站', categoryId: 'public' },
    { id: 't09', name: '人工智能产业园', categoryId: 'tech' },
    { id: 't10', name: '城市算力中心', categoryId: 'tech' },
    { id: 't11', name: '湿地生态修复', categoryId: 'eco' },
    { id: 't12', name: '公园城市增绿', categoryId: 'eco' },
];
export const MEDIA = [
    { id: 'cover', name: '封面新闻', columns: ['封面新闻·成都观察', '封面新闻·经济'] },
    { id: 'scdaily', name: '四川日报', columns: ['四川日报数字版·成都版', '四川日报·要闻'] },
    { id: 'thepaper', name: '澎湃新闻', columns: ['澎湃新闻·市政厅', '澎湃新闻·经济'] },
    { id: 'jiemian', name: '界面新闻', columns: ['界面新闻·城市', '界面新闻·科技'] },
    { id: 'redstar', name: '红星新闻', columns: ['红星新闻·本地', '红星新闻·调查'] },
    { id: 'nddaily', name: '南方都市报', columns: ['南方都市报·城事', '南方都市报·大湾区'] },
    { id: 'bjnews', name: '新京报', columns: ['新京报·都市', '新京报·评论'] },
    { id: 'guancha', name: '观察者网', columns: ['观察者网·产业', '观察者网·城市'] },
];
export const PLATFORMS = ['网站', '客户端', '微博', '微信', '今日头条'];
/** 演示用关注关键词，只匹配话题名称中的这些词。 */
export const WATCH_KEYWORDS = ['低空经济', '文旅消费', '湿地', '地铁', '算力'];
export const CATEGORY_COLORS = {
    'low-air': '#2563eb',
    traffic: '#0f766e',
    culture: '#d97706',
    public: '#7c3aed',
    tech: '#4f46e5',
    eco: '#e11d48',
};
export const topicById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
export const categoryById = Object.fromEntries(CATEGORIES.map((category) => [category.id, category]));
export const mediaById = Object.fromEntries(MEDIA.map((media) => [media.id, media]));
