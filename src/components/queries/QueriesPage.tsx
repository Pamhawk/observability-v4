import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout';
import {
  Plus, Save, Edit2, Trash2, Download, MoreVertical, Pencil,
  ChevronDown, FilePlus, ExternalLink, AlertTriangle, Camera,
} from 'lucide-react';
import { AddQueryPopup, type WidgetSelection } from './AddQueryPopup';
import { SaveDashboardPopup } from './SaveDashboardPopup';
import { SqlQueryEditor } from './SqlQueryEditor';
import { Button, Card, Modal, TimeRangeSelector, ExportDropdown } from '../common';
import { QueryChart } from './QueryChart';
import { sampleQueries } from '../../data/mockData';
import type { Query, TimeRange, Dashboard } from '../../types';

// Auto-sizing chart wrapper that fills its container
function AutoSizeChart({ script, title, timePreset, chartConfig }: { script: string; title?: string; timePreset?: string; chartConfig?: import('../../types').ChartConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Immediate measurement
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) setHeight(Math.floor(rect.height));

    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const h = Math.floor(entry.contentRect.height);
        if (h > 0) setHeight(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', minHeight: 0 }}>
      {height > 0 ? (
        <QueryChart script={script} height={height} title={title} timePreset={timePreset} chartConfig={chartConfig} />
      ) : (
        <QueryChart script={script} height={200} title={title} timePreset={timePreset} chartConfig={chartConfig} />
      )}
    </div>
  );
}
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import styles from './QueriesPage.module.css';

interface DashboardWidget {
  id: string;
  queryId: string;
  widgetId: string;
}

interface DashboardState {
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  layouts: ResponsiveLayouts;
}

export function QueriesPage() {
  const isFullscreen = new URLSearchParams(window.location.search).get('view') === 'fullscreen';
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));

  // Query state (shared between dashboard and my queries)
  const [queries, setQueries] = useState<Query[]>(sampleQueries);

  // Load saved dashboards from localStorage
  const [savedDashboards, setSavedDashboards] = useState<DashboardState[]>(() => {
    try {
      const stored = localStorage.getItem('observability_dashboards');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Load last active dashboard from localStorage
  const [dashboard, setDashboard] = useState<Dashboard | null>(() => {
    try {
      const stored = localStorage.getItem('observability_dashboards');
      const activeId = localStorage.getItem('observability_active_dashboard');
      if (stored && activeId) {
        const all: DashboardState[] = JSON.parse(stored);
        const active = all.find(s => s.dashboard.id === activeId);
        return active?.dashboard || null;
      }
      return null;
    } catch { return null; }
  });
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    try {
      const stored = localStorage.getItem('observability_dashboards');
      const activeId = localStorage.getItem('observability_active_dashboard');
      if (stored && activeId) {
        const all: DashboardState[] = JSON.parse(stored);
        const active = all.find(s => s.dashboard.id === activeId);
        return active?.widgets || [];
      }
      return [];
    } catch { return []; }
  });
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    try {
      const stored = localStorage.getItem('observability_dashboards');
      const activeId = localStorage.getItem('observability_active_dashboard');
      if (stored && activeId) {
        const all: DashboardState[] = JSON.parse(stored);
        const active = all.find(s => s.dashboard.id === activeId);
        return active?.layouts || { lg: [], md: [], sm: [], xs: [], xxs: [] };
      }
      return { lg: [], md: [], sm: [], xs: [], xxs: [] };
    } catch { return { lg: [], md: [], sm: [], xs: [], xxs: [] }; }
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Persist dashboards to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('observability_dashboards', JSON.stringify(savedDashboards));
  }, [savedDashboards]);

  // Persist active dashboard ID
  useEffect(() => {
    if (dashboard) {
      localStorage.setItem('observability_active_dashboard', dashboard.id);
    } else {
      localStorage.removeItem('observability_active_dashboard');
    }
  }, [dashboard]);

  // Dashboard selector
  const [showDashboardSelector, setShowDashboardSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showAddQuery, setShowAddQuery] = useState(false);
  const [showSaveDashboard, setShowSaveDashboard] = useState(false);
  const [showRenameDashboard, setShowRenameDashboard] = useState(false);
  const [showDeleteDashboard, setShowDeleteDashboard] = useState(false);
  const [showEditQuery, setShowEditQuery] = useState(false);
  const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [widgetMenuOpenId, setWidgetMenuOpenId] = useState<string | null>(null);

  const { width: rawContainerWidth, containerRef, mounted } = useContainerWidth();
  // Guard against width=0 during HMR/tab-switch; prevents xxs breakpoint corruption
  const containerWidth = Math.max(rawContainerWidth, 480);

  // Close dashboard selector on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setShowDashboardSelector(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add widgets to dashboard
  const handleAddQueries = useCallback((selections: WidgetSelection[]) => {
    const newWidgets: DashboardWidget[] = selections.map(sel => ({
      id: `widget-${Date.now()}-${sel.widgetId}`,
      queryId: sel.queryId,
      widgetId: sel.widgetId,
    }));

    const existingCount = widgets.length;

    // Generate layout items for each breakpoint with appropriate sizing
    const colsMap: Record<string, number> = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
    const newLayoutsByBp: ResponsiveLayouts = {};

    for (const [bp, cols] of Object.entries(colsMap)) {
      const itemW = cols >= 6 ? 6 : cols; // 2 per row when >=6 cols, full-width otherwise
      const perRow = Math.max(1, Math.floor(cols / itemW));
      newLayoutsByBp[bp] = newWidgets.map((w, i) => ({
        i: w.id,
        x: ((existingCount + i) % perRow) * itemW,
        y: Math.floor((existingCount + i) / perRow) * 4,
        w: itemW,
        h: 4,
        minW: Math.min(3, cols),
        minH: 3,
      }));
    }

    setWidgets(prev => [...prev, ...newWidgets]);
    setLayouts(prev => {
      const merged: ResponsiveLayouts = {};
      for (const bp of Object.keys(colsMap)) {
        merged[bp] = [...(prev[bp] || []), ...(newLayoutsByBp[bp] || [])];
      }
      return merged;
    });
    setHasUnsavedChanges(true);
    setShowAddQuery(false);
  }, [widgets.length]);

  // Remove widget from dashboard (does NOT delete query)
  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setLayouts(prev => {
      const cleaned: ResponsiveLayouts = {};
      for (const [bp, items] of Object.entries(prev)) {
        (cleaned as Record<string, any[]>)[bp] = (items as any[]).filter((l: any) => l.i !== widgetId);
      }
      return cleaned;
    });
    setHasUnsavedChanges(true);
    setWidgetMenuOpenId(null);
  }, []);

  // Edit query from dashboard widget
  const handleEditWidgetQuery = useCallback((queryId: string, widgetId: string) => {
    setEditingQueryId(queryId);
    setEditingWidgetId(widgetId);
    setShowEditQuery(true);
    setWidgetMenuOpenId(null);
  }, []);

  // Save query edit (also updates in my queries)
  const handleSaveQueryEdit = useCallback((queryData: Partial<Query>) => {
    if (!editingQueryId) return;
    setQueries(prev => prev.map(q =>
      q.id === editingQueryId
        ? { ...q, ...queryData, lastEdited: new Date().toISOString() }
        : q
    ));
    setShowEditQuery(false);
    setEditingQueryId(null);
    setEditingWidgetId(null);
    setHasUnsavedChanges(true);
  }, [editingQueryId]);

  // Layout change handler — skip saving when container width is too small (prevents corrupted layouts)
  const handleLayoutChange = useCallback((_layout: Layout, allLayouts: ResponsiveLayouts) => {
    if (rawContainerWidth < 480) return;
    setLayouts(allLayouts);
    setHasUnsavedChanges(true);
  }, [rawContainerWidth]);

  // Save dashboard
  const handleSaveDashboard = useCallback((name: string, description: string) => {
    const newDashboard: Dashboard = {
      id: dashboard?.id || `dashboard-${Date.now()}`,
      name,
      description,
      queries: widgets.map(w => w.queryId),
      layout: (layouts.lg || []).map(l => ({
        queryId: widgets.find(w => w.id === l.i)?.queryId || '',
        x: l.x,
        y: l.y,
        width: l.w,
        height: l.h,
      })),
      createdBy: 'user-1',
      lastEdited: new Date().toISOString(),
    };
    setDashboard(newDashboard);
    setHasUnsavedChanges(false);
    setShowSaveDashboard(false);
    setShowRenameDashboard(false);

    // Upsert into savedDashboards
    const state: DashboardState = { dashboard: newDashboard, widgets, layouts };
    setSavedDashboards(prev => {
      const idx = prev.findIndex(s => s.dashboard.id === newDashboard.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = state;
        return next;
      }
      return [...prev, state];
    });
  }, [dashboard, widgets, layouts]);

  // Handle save button click
  const handleSaveClick = useCallback(() => {
    if (dashboard) {
      // Existing dashboard: just save silently
      handleSaveDashboard(dashboard.name, dashboard.description);
    } else {
      // New dashboard: show name popup
      setShowSaveDashboard(true);
    }
  }, [dashboard, handleSaveDashboard]);

  // Switch to a saved dashboard
  const handleSwitchDashboard = useCallback((dashboardId: string) => {
    const saved = savedDashboards.find(s => s.dashboard.id === dashboardId);
    if (!saved) return;
    setDashboard(saved.dashboard);
    setWidgets(saved.widgets);
    setLayouts(saved.layouts);
    setHasUnsavedChanges(false);
    setShowDashboardSelector(false);
  }, [savedDashboards]);

  // Create a new dashboard
  const handleNewDashboard = useCallback(() => {
    setDashboard(null);
    setWidgets([]);
    setLayouts({ lg: [], md: [], sm: [], xs: [], xxs: [] });
    setHasUnsavedChanges(false);
    setShowDashboardSelector(false);
  }, []);

  // Delete current dashboard
  const handleDeleteDashboard = useCallback(() => {
    if (!dashboard) return;
    setSavedDashboards(prev => prev.filter(s => s.dashboard.id !== dashboard.id));
    setDashboard(null);
    setWidgets([]);
    setLayouts({ lg: [], md: [], sm: [], xs: [], xxs: [] });
    setHasUnsavedChanges(false);
    setShowDeleteDashboard(false);
  }, [dashboard]);

  // Render auto-sizing chart for dashboard widgets
  const renderWidgetChart = (widget: DashboardWidget, query: Query) => {
    const queryWidget = (query.widgets || []).find(w => w.id === widget.widgetId);
    const chartConfig = queryWidget?.chartConfig ?? query.chartConfig;
    const title = queryWidget?.name ?? query.name;
    return <AutoSizeChart script={query.script} title={title} timePreset={timeRange.preset} chartConfig={chartConfig} />;
  };

  const renderDashboard = () => (
    <div className={styles.dashboard}>
      {/* Dashboard header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.dashboardTitleArea}>
          {dashboard ? (
            <div className={styles.dashboardNameRow}>
              {savedDashboards.length > 0 ? (
                <div className={styles.dashboardSelector} ref={selectorRef}>
                  <button
                    className={styles.dashboardSelectorBtn}
                    onClick={() => setShowDashboardSelector(!showDashboardSelector)}
                    title={dashboard.description || undefined}
                  >
                    <h2>{dashboard.name}</h2>
                    <ChevronDown size={16} className={showDashboardSelector ? styles.chevronOpen : ''} />
                  </button>
                  {showDashboardSelector && (
                    <div className={styles.dashboardDropdown}>
                      {savedDashboards.map(s => (
                        <button
                          key={s.dashboard.id}
                          className={`${styles.dashboardOption} ${s.dashboard.id === dashboard.id ? styles.activeOption : ''}`}
                          onClick={() => handleSwitchDashboard(s.dashboard.id)}
                        >
                          <span className={styles.dashboardOptionName}>{s.dashboard.name}</span>
                          {s.dashboard.description && (
                            <span className={styles.dashboardOptionDesc}>{s.dashboard.description}</span>
                          )}
                        </button>
                      ))}
                      <div className={styles.dashboardDropdownDivider} />
                      <button
                        className={styles.dashboardOption}
                        onClick={() => { setShowDashboardSelector(false); setShowRenameDashboard(true); }}
                      >
                        <Pencil size={14} />
                        <span className={styles.dashboardOptionName}>Rename Dashboard</span>
                      </button>
                      <button
                        className={styles.dashboardOption}
                        onClick={handleNewDashboard}
                      >
                        <FilePlus size={14} />
                        <span className={styles.dashboardOptionName}>New Dashboard</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <h2 title={dashboard.description || undefined}>{dashboard.name}</h2>
              )}
              {!isFullscreen && (
                <>
                  <button
                    className={styles.renameBtn}
                    onClick={() => setShowRenameDashboard(true)}
                    title="Rename dashboard"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className={`${styles.renameBtn} ${styles.deleteDashboardBtn}`}
                    onClick={() => setShowDeleteDashboard(true)}
                    title="Delete dashboard"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className={styles.dashboardNameRow}>
              {savedDashboards.length > 0 ? (
                <div className={styles.dashboardSelector} ref={selectorRef}>
                  <button
                    className={styles.dashboardSelectorBtn}
                    onClick={() => setShowDashboardSelector(!showDashboardSelector)}
                  >
                    <h2>New Dashboard</h2>
                    <ChevronDown size={16} className={showDashboardSelector ? styles.chevronOpen : ''} />
                  </button>
                  {showDashboardSelector && (
                    <div className={styles.dashboardDropdown}>
                      {savedDashboards.map(s => (
                        <button
                          key={s.dashboard.id}
                          className={styles.dashboardOption}
                          onClick={() => handleSwitchDashboard(s.dashboard.id)}
                        >
                          <span className={styles.dashboardOptionName}>{s.dashboard.name}</span>
                          {s.dashboard.description && (
                            <span className={styles.dashboardOptionDesc}>{s.dashboard.description}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <h2>New Dashboard</h2>
              )}
            </div>
          )}
          {hasUnsavedChanges && !isFullscreen && (
            <span className={styles.unsavedBadge}>Unsaved changes</span>
          )}
        </div>
        <div className={styles.dashboardActions}>
          <ExportDropdown />
          <TimeRangeSelector value={timeRange} onChange={(tr) => { setTimeRange(tr); setHasUnsavedChanges(true); }} />
          {!isFullscreen && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={() => setShowAddQuery(true)}
              >
                Add
              </Button>
              {(hasUnsavedChanges || widgets.length > 0) && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save size={16} />}
                  onClick={handleSaveClick}
                >
                  Save
                </Button>
              )}
              {dashboard && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ExternalLink size={16} />}
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('view', 'fullscreen');
                    window.open(url.toString(), '_blank');
                  }}
                  title="Open in new tab (control room mode)"
                >
                  New Tab
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dashboard grid */}
      <div ref={containerRef} className={styles.gridContainer}>
        {widgets.length > 0 && mounted ? (
          <ResponsiveGridLayout
            className={styles.grid}
            width={containerWidth}
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={80}
            onLayoutChange={handleLayoutChange}
            dragConfig={{ enabled: !isFullscreen, handle: `.${styles.widgetDragHandle}`, bounded: false, threshold: 3 }}
            resizeConfig={{ enabled: !isFullscreen, handles: ['se'] }}
          >
            {widgets.map(widget => {
              const query = queries.find(q => q.id === widget.queryId);
              if (!query) return null;

              const queryWidget = (query.widgets || []).find(w => w.id === widget.widgetId);
              const widgetTitle = queryWidget?.name ?? query.name;
              return (
                <div key={widget.id} className={styles.widgetWrapper} data-widget-id={widget.id}>
                  <Card
                    className={styles.widget}
                    noPadding
                    title={widgetTitle}
                    actions={isFullscreen ? undefined :
                      <div className={styles.widgetActions}>
                        <div className={`${styles.widgetDragHandle}`} title="Drag to move">
                          <span className={styles.dragIcon}>⠿</span>
                        </div>
                        <div className={styles.widgetMenuWrapper}>
                          <button
                            className={styles.widgetMenuBtn}
                            onClick={() => setWidgetMenuOpenId(
                              widgetMenuOpenId === widget.id ? null : widget.id
                            )}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {widgetMenuOpenId === widget.id && (
                            <div className={styles.widgetMenu}>
                              <button onClick={() => handleEditWidgetQuery(widget.queryId, widget.widgetId)}>
                                <Edit2 size={14} /> Edit Query
                              </button>
                              <button onClick={() => {
                                const wrapper = document.querySelector(`[data-widget-id="${widget.id}"]`);
                                const canvas = wrapper?.querySelector('canvas') as HTMLCanvasElement | null;
                                if (canvas) {
                                  const link = document.createElement('a');
                                  link.download = `${widgetTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
                                  link.href = canvas.toDataURL('image/png');
                                  link.click();
                                }
                                setWidgetMenuOpenId(null);
                              }}>
                                <Download size={14} /> Download PNG
                              </button>
                              <button
                                className={styles.danger}
                                onClick={() => handleRemoveWidget(widget.id)}
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                  >
                    <div className={styles.widgetChart}>
                      {renderWidgetChart(widget, query)}
                      <button
                        className={styles.widgetPngBtn}
                        title="Download as PNG"
                        onClick={() => {
                          const wrapper = document.querySelector(`[data-widget-id="${widget.id}"]`);
                          const canvas = wrapper?.querySelector('canvas') as HTMLCanvasElement | null;
                          if (!canvas) return;
                          const link = document.createElement('a');
                          link.download = `${widgetTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
                          link.href = canvas.toDataURL('image/png');
                          link.click();
                        }}
                      >
                        <Camera size={14} />
                      </button>
                    </div>
                  </Card>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        ) : (
          <div className={styles.emptyDashboard}>
            <div className={styles.emptyContent}>
              <Plus size={48} strokeWidth={1} />
              <h3>No widgets yet</h3>
              <p>Add queries from "My Queries" to build your dashboard</p>
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => setShowAddQuery(true)}
              >
                Add Query
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Query Popup */}
      <Modal
        isOpen={showAddQuery}
        onClose={() => setShowAddQuery(false)}
        title="Add Queries to Dashboard"
        size="xl"
      >
        <AddQueryPopup
          queries={queries}
          onAdd={handleAddQueries}
          onCancel={() => setShowAddQuery(false)}
        />
      </Modal>

      {/* Save Dashboard Popup (first save) */}
      <Modal
        isOpen={showSaveDashboard}
        onClose={() => setShowSaveDashboard(false)}
        title="Save Dashboard"
        size="sm"
      >
        <SaveDashboardPopup
          onSave={handleSaveDashboard}
          onCancel={() => setShowSaveDashboard(false)}
        />
      </Modal>

      {/* Rename Dashboard Popup */}
      <Modal
        isOpen={showRenameDashboard}
        onClose={() => setShowRenameDashboard(false)}
        title="Rename Dashboard"
        size="sm"
      >
        <SaveDashboardPopup
          initialName={dashboard?.name}
          initialDescription={dashboard?.description}
          onSave={handleSaveDashboard}
          onCancel={() => setShowRenameDashboard(false)}
        />
      </Modal>

      {/* Delete Dashboard Confirmation */}
      <Modal
        isOpen={showDeleteDashboard}
        onClose={() => setShowDeleteDashboard(false)}
        title="Delete Dashboard"
        size="sm"
      >
        <div style={{ padding: 'var(--spacing-md) var(--spacing-lg) var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <AlertTriangle size={24} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 var(--spacing-sm)', fontWeight: 500 }}>
                Are you sure you want to delete "{dashboard?.name}"?
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                This action cannot be undone. All widgets and layout configuration for this dashboard will be permanently removed.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteDashboard(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteDashboard}
              style={{ backgroundColor: 'var(--color-error)', borderColor: 'var(--color-error)' }}
            >
              Delete Dashboard
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Query from Dashboard */}
      <Modal
        isOpen={showEditQuery}
        onClose={() => { setShowEditQuery(false); setEditingQueryId(null); setEditingWidgetId(null); }}
        title="Edit Query"
        size="full"
      >
        <SqlQueryEditor
          query={queries.find(q => q.id === editingQueryId) || null}
          onSave={handleSaveQueryEdit}
          onSaveAsDraft={() => { setShowEditQuery(false); setEditingQueryId(null); setEditingWidgetId(null); }}
          onCancel={() => { setShowEditQuery(false); setEditingQueryId(null); setEditingWidgetId(null); }}
          initialExpandedWidgetId={editingWidgetId || undefined}
        />
      </Modal>
    </div>
  );

  return (
    <div className={`${styles.container} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Content */}
      <div className={styles.content}>
        {renderDashboard()}
      </div>
    </div>
  );
}
