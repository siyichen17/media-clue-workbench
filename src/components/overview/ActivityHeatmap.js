import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from 'react';
import { EChart } from './EChart.tsx';
const FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour));
export function ActivityHeatmap({ model, onSelect, }) {
    const option = useMemo(() => {
        const data = model.matrix.flatMap((row, topicIndex) => row.map((value, hour) => [hour, topicIndex, value]));
        return {
            animation: false,
            textStyle: { fontFamily: FONT },
            grid: { left: 8, right: 16, top: 8, bottom: 52, containLabel: true },
            tooltip: {
                formatter: (params) => {
                    const row = params;
                    const hour = row.data?.[0] ?? 0;
                    const topicIndex = row.data?.[1] ?? 0;
                    const value = row.data?.[2] ?? 0;
                    const topic = model.topics[topicIndex];
                    return `${topic?.name ?? ''}<br/>${hour}:00–${hour}:59<br/>新闻 ${value} 条`;
                },
            },
            xAxis: {
                type: 'category',
                data: HOURS,
                name: '时',
                nameTextStyle: { color: '#64748b' },
                axisLabel: { color: '#64748b', interval: 1 },
                splitArea: { show: false },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'category',
                data: model.topics.map((topic) => topic.name),
                inverse: true,
                axisLabel: { color: '#334155', width: 108, overflow: 'truncate' },
                axisTick: { show: false },
                axisLine: { show: false },
            },
            visualMap: {
                min: 0,
                max: Math.max(model.max, 1),
                calculable: false,
                orient: 'horizontal',
                left: 'center',
                bottom: 0,
                itemWidth: 12,
                itemHeight: 90,
                text: ['多', '0'],
                textStyle: { color: '#64748b', fontSize: 11 },
                inRange: { color: ['#e8edf3', '#bfdbfe', '#2563eb', '#1e3a8a'] },
            },
            series: [
                {
                    type: 'heatmap',
                    cursor: 'pointer',
                    data,
                    itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
                    emphasis: { itemStyle: { borderColor: '#1e3a8a', borderWidth: 1 } },
                },
            ],
        };
    }, [model]);
    return (_jsx("div", { className: "chart-box", style: { height: 380 }, children: _jsx(EChart, { option: option, onClick: (params) => {
                if (!Array.isArray(params.data))
                    return;
                const hour = Number(params.data[0]);
                const topicIndex = Number(params.data[1]);
                const topic = model.topics[topicIndex];
                if (!topic)
                    return;
                onSelect(topic.id, hour);
            } }) }));
}
