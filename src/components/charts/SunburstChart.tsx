import { useRef, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { SunburstData } from '../../types';

export interface SunburstHighlightPath {
  routerName: string;
  interfaceName?: string;
}

interface SunburstChartProps {
  data: SunburstData;
  height?: number;
  highlightPath?: SunburstHighlightPath | null;
  onSegmentClick?: (path: SunburstHighlightPath) => void;
}

const COLORS = [
  '#00B4D8',
  '#10B981',
  '#F97316',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
];

export function SunburstChart({
  data,
  height = 350,
  highlightPath,
  onSegmentClick,
}: SunburstChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const onSegmentClickRef = useRef(onSegmentClick);
  useEffect(() => { onSegmentClickRef.current = onSegmentClick; }, [onSegmentClick]);

  // Build dataIndex lookup: "routerName" → [routerIdx, ...childIndices],
  // "routerName/ifaceName" → [ifaceIdx]
  const highlightIndices = useMemo(() => {
    const map = new Map<string, number[]>();
    let idx = 0;

    for (const router of (data.children || [])) {
      const routerIdx = idx;
      const childIndices: number[] = [];
      idx++;

      for (const iface of (router.children || [])) {
        childIndices.push(idx);
        map.set(`${router.name}/${iface.name}`, [idx]);
        idx++;
      }

      map.set(router.name, [routerIdx, ...childIndices]);
    }

    return map;
  }, [data]);

  // Sync external highlight via dispatchAction
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    instance.dispatchAction({ type: 'downplay', seriesIndex: 0 });

    if (!highlightPath) return;

    const key = highlightPath.interfaceName
      ? `${highlightPath.routerName}/${highlightPath.interfaceName}`
      : highlightPath.routerName;

    const indices = highlightIndices.get(key);
    if (!indices) return;

    for (const dataIndex of indices) {
      instance.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex });
    }
  }, [highlightPath, highlightIndices]);

  const option: EChartsOption = useMemo(() => ({
    color: COLORS,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937', fontSize: 12 },
      formatter: (params: any) => {
        const d = params.data;
        if (!d) return '';
        const level = (params.treePathInfo?.length ?? 0) <= 2 ? 'Router' : 'Interface';
        return `<div style="font-weight:600;margin-bottom:4px">${d.name}</div>`
          + `<div style="color:#9ca3af;font-size:11px;margin-bottom:6px">${level}</div>`
          + `<div style="display:flex;justify-content:space-between;gap:20px">`
          + `<span style="color:#6b7280">Traffic</span><strong>${d.value?.toFixed(1)} Gbps</strong></div>`
          + `<div style="display:flex;justify-content:space-between;gap:20px">`
          + `<span style="color:#6b7280">Share</span><strong>${d.percent?.toFixed(1)}%</strong></div>`;
      },
    },
    series: [{
      type: 'sunburst',
      data: data.children || [],
      radius: ['18%', '85%'],
      center: ['50%', '50%'],
      nodeClick: 'rootToNode' as const,
      emphasis: {
        focus: 'descendant',
      },
      levels: [
        {},
        {
          // Inner ring — Routers
          r0: '18%',
          r: '52%',
          itemStyle: {
            borderWidth: 3,
            borderColor: '#fff',
            borderRadius: 6,
          },
          label: {
            rotate: 'tangential',
            fontSize: 11,
            fontWeight: 500,
            color: '#1f2937',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0,0,0,0.15)',
            },
          },
        },
        {
          // Outer ring — Interfaces (3% gap from inner)
          r0: '55%',
          r: '85%',
          itemStyle: {
            borderWidth: 2,
            borderColor: '#fff',
            borderRadius: 4,
          },
          label: {
            fontSize: 9,
            color: '#374151',
            minAngle: 15,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0,0,0,0.12)',
            },
          },
        },
      ],
      itemStyle: {
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
      },
      label: {
        show: true,
        formatter: '{b}',
      },
      animationType: 'expansion',
      animationDuration: 600,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 400,
    }],
    graphic: [{
      type: 'group',
      left: 'center',
      top: 'center',
      children: [
        {
          type: 'text',
          left: 'center',
          style: {
            text: data.name,
            fill: '#1f2937',
            fontSize: 14,
            fontWeight: 'bold' as const,
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: 20,
          style: {
            text: `${data.value?.toFixed(1)} Gbps`,
            fill: '#6b7280',
            fontSize: 12,
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: 38,
          style: {
            text: `${data.children?.length || 0} routers`,
            fill: '#9ca3af',
            fontSize: 10,
            textAlign: 'center',
          },
        },
      ],
    }],
  }), [data]);

  const onEvents = useMemo(() => ({
    click: (params: { treePathInfo?: { name: string }[] }) => {
      if (!params.treePathInfo || !onSegmentClickRef.current) return;
      const info = params.treePathInfo;
      // info[0] is virtual root, info[1] is router, info[2] is interface (if clicked)
      if (info.length === 2) {
        onSegmentClickRef.current({ routerName: info[1].name });
      } else if (info.length >= 3) {
        onSegmentClickRef.current({
          routerName: info[info.length - 2].name,
          interfaceName: info[info.length - 1].name,
        });
      }
    },
  }), []);

  return (
    <div style={{ cursor: 'pointer' }}>
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        style={{ height, width: '100%' }}
        onEvents={onEvents}
      />
    </div>
  );
}
