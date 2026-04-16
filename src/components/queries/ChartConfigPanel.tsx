import type { ChartConfig, ChartType, SqlResultColumn } from '../../types';
import styles from './ChartConfigPanel.module.css';

interface ChartConfigPanelProps {
  chartType: ChartType;
  config: ChartConfig;
  columns: SqlResultColumn[];
  onChange: (config: ChartConfig) => void;
}

function ColumnSelect({ label, value, columns, onChange, filter }: {
  label: string;
  value: string;
  columns: SqlResultColumn[];
  onChange: (val: string) => void;
  filter?: (col: SqlResultColumn) => boolean;
}) {
  const filtered = filter ? columns.filter(filter) : columns;
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {filtered.map(c => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </select>
    </div>
  );
}

function MultiColumnSelect({ label, values, columns, onChange, filter }: {
  label: string;
  values: string[];
  columns: SqlResultColumn[];
  onChange: (vals: string[]) => void;
  filter?: (col: SqlResultColumn) => boolean;
}) {
  const filtered = filter ? columns.filter(filter) : columns;
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <div className={styles.checkboxGroup}>
        {filtered.map(c => (
          <label key={c.key} className={styles.checkbox}>
            <input
              type="checkbox"
              checked={values.includes(c.key)}
              onChange={e => {
                if (e.target.checked) onChange([...values, c.key]);
                else onChange(values.filter(v => v !== c.key));
              }}
            />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max }: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
      />
    </div>
  );
}

function TextInput({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function RadioGroup({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <div className={styles.radioGroup}>
        {options.map(opt => (
          <label key={opt.value} className={styles.radio}>
            <input
              type="radio"
              name={label}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.checkboxInline}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        {label}
      </label>
    </div>
  );
}

const isNumeric = (c: SqlResultColumn) => c.type === 'number';
const isCategory = (c: SqlResultColumn) => c.type === 'string' || c.type === 'geo';
const isTime = (c: SqlResultColumn) => c.type === 'timestamp';

export function ChartConfigPanel({ chartType, config, columns, onChange }: ChartConfigPanelProps) {
  // Helper to update config while preserving the chartType
  const update = (partial: Partial<ChartConfig>) => {
    onChange({ ...config, ...partial } as ChartConfig);
  };

  switch (chartType) {
    case 'timeSeries':
    case 'stackedArea': {
      const c = config as Extract<ChartConfig, { chartType: 'timeSeries' | 'stackedArea' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="Time Column" value={c.timeColumn} columns={columns} onChange={v => update({ timeColumn: v })} filter={isTime} />
          <MultiColumnSelect label="Value Columns" values={c.valueColumns} columns={columns} onChange={v => update({ valueColumns: v })} filter={isNumeric} />
          <ColumnSelect label="Group By" value={c.groupByColumn || ''} columns={columns} onChange={v => update({ groupByColumn: v || undefined })} filter={isCategory} />
          <TextInput label="Y-Axis Label" value={c.yAxisLabel || ''} onChange={v => update({ yAxisLabel: v || undefined })} />
          <CheckboxField label="Show Trendline" checked={!!c.trendline} onChange={v => update({ trendline: v })} />
          <CheckboxField label="Show Threshold Line" checked={!!c.thresholdLine} onChange={v => update({ thresholdLine: v })} />
          {c.thresholdLine && (
            <NumberInput label="Threshold Value" value={c.thresholdValue ?? 0} onChange={v => update({ thresholdValue: v })} />
          )}
          {chartType === 'stackedArea' && (
            <CheckboxField label="Show Total Line" checked={!!c.showTotalLine} onChange={v => update({ showTotalLine: v })} />
          )}
        </div>
      );
    }

    case 'bar':
    case 'topNBar': {
      const c = config as Extract<ChartConfig, { chartType: 'bar' | 'topNBar' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="Category" value={c.categoryColumn} columns={columns} onChange={v => update({ categoryColumn: v })} filter={isCategory} />
          <ColumnSelect label="Value" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
          <RadioGroup
            label="Sort"
            value={c.sortOrder}
            options={[{ value: 'desc', label: 'Desc' }, { value: 'asc', label: 'Asc' }, { value: 'none', label: 'None' }]}
            onChange={v => update({ sortOrder: v as 'asc' | 'desc' | 'none' })}
          />
          <RadioGroup
            label="Orientation"
            value={c.orientation}
            options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }]}
            onChange={v => update({ orientation: v as 'vertical' | 'horizontal' })}
          />
          {(chartType === 'topNBar' || c.limit) && (
            <NumberInput label="Limit" value={c.limit || 10} onChange={v => update({ limit: v })} min={1} max={100} />
          )}
          <TextInput label="Y-Axis Label" value={c.yAxisLabel || ''} onChange={v => update({ yAxisLabel: v || undefined })} />
          <CheckboxField label="Show Threshold Line" checked={!!c.thresholdLine} onChange={v => update({ thresholdLine: v })} />
          {c.thresholdLine && (
            <NumberInput label="Threshold Value" value={c.thresholdValue ?? 0} onChange={v => update({ thresholdValue: v })} />
          )}
          <CheckboxField label="Show Value Labels" checked={!!c.showValueLabels} onChange={v => update({ showValueLabels: v })} />
        </div>
      );
    }

    case 'pie':
    case 'donut': {
      const c = config as Extract<ChartConfig, { chartType: 'pie' | 'donut' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="Category" value={c.categoryColumn} columns={columns} onChange={v => update({ categoryColumn: v })} filter={isCategory} />
          <ColumnSelect label="Value" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
          <NumberInput label="Limit" value={c.limit || 8} onChange={v => update({ limit: v })} min={2} max={20} />
          <RadioGroup
            label="Label Format"
            value={c.labelFormat || 'percentage'}
            options={[{ value: 'value', label: 'Value' }, { value: 'percentage', label: 'Percent' }, { value: 'both', label: 'Both' }]}
            onChange={v => update({ labelFormat: v as 'value' | 'percentage' | 'both' })}
          />
          <CheckboxField label="Show Value Labels" checked={!!c.showValueLabels} onChange={v => update({ showValueLabels: v })} />
        </div>
      );
    }

    case 'gauge': {
      const c = config as Extract<ChartConfig, { chartType: 'gauge' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="Value Column" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
          <TextInput label="Label" value={c.label} onChange={v => update({ label: v })} />
          <TextInput label="Unit" value={c.unit || ''} onChange={v => update({ unit: v || undefined })} />
          <div className={styles.row}>
            <NumberInput label="Min" value={c.min} onChange={v => update({ min: v })} />
            <NumberInput label="Max" value={c.max} onChange={v => update({ max: v })} />
          </div>
          <div className={styles.row}>
            <NumberInput label="Warning %" value={c.thresholds[0]} onChange={v => update({ thresholds: [v, c.thresholds[1]] })} min={0} max={100} />
            <NumberInput label="Critical %" value={c.thresholds[1]} onChange={v => update({ thresholds: [c.thresholds[0], v] })} min={0} max={100} />
          </div>
        </div>
      );
    }

    case 'singleValue': {
      const c = config as Extract<ChartConfig, { chartType: 'singleValue' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="Value Column" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
          <TextInput label="Label" value={c.label} onChange={v => update({ label: v })} />
          <TextInput label="Unit" value={c.unit || ''} onChange={v => update({ unit: v })} />
          <CheckboxField label="Show Comparison (vs. previous period)" checked={!!c.comparison} onChange={v => update({ comparison: v })} />
        </div>
      );
    }

    case 'heatmap': {
      const c = config as Extract<ChartConfig, { chartType: 'heatmap' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="X Axis" value={c.xColumn} columns={columns} onChange={v => update({ xColumn: v })} filter={isCategory} />
          <ColumnSelect label="Y Axis" value={c.yColumn} columns={columns} onChange={v => update({ yColumn: v })} filter={isCategory} />
          <ColumnSelect label="Value" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
          <TextInput label="X-Axis Label" value={c.xAxisLabel || ''} onChange={v => update({ xAxisLabel: v || undefined })} />
          <TextInput label="Y-Axis Label" value={c.yAxisLabel || ''} onChange={v => update({ yAxisLabel: v || undefined })} />
          <RadioGroup
            label="X Sort"
            value={c.xSort || 'none'}
            options={[{ value: 'asc', label: 'Asc' }, { value: 'desc', label: 'Desc' }, { value: 'none', label: 'None' }]}
            onChange={v => update({ xSort: v as 'asc' | 'desc' | 'none' })}
          />
          <RadioGroup
            label="Y Sort"
            value={c.ySort || 'none'}
            options={[{ value: 'asc', label: 'Asc' }, { value: 'desc', label: 'Desc' }, { value: 'none', label: 'None' }]}
            onChange={v => update({ ySort: v as 'asc' | 'desc' | 'none' })}
          />
        </div>
      );
    }

    case 'sankey': {
      const c = config as Extract<ChartConfig, { chartType: 'sankey' }>;
      const selectedDims = new Set((c.nodes ?? []).map(n => n.dimension));
      const catCols = columns.filter(isCategory);
      return (
        <div className={styles.panel}>
          <div className={styles.field}>
            <label>Node Levels (select columns in flow order, up to 10)</label>
            <div className={styles.checkboxGroup}>
              {catCols.map(col => (
                <label key={col.key} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={selectedDims.has(col.key)}
                    onChange={e => {
                      const current = c.nodes ?? [];
                      if (e.target.checked) {
                        update({ nodes: [...current, { dimension: col.key }].slice(0, 10) });
                      } else {
                        update({ nodes: current.filter(n => n.dimension !== col.key) });
                      }
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
          <ColumnSelect label="Value (flow weight)" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
        </div>
      );
    }

    case 'stackedBar':
    case 'groupedBar': {
      const c = config as Extract<ChartConfig, { chartType: 'stackedBar' | 'groupedBar' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="Category" value={c.categoryColumn} columns={columns} onChange={v => update({ categoryColumn: v })} filter={isCategory} />
          <ColumnSelect label="Value" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
          <ColumnSelect label="Group By" value={c.groupByColumn} columns={columns} onChange={v => update({ groupByColumn: v })} filter={isCategory} />
          <TextInput label="Y-Axis Label" value={c.yAxisLabel || ''} onChange={v => update({ yAxisLabel: v || undefined })} />
          <RadioGroup
            label="Sort"
            value={c.sortOrder || 'none'}
            options={[{ value: 'desc', label: 'Desc' }, { value: 'asc', label: 'Asc' }, { value: 'none', label: 'None' }]}
            onChange={v => update({ sortOrder: v as 'asc' | 'desc' | 'none' })}
          />
          <RadioGroup
            label="Orientation"
            value={c.orientation || 'vertical'}
            options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }]}
            onChange={v => update({ orientation: v as 'vertical' | 'horizontal' })}
          />
          <CheckboxField label="Show Value Labels" checked={!!c.showValueLabels} onChange={v => update({ showValueLabels: v })} />
          {chartType === 'stackedBar' && (
            <>
              <CheckboxField label="Show Total on Bar" checked={!!c.showTotalOnBar} onChange={v => update({ showTotalOnBar: v })} />
              <CheckboxField label="Show Segment Labels" checked={!!c.showSegmentLabels} onChange={v => update({ showSegmentLabels: v })} />
              {c.showSegmentLabels && (
                <RadioGroup
                  label="Segment Label Format"
                  value={c.segmentLabelFormat || 'value'}
                  options={[{ value: 'value', label: 'Value' }, { value: 'percentage', label: 'Percent' }]}
                  onChange={v => update({ segmentLabelFormat: v as 'value' | 'percentage' })}
                />
              )}
            </>
          )}
        </div>
      );
    }

    case 'geoMap': {
      const c = config as Extract<ChartConfig, { chartType: 'geoMap' }>;
      return (
        <div className={styles.panel}>
          <ColumnSelect label="Geo Column" value={c.geoColumn} columns={columns} onChange={v => update({ geoColumn: v })} filter={col => col.type === 'geo' || col.type === 'string'} />
          <ColumnSelect label="Value" value={c.valueColumn} columns={columns} onChange={v => update({ valueColumn: v })} filter={isNumeric} />
          <RadioGroup
            label="Geo Level"
            value={c.geoLevel || 'country'}
            options={[{ value: 'country', label: 'Country' }, { value: 'region', label: 'Region' }, { value: 'city', label: 'City' }]}
            onChange={v => update({ geoLevel: v as 'country' | 'region' | 'city' })}
          />
        </div>
      );
    }

    case 'table': {
      const c = config as Extract<ChartConfig, { chartType: 'table' }>;
      return (
        <div className={styles.panel}>
          <MultiColumnSelect label="Visible Columns" values={c.visibleColumns} columns={columns} onChange={v => update({ visibleColumns: v })} />
          <MultiColumnSelect
            label="Filterable Columns"
            values={c.filterColumns ?? []}
            columns={columns.filter(col => c.visibleColumns.includes(col.key))}
            onChange={v => update({ filterColumns: v })}
          />
          <ColumnSelect label="Default Sort Column" value={c.sortColumn || ''} columns={columns} onChange={v => update({ sortColumn: v || undefined })} />
          {c.sortColumn && (
            <RadioGroup
              label="Sort Direction"
              value={c.sortDirection || 'asc'}
              options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
              onChange={v => update({ sortDirection: v as 'asc' | 'desc' })}
            />
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
