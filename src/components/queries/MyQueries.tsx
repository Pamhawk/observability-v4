import { useState, useMemo, useRef, useCallback } from 'react';
import { Plus, MoreVertical, Edit2, Copy, Trash2, Search, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { Button, Modal, TimeRangeSelector, ExportDropdown } from '../common';
import { SqlQueryEditor } from './SqlQueryEditor';
import { QueryChart } from './QueryChart';
import { sampleQueries } from '../../data/mockData';
import { highlightSqlScript } from '../../utils/sqlHighlighter';
import type { Query, TimeRange } from '../../types';
import styles from './MyQueries.module.css';

type SortOption = 'name' | 'date' | 'graphType';

export function MyQueries() {
  const [queries, setQueries] = useState<Query[]>(sampleQueries.filter(q => !q.isDraft));
  const [drafts, setDrafts] = useState<Query[]>(sampleQueries.filter(q => q.isDraft));
  const [activeTab, setActiveTab] = useState<'queries' | 'drafts'>('queries');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [showNewEditor, setShowNewEditor] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));

  // Edit popup state
  const [showEditEditor, setShowEditEditor] = useState(false);
  const [editingQuery, setEditingQuery] = useState<Query | null>(null);

  // Clone dialog state
  const [cloneTarget, setCloneTarget] = useState<Query | null>(null);
  const [cloneName, setCloneName] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Query | null>(null);

  // Track current new-editor data for auto-save-as-draft on outside click
  const newEditorDataRef = useRef<Partial<Query>>({});
  const handleNewEditorChange = useCallback((data: Partial<Query>) => {
    newEditorDataRef.current = data;
  }, []);

  const currentList = activeTab === 'queries' ? queries : drafts;

  const filteredList = useMemo(() => {
    const filtered = currentList.filter(q =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime();
        case 'graphType':
          return a.graphType.localeCompare(b.graphType);
        default:
          return 0;
      }
    });
  }, [currentList, search, sortBy]);

  const handleNewQuery = () => {
    setShowNewEditor(true);
  };

  const handleOpenEditModal = (query: Query) => {
    setSelectedQuery(query);
    setEditingQuery(query);
    setShowEditEditor(true);
    setMenuOpenId(null);
  };

  const handleCloneRequest = (query: Query) => {
    setCloneTarget(query);
    setCloneName(`${query.name} (Copy)`);
    setMenuOpenId(null);
  };

  const handleCloneConfirm = () => {
    if (!cloneTarget) return;
    const clonedQuery: Query = {
      ...cloneTarget,
      id: `query-${Date.now()}`,
      name: cloneName || `${cloneTarget.name} (Copy)`,
      lastEdited: new Date().toISOString(),
    };

    if (cloneTarget.isDraft) {
      setDrafts([...drafts, clonedQuery]);
    } else {
      setQueries([...queries, clonedQuery]);
    }
    setCloneTarget(null);
    setCloneName('');
  };

  const handleDeleteRequest = (query: Query) => {
    setDeleteTarget(query);
    setMenuOpenId(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.isDraft) {
      setDrafts(drafts.filter(q => q.id !== deleteTarget.id));
    } else {
      setQueries(queries.filter(q => q.id !== deleteTarget.id));
    }
    if (selectedQuery?.id === deleteTarget.id) {
      setSelectedQuery(null);
      setShowEditEditor(false);
      setEditingQuery(null);
    }
    setDeleteTarget(null);
  };

  // Save handler for NEW queries (from popup)
  const handleSaveNewQuery = (queryData: Partial<Query>) => {
    const newQuery: Query = {
      id: `query-${Date.now()}`,
      name: queryData.name || 'Untitled',
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || 'bar',
      widgets: queryData.widgets || [],
      isDraft: false,
      lastEdited: new Date().toISOString(),
      createdBy: 'user-1',
    };
    setQueries([...queries, newQuery]);
    setShowNewEditor(false);
  };

  const handleSaveNewAsDraft = (queryData: Partial<Query>) => {
    const newDraft: Query = {
      id: `draft-${Date.now()}`,
      name: queryData.name || 'Untitled',
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || 'bar',
      widgets: queryData.widgets || [],
      isDraft: true,
      lastEdited: new Date().toISOString(),
      createdBy: 'user-1',
    };
    setDrafts([...drafts, newDraft]);
    setShowNewEditor(false);
  };

  // Auto-save as draft when clicking outside the new query editor
  const handleNewEditorBackdropClick = () => {
    const data = newEditorDataRef.current;
    if (data.script || data.name) {
      handleSaveNewAsDraft(data);
    } else {
      setShowNewEditor(false);
    }
    newEditorDataRef.current = {};
  };

  // Save handler for EDIT popup (existing queries)
  const handleEditSave = (queryData: Partial<Query>) => {
    if (!editingQuery) return;
    const updatedQuery: Query = {
      ...editingQuery,
      name: queryData.name || editingQuery.name,
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || editingQuery.graphType,
      widgets: queryData.widgets ?? editingQuery.widgets,
      isDraft: false,
      lastEdited: new Date().toISOString(),
    };

    // Remove from old list
    if (editingQuery.isDraft) {
      setDrafts(drafts.filter(q => q.id !== editingQuery.id));
    } else {
      setQueries(queries.filter(q => q.id !== editingQuery.id));
    }
    setQueries(prev => [...prev, updatedQuery]);
    setSelectedQuery(updatedQuery);
    setShowEditEditor(false);
    setEditingQuery(null);
  };

  const handleEditSaveAsDraft = (queryData: Partial<Query>) => {
    if (!editingQuery) return;
    const updatedDraft: Query = {
      ...editingQuery,
      name: queryData.name || editingQuery.name,
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || editingQuery.graphType,
      widgets: queryData.widgets ?? editingQuery.widgets,
      isDraft: true,
      lastEdited: new Date().toISOString(),
    };

    // Remove from old list
    setDrafts(drafts.filter(q => q.id !== editingQuery.id));
    setQueries(queries.filter(q => q.id !== editingQuery.id));
    setDrafts(prev => [...prev, updatedDraft]);
    setSelectedQuery(updatedDraft);
    setShowEditEditor(false);
    setEditingQuery(null);
  };

  const handleEditCancel = () => {
    setShowEditEditor(false);
    setEditingQuery(null);
  };

  // Syntax-highlighted script for preview
  const highlightedScript = useMemo(() => {
    if (!selectedQuery) return '';
    return highlightSqlScript(selectedQuery.script);
  }, [selectedQuery]);

  const renderWidgetList = (query: Query) => {
    const widgets = query.widgets || [];
    if (widgets.length === 0) {
      return (
        <div className={styles.noWidgets}>
          <p>No widgets yet — open the editor to create some.</p>
        </div>
      );
    }
    return (
      <div className={styles.widgetGrid}>
        {widgets.map(widget => (
          <div key={widget.id} className={styles.widgetPreviewCard}>
            <div className={styles.widgetPreviewHeader}>
              <span className={styles.widgetPreviewName}>{widget.name}</span>
              <span className={styles.widgetPreviewType}>{widget.graphType}</span>
            </div>
            <div className={styles.widgetPreviewChart}>
              <QueryChart
                script={query.script}
                height={180}
                title={widget.name}
                timePreset={timeRange.preset}
                chartConfig={widget.chartConfig}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <ExportDropdown />
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={handleNewQuery}
        >
          New Query
        </Button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Left: Query List */}
        <div className={styles.listPanel}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'queries' ? styles.active : ''}`}
              onClick={() => setActiveTab('queries')}
            >
              Queries ({queries.length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'drafts' ? styles.active : ''}`}
              onClick={() => setActiveTab('drafts')}
            >
              Drafts ({drafts.length})
            </button>
          </div>

          {/* Search + Sort */}
          <div className={styles.searchSortRow}>
            <div className={styles.searchWrapper}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search queries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.sortWrapper}>
              <ArrowUpDown size={14} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className={styles.sortSelect}
              >
                <option value="date">Date modified</option>
                <option value="name">Name</option>
                <option value="graphType">Graph type</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className={styles.list}>
            {filteredList.map((query) => (
              <div
                key={query.id}
                className={`${styles.listItem} ${selectedQuery?.id === query.id ? styles.selected : ''}`}
                onClick={() => setSelectedQuery(query)}
                onDoubleClick={() => handleOpenEditModal(query)}
              >
                <div className={styles.listItemInfo}>
                  <span className={styles.queryName}>
                    {query.name}
                    {query.isDraft && <span className={styles.draftTag}>Draft</span>}
                  </span>
                  <span className={styles.queryDescription} title={query.description}>{query.description}</span>
                  <span className={styles.queryDate}>{formatDate(query.lastEdited)}</span>
                </div>
                <div className={styles.listItemActions}>
                  <button
                    className={styles.menuBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === query.id ? null : query.id);
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpenId === query.id && (
                    <div className={styles.menu}>
                      <button onClick={() => handleOpenEditModal(query)}>
                        <Edit2 size={14} /> Edit Query
                      </button>
                      <button onClick={() => handleCloneRequest(query)}>
                        <Copy size={14} /> Clone
                      </button>
                      <button className={styles.danger} onClick={() => handleDeleteRequest(query)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredList.length === 0 && (
              <div className={styles.emptyState}>
                <p>No {activeTab} found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className={styles.previewPanel}>
          {selectedQuery ? (
            <div
              className={styles.preview}
              onDoubleClick={() => handleOpenEditModal(selectedQuery)}
              title="Double-click to edit"
            >
              <div className={styles.previewHeader}>
                <div className={styles.previewTitleRow}>
                  <div>
                    <h3>
                      {selectedQuery.name}
                      {selectedQuery.isDraft && <span className={styles.draftTag}>Draft</span>}
                    </h3>
                    <p>{selectedQuery.description}</p>
                  </div>
                  <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                </div>
                <div className={styles.previewMeta}>
                  <span>Type: {selectedQuery.graphType}</span>
                  <span>Last edited: {formatDate(selectedQuery.lastEdited)}</span>
                </div>
              </div>
              <div className={styles.previewBody}>
                <div className={styles.previewScript}>
                  <pre dangerouslySetInnerHTML={{ __html: highlightedScript }} />
                </div>
                <div className={styles.previewChart}>
                  {renderWidgetList(selectedQuery)}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.previewPlaceholder}>
              <p>Select a query to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* New Query Modal — clicking outside auto-saves as draft */}
      <Modal
        isOpen={showNewEditor}
        onClose={() => setShowNewEditor(false)}
        onBackdropClick={handleNewEditorBackdropClick}
        title="New Query"
        size="full"
        showClose={false}
      >
        <SqlQueryEditor
          onSave={handleSaveNewQuery}
          onSaveAsDraft={handleSaveNewAsDraft}
          onCancel={() => { setShowNewEditor(false); newEditorDataRef.current = {}; }}
          onChange={handleNewEditorChange}
        />
      </Modal>

      {/* Edit Query Modal */}
      <Modal
        isOpen={showEditEditor}
        onClose={handleEditCancel}
        title="Edit Query"
        size="full"
        showClose={false}
      >
        <SqlQueryEditor
          query={editingQuery ?? undefined}
          onSave={handleEditSave}
          onSaveAsDraft={handleEditSaveAsDraft}
          onCancel={handleEditCancel}
        />
      </Modal>

      {/* Clone Naming Dialog */}
      <Modal
        isOpen={cloneTarget !== null}
        onClose={() => setCloneTarget(null)}
        title="Clone Query"
        size="sm"
      >
        <div className={styles.dialogContent}>
          <label className={styles.dialogLabel}>Name</label>
          <input
            type="text"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            className={styles.dialogInput}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCloneConfirm(); }}
          />
          <div className={styles.dialogActions}>
            <Button variant="ghost" size="sm" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Edit2 size={14} />}
              onClick={() => {
                if (!cloneTarget) return;
                const cloned: Query = {
                  ...cloneTarget,
                  id: `query-${Date.now()}`,
                  name: cloneName || `${cloneTarget.name} (Copy)`,
                  lastEdited: new Date().toISOString(),
                };
                setCloneTarget(null);
                setCloneName('');
                setEditingQuery(cloned);
                setSelectedQuery(cloned);
                setShowEditEditor(true);
                if (cloned.isDraft) {
                  setDrafts(prev => [...prev, cloned]);
                } else {
                  setQueries(prev => [...prev, cloned]);
                }
              }}
            >
              Edit
            </Button>
            <Button variant="primary" size="sm" onClick={handleCloneConfirm}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Query"
        size="sm"
      >
        <div className={styles.dialogContent}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
            <AlertTriangle size={24} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 var(--spacing-xs)', fontWeight: 500 }}>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                This action cannot be undone. The query and all associated widgets will be permanently removed.
              </p>
            </div>
          </div>
          <div className={styles.dialogActions}>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className={styles.deleteBtn} onClick={handleDeleteConfirm}>
              Delete Query
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
