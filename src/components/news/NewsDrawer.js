import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoryById, topicById } from '../../data/demo/index.ts';
import { formatStamp } from '../../lib/dates.ts';
import { followEvent, restoreLead } from '../../lib/leads.ts';
function heatName(platform) {
    return platform === '微博' ? '微博热度' : '百度热度';
}
export function NewsDrawer({ model, followedIds, onClose, onToggleFollow, entry = 'overview', }) {
    const navigate = useNavigate();
    const [followMsg, setFollowMsg] = useState(null);
    const closeRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const [sort, setSort] = useState('latest');
    const [titleQuery, setTitleQuery] = useState('');
    const [detailId, setDetailId] = useState(null);
    const open = model !== null;
    const signature = model?.kind === 'news' ? model.items.map((item) => item.id).join('|') : model?.snapshot.observedAt ?? '';
    useEffect(() => {
        setSort('latest');
        setTitleQuery('');
        setDetailId(null);
    }, [signature, model?.kind]);
    useEffect(() => {
        if (!open)
            return;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const scrollY = window.scrollY;
        const { position, top, left, right, width } = document.body.style;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        const onKey = (event) => {
            if (event.key === 'Escape')
                onCloseRef.current();
        };
        document.addEventListener('keydown', onKey);
        const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', onKey);
            document.body.style.position = position;
            document.body.style.top = top;
            document.body.style.left = left;
            document.body.style.right = right;
            document.body.style.width = width;
            window.scrollTo(0, scrollY);
            opener?.focus();
        };
    }, [open]);
    const shown = useMemo(() => {
        if (model?.kind !== 'news')
            return [];
        const keyword = titleQuery.trim();
        const filtered = keyword ? model.items.filter((item) => item.title.includes(keyword)) : model.items;
        return [...filtered].sort((a, b) => sort === 'latest' ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt));
    }, [model, sort, titleQuery]);
    const detail = model?.kind === 'news' ? model.items.find((item) => item.id === detailId) ?? null : null;
    if (!model)
        return null;
    return (_jsxs("div", { className: "drawer-root", "data-testid": "news-drawer", children: [_jsx("button", { type: "button", className: "drawer-mask", "aria-label": "\u5173\u95ED\u65B0\u95FB\u62BD\u5C49", onClick: onClose }), _jsxs("aside", { className: "drawer-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "drawer-title", children: [_jsxs("header", { className: "drawer-head", children: [_jsxs("div", { children: [_jsx("h2", { id: "drawer-title", children: model.kind === 'news' ? '相关新闻' : '热榜记录' }), _jsx("div", { className: "tag-row", children: model.tags.map((tag) => (_jsx("span", { className: "static-tag", children: tag.label }, tag.id))) })] }), _jsx("button", { ref: closeRef, type: "button", className: "icon-button", onClick: onClose, "aria-label": "\u5173\u95ED", children: "\u00D7" })] }), model.kind === 'snapshot' ? (_jsxs("div", { className: "drawer-scroll", children: [_jsx("p", { className: "sim-banner", children: "\u6A21\u62DF\u70ED\u699C\u5FEB\u7167\uFF0C\u4E0D\u662F\u5E73\u53F0\u5F53\u65F6\u7684\u771F\u5B9E\u699C\u5355\u3002" }), _jsx("p", { children: model.summary }), _jsxs("dl", { className: "meta-list", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u5E73\u53F0" }), _jsx("dd", { children: model.snapshot.platform })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u6761\u76EE" }), _jsx("dd", { children: model.snapshot.title })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u89C2\u6D4B\u65F6\u95F4" }), _jsx("dd", { children: formatStamp(model.snapshot.observedAt) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u6392\u540D" }), _jsxs("dd", { children: ["\u7B2C ", model.snapshot.rank, " \u4F4D"] })] }), model.snapshot.previousRank !== undefined && (_jsxs("div", { children: [_jsx("dt", { children: "\u4E0A\u4E00\u5FEB\u7167\u6392\u540D" }), _jsxs("dd", { children: ["\u7B2C ", model.snapshot.previousRank, " \u4F4D"] })] })), _jsxs("div", { children: [_jsx("dt", { children: heatName(model.snapshot.platform) }), _jsx("dd", { children: model.snapshot.heat.toLocaleString('zh-CN') })] })] }), _jsx("p", { className: "chart-note", children: "\u70ED\u5EA6\u4E3A\u8BE5\u5E73\u53F0\u81EA\u8EAB\u53E3\u5F84\uFF0C\u4E0D\u4E0E\u53E6\u4E00\u5E73\u53F0\u7684\u6570\u503C\u6BD4\u8F83\u3002" }), _jsx("div", { className: "empty-state", children: "\u5F53\u524D\u672A\u5173\u8054\u65B0\u95FB" })] })) : detail ? (_jsx(NewsDetail, { item: detail, followed: followedIds.has(detail.id), onBack: () => setDetailId(null), onToggleFollow: onToggleFollow })) : (_jsxs("div", { className: "drawer-scroll", children: [model.note && _jsx("p", { className: "chart-note", children: model.note }), _jsxs("div", { className: "drawer-tools", children: [_jsxs("strong", { "data-testid": "drawer-count", children: ["\u5339\u914D ", model.items.length, " \u6761", titleQuery.trim() ? `，显示 ${shown.length} 条` : ''] }), _jsxs("div", { className: "segmented", role: "group", "aria-label": "\u65B0\u95FB\u6392\u5E8F", children: [_jsx("button", { type: "button", "aria-pressed": sort === 'latest', onClick: () => setSort('latest'), children: "\u6700\u65B0\u4F18\u5148" }), _jsx("button", { type: "button", "aria-pressed": sort === 'earliest', onClick: () => setSort('earliest'), children: "\u6700\u65E9\u4F18\u5148" })] }), _jsx("input", { type: "search", "aria-label": "\u641C\u7D22\u6807\u9898", placeholder: "\u641C\u7D22\u6807\u9898", value: titleQuery, onChange: (event) => setTitleQuery(event.target.value) })] }), shown.length === 0 ? (_jsx("div", { className: "empty-state", children: "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u65B0\u95FB" })) : (_jsx("ul", { className: "news-list", children: shown.map((item) => (_jsx("li", { children: _jsxs("article", { className: "news-card", children: [_jsx("h3", { children: item.title }), _jsxs("p", { className: "news-meta", children: [_jsx("span", { children: item.mediaName }), _jsx("span", { children: item.platform }), _jsx("span", { children: formatStamp(item.publishedAt) })] }), _jsxs("p", { className: "news-topic", children: ["\u8BDD\u9898\uFF1A", topicById[item.topicId].name] }), _jsx("p", { children: item.summary }), _jsx("p", { className: "sim-flag", children: "\u6A21\u62DF\u6570\u636E" }), _jsxs("div", { className: "news-actions", children: [_jsx("button", { type: "button", className: "btn", onClick: () => setDetailId(item.id), children: "\u67E5\u770B\u5168\u6587" }), _jsx("button", { type: "button", className: followedIds.has(item.id) ? 'btn active' : 'btn ghost', "aria-pressed": followedIds.has(item.id), onClick: () => onToggleFollow(item.id), children: followedIds.has(item.id) ? '已关注' : '关注' }), _jsx("button", { type: "button", className: "btn ghost", onClick: () => {
                                                            const result = followEvent({
                                                                eventId: item.eventId,
                                                                eventName: item.eventName,
                                                                articleIds: [item.id],
                                                                entry,
                                                            });
                                                            setFollowMsg({
                                                                id: result.lead.id,
                                                                archived: result.kind === 'archived',
                                                                text: result.kind === 'archived' ? '这条线索已归档，没有自动恢复。' : result.kind === 'created' ? '已加入跟进。' : '已合并到原线索，备注和负责人保持不变。',
                                                            });
                                                        }, children: "\u8DDF\u8FDB\u4E8B\u4EF6" }), followMsg && (_jsxs(_Fragment, { children: [_jsx("p", { className: "sim-flag", children: followMsg.text }), _jsx("button", { type: "button", className: "btn", onClick: () => navigate(`/leads?lead=${followMsg.id}`), children: "\u67E5\u770B\u7EBF\u7D22" }), followMsg.archived && _jsx("button", { type: "button", className: "btn ghost", onClick: () => { restoreLead(followMsg.id); setFollowMsg({ ...followMsg, archived: false, text: '已恢复为待处理。' }); }, children: "\u6062\u590D\u8DDF\u8FDB" })] }))] })] }) }, item.id))) }))] }))] })] }));
}
function NewsDetail({ item, followed, onBack, onToggleFollow, }) {
    return (_jsxs("div", { className: "drawer-scroll", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: onBack, children: "\u8FD4\u56DE\u5217\u8868" }), _jsx("h3", { className: "detail-title", children: item.title }), _jsx("p", { className: "sim-banner", children: "\u6A21\u62DF\u62A5\u9053\uFF0C\u975E\u8BE5\u5A92\u4F53\u5B9E\u9645\u53D1\u5E03" }), _jsxs("dl", { className: "meta-list", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u5A92\u4F53" }), _jsx("dd", { children: item.mediaName })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u680F\u76EE" }), _jsx("dd", { children: item.columnName })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u53D1\u5E03\u5E73\u53F0" }), _jsx("dd", { children: item.platform })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u53D1\u5E03\u65F6\u95F4" }), _jsx("dd", { children: formatStamp(item.publishedAt) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u8BDD\u9898" }), _jsx("dd", { children: topicById[item.topicId].name })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u4E8B\u4EF6" }), _jsx("dd", { children: item.eventName })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5206\u7C7B" }), _jsx("dd", { children: categoryById[item.categoryId].name })] })] }), item.body.split('\n\n').map((paragraph, index) => (_jsx("p", { className: "detail-paragraph", children: paragraph }, index))), _jsx("p", { className: "sim-footnote", children: "\u6B64\u6B63\u6587\u4E3A\u6F14\u793A\u751F\u6210\u7684\u6A21\u62DF\u7A3F\uFF0C\u4E0D\u80FD\u89C6\u4E3A\u4E0A\u8FF0\u5A92\u4F53\u7684\u771F\u5B9E\u53D1\u8868\u5185\u5BB9\uFF0C\u4E5F\u4E0D\u63D0\u4F9B\u5A92\u4F53\u5B98\u7F51\u94FE\u63A5\u3002" }), _jsx("button", { type: "button", className: followed ? 'btn active' : 'btn ghost', "aria-pressed": followed, onClick: () => onToggleFollow(item.id), children: followed ? '已关注' : '关注' })] }));
}
