import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
export function EChart({ option, onClick, }) {
    const hostRef = useRef(null);
    const chartRef = useRef(null);
    const clickRef = useRef(onClick);
    const optionRef = useRef(option);
    clickRef.current = onClick;
    optionRef.current = option;
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        const chart = echarts.init(host);
        chartRef.current = chart;
        chart.setOption(optionRef.current, true);
        let frame = 0;
        let width = 0;
        let height = 0;
        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (!rect)
                return;
            const nextWidth = Math.round(rect.width);
            const nextHeight = Math.round(rect.height);
            if (nextWidth < 1 || nextHeight < 1)
                return;
            if (nextWidth === width && nextHeight === height)
                return;
            width = nextWidth;
            height = nextHeight;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (!chart.isDisposed())
                    chart.resize({ width: nextWidth, height: nextHeight });
            });
        });
        observer.observe(host);
        const handleClick = (params) => {
            clickRef.current?.(params);
        };
        chart.on('click', handleClick);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            chart.off('click', handleClick);
            chart.dispose();
            chartRef.current = null;
        };
    }, []);
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart)
            return;
        chart.setOption(option, true);
        chart.resize();
    }, [option]);
    return _jsx("div", { ref: hostRef, className: "echart-host" });
}
