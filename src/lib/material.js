export function materialNature(item) {
    return item.nature === 'real' ? 'real' : 'simulated';
}
export function materialLevel(item) {
    if (item.body.trim().length >= 40)
        return 'full';
    if (item.summary.trim().length >= 8)
        return 'summary';
    return 'title';
}
export function levelLabel(level) {
    if (level === 'full')
        return '全文';
    if (level === 'summary')
        return '摘要';
    return '仅标题';
}
export function natureLabel(nature) {
    return nature === 'real' ? '真实' : '模拟';
}
