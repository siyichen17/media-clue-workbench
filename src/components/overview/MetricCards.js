import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const METRICS = [
    {
        id: 'news',
        label: '新闻数',
        tip: '按发布时间计入。只统计当前日期、发布平台和关键词下的新闻条数。',
    },
    {
        id: 'topics',
        label: '话题数',
        tip: '上述新闻关联的话题数量。同一个话题只计一次。',
    },
    {
        id: 'media',
        label: '覆盖媒体数',
        tip: '上述新闻涉及的媒体机构数量。栏目不单独计数。',
    },
    {
        id: 'hot',
        label: '热榜条目数',
        tip: '当前日期内，微博与百度热榜按“平台 + 稳定条目”去重，多次上榜只计 1 条。关键词匹配条目标题或话题名。发布平台选“微博”时只计微博热榜；选其他平台时，只保留能关联到该平台新闻的条目。热度不跨平台比较。',
    },
];
export function MetricCards({ values }) {
    return (_jsx("section", { className: "metric-grid", "aria-label": "\u6307\u6807", children: METRICS.map((metric) => (_jsxs("article", { className: "metric-card", "data-testid": `metric-${metric.id}`, children: [_jsxs("div", { className: "metric-label", children: [_jsx("h2", { children: metric.label }), _jsx("button", { type: "button", className: "info-tip", "aria-label": metric.tip, title: metric.tip, children: "\u53E3\u5F84" })] }), _jsx("p", { className: "metric-value", children: values[metric.id].toLocaleString('zh-CN') })] }, metric.id))) }));
}
