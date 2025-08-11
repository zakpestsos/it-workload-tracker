import React, { useEffect, useMemo, useState } from 'react';
import { GoogleSheetsIntegration } from '../components/GoogleSheetsIntegration';
import { googleSheetsService } from '../services/googleSheetsService';

type BucketKey = 'profiles' | 'contracts' | 'projects';

export type WorkItem = {
  id: string;
  name: string;
  owner: string;
  status: 'Not Started' | 'In Progress' | 'Blocked' | 'Done';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  startDate?: string; // ISO
  dueDate?: string; // ISO
  notes?: string;
  progress?: number;
  createdAt?: string;
  collapsed?: boolean;
};

export type TicketSummary = {
  total: number;
  completed: number;
  open: number;
  pending: number;
  lastImportedAt?: string;
  meta?: 'ticket-list' | 'group-summary';
  breakdown?: Array<{ label: string; values: Record<string, number> }>;
  clientResolved?: number;
  employeeResolved?: number;
};

type Store = {
  profiles: WorkItem[];
  contracts: WorkItem[];
  projects: WorkItem[];
  tickets?: TicketSummary;
};

const defaultStore: Store = {
  profiles: [],
  contracts: [],
  projects: [],
  tickets: { total: 0, completed: 0, open: 0, pending: 0 }
};

const STORAGE_KEY = 'it-workload-tracker-v1';

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore;
    const parsed = JSON.parse(raw);
    return { ...defaultStore, ...parsed } as Store;
  } catch {
    return defaultStore;
  }
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function formatTimeLeft(due?: string) {
  if (!due) return '—';
  const now = new Date();
  const end = new Date(due);
  const ms = end.getTime() - now.getTime();
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0 && hours === 0) return sign + '<1h';
  if (days === 0) return `${sign}${hours}h`;
  return `${sign}${days}d ${hours}h`;
}

function calcProgress(item: WorkItem): number {
  if (!item.startDate || !item.dueDate) return item.status === 'Done' ? 100 : 0;
  const start = new Date(item.startDate).getTime();
  const due = new Date(item.dueDate).getTime();
  const now = Date.now();
  if (due <= start) return item.status === 'Done' ? 100 : 0;
  const ratio = (now - start) / (due - start);
  const clamped = Math.max(0, Math.min(1, ratio));
  const base = clamped * 100;
  if (item.status === 'Done') return 100;
  if (item.status === 'Blocked') return Math.max(5, Math.min(95, base));
  return base;
}

function priorityClass(priority: WorkItem['priority']) {
  switch (priority) {
    case 'Critical': return 'danger';
    case 'High': return 'warning';
    case 'Medium': return 'success';
    default: return '';
  }
}

const ownersDefault = ['Dagan', 'Zak', 'IT Team'];

export const App: React.FC = () => {
  const [store, setStore] = useState<Store>(() => loadStore());
  const [owners, setOwners] = useState<string[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY + '-owners');
    return raw ? JSON.parse(raw) : ownersDefault;
  });
  const [filter, setFilter] = useState<string>('');
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '-owners', JSON.stringify(owners));
  }, [owners]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Ensure tick is used so React updates countdowns
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tick;

  const totals = useMemo(() => {
    const keys: BucketKey[] = ['profiles', 'contracts', 'projects'];
    const byKey = Object.fromEntries(keys.map(k => [k, store[k].length])) as Record<BucketKey, number>;
    const doneByKey = Object.fromEntries(keys.map(k => [k, store[k].filter(i => i.status === 'Done').length])) as Record<BucketKey, number>;
    const inProgressByKey = Object.fromEntries(keys.map(k => [k, store[k].filter(i => i.status === 'In Progress').length])) as Record<BucketKey, number>;
    const overdueByKey = Object.fromEntries(keys.map(k => [k, store[k].filter(i => {
      if (!i.dueDate || i.status === 'Done') return false;
      const due = new Date(i.dueDate);
      const now = new Date();
      return due < now;
    }).length])) as Record<BucketKey, number>;
    const pct = Object.fromEntries(keys.map(k => [k, byKey[k] ? Math.round((doneByKey[k] / byKey[k]) * 100) : 0])) as Record<BucketKey, number>;
    
    return { count: byKey, done: doneByKey, inProgress: inProgressByKey, overdue: overdueByKey, pct };
  }, [store, tick]);

  function addItem(bucket: BucketKey) {
    const newItem: WorkItem = {
      id: crypto.randomUUID(),
      name: 'Untitled',
      owner: owners[0] || 'IT Team',
      status: 'In Progress',
      priority: 'Medium',
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    };
    setStore(s => ({ ...s, [bucket]: [newItem, ...s[bucket]] }));
    setCollapsed(prev => ({ ...prev, [newItem.id]: false }));
  }

  function updateItem(bucket: BucketKey, id: string, patch: Partial<WorkItem>) {
    setStore(s => ({
      ...s,
      [bucket]: s[bucket].map(it => it.id === id ? { ...it, ...patch } : it)
    }));
  }

  function toggleCollapsed(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }

  function removeItem(bucket: BucketKey, id: string) {
    setStore(s => ({ ...s, [bucket]: s[bucket].filter(it => it.id !== id) }));
  }

  function clearAll() {
    if (!confirm('Clear all items?')) return;
    setStore(defaultStore);
  }

  function exportJson() {
    const data = JSON.stringify(store, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'it-workload-tracker.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result));
        setStore(prev => ({ ...prev, ...next }));
      } catch {
        alert('Invalid file');
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  function addOwner() {
    const name = prompt('New owner name');
    if (!name) return;
    setOwners(prev => Array.from(new Set([...prev, name])));
  }

  // Tickets CSV import
  function parseCsv(text: string): Array<Record<string, string>> {
    const rows: Array<Record<string, string>> = [];
    const lines: string[] = [];
    // Normalize newlines
    text.replace(/\r\n?|\n/g, '\n').split('\n').forEach(l => lines.push(l));
    if (lines.length === 0) return rows;
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    };
    const headers = parseLine(lines[0]).map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cols = parseLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (cols[idx] ?? '').trim();
      });
      rows.push(obj);
    }
    return rows;
  }

  function importTicketsCsv(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const rows = parseCsv(text);
        // Normalize headers to lowercase
        const norm = rows.map(r => {
          const o: Record<string, string> = {};
          Object.keys(r).forEach(k => { o[k.toLowerCase()] = r[k]; });
          return o;
        });

        const headerKeys = Object.keys(norm[0] || {});
        const hasStatus = headerKeys.includes('status') || headerKeys.includes('ticket status') || headerKeys.includes('ticket_status');
        const isGroupSummary = headerKeys.includes('group name') && (
          headerKeys.includes('employee tickets') || headerKeys.includes('client tickets') || headerKeys.includes('internal tickets')
        );

        if (hasStatus) {
          let total = norm.length;
          let completed = 0, open = 0, pending = 0;
          for (const r of norm) {
            const raw = (r['status'] || r['ticket status'] || r['ticket_status'] || '').toString();
            const lower = raw.toLowerCase();
            const numeric = Number(lower);
            const status = Number.isFinite(numeric) && lower !== '' ? numeric : undefined;
            const isCompleted = (status === 4 || status === 5) || lower.includes('resolved') || lower.includes('closed') || lower.includes('complete');
            const isPending = (status === 3) || lower.includes('pending') || lower.includes('waiting');
            const isOpen = (status === 2) || lower.includes('open');
            if (isCompleted) completed++;
            else if (isPending) pending++;
            else if (isOpen) open++;
            else open++; // default to open-ish
          }
          setStore(s => ({
            ...s,
            tickets: {
              ...(s.tickets ?? { total: total, completed: 0, open: 0, pending: 0 }),
              // Keep existing total if previously set by a group summary
              total: (s.tickets?.meta === 'group-summary' ? s.tickets.total : total) ?? total,
              completed,
              open,
              pending,
              lastImportedAt: new Date().toISOString(),
              meta: 'ticket-list'
            }
          }));
        } else if (isGroupSummary) {
          const numericCols = headerKeys.filter(k => k.endsWith('tickets') || k.endsWith('resolved'));
          let total = 0;
          let clientResolved = 0;
          let employeeResolved = 0;
          const breakdown: Array<{ label: string; values: Record<string, number> }> = [];
          
          for (const r of norm) {
            const label = r['group name'] || 'Group';
            const values: Record<string, number> = {};
            for (const col of numericCols) {
              const v = Number((r[col] || '').toString().replace(/,/g, '')) || 0;
              values[col] = v;
              // Sum up submitted tickets (not resolved)
              if (col.endsWith('tickets') && !col.includes('resolved')) {
                total += v;
              }
              // Sum resolved by type
              if (col === 'client tickets resolved') {
                clientResolved += v;
              }
              if (col === 'employee tickets resolved') {
                employeeResolved += v;
              }
            }
            breakdown.push({ label, values });
          }
          
          setStore(s => ({
            ...s,
            tickets: {
              ...(s.tickets ?? { total: 0, completed: 0, open: 0, pending: 0 }),
              total,
              completed: clientResolved + employeeResolved,
              clientResolved,
              employeeResolved,
              open: s.tickets?.open ?? 0,
              pending: s.tickets?.pending ?? 0,
              lastImportedAt: new Date().toISOString(),
              meta: 'group-summary',
              breakdown
            }
          }));
        } else {
          // Fallback: just count rows
          setStore(s => ({ ...s, tickets: { total: norm.length, completed: s.tickets?.completed ?? 0, open: s.tickets?.open ?? 0, pending: s.tickets?.pending ?? 0, lastImportedAt: new Date().toISOString() } }));
        }
      } catch {
        alert('Could not parse CSV');
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  function clearTickets() {
    setStore(s => ({ ...s, tickets: { total: 0, completed: 0, open: 0, pending: 0 } }));
  }

  // Google Sheets Integration Functions
  async function loadFromSheets() {
    if (!googleSheetsService.isConnected()) return;
    
    try {
      const [profiles, contracts, projects, tickets] = await Promise.all([
        googleSheetsService.loadWorkloadItems('profiles'),
        googleSheetsService.loadWorkloadItems('contracts'), 
        googleSheetsService.loadWorkloadItems('projects'),
        googleSheetsService.loadTicketsSummary()
      ]);

      setStore(s => ({
        ...s,
        profiles: profiles.length > 0 ? profiles : s.profiles,
        contracts: contracts.length > 0 ? contracts : s.contracts,
        projects: projects.length > 0 ? projects : s.projects,
        tickets: tickets || s.tickets
      }));
    } catch (error) {
      console.error('Error loading from Google Sheets:', error);
    }
  }

  async function syncToSheets() {
    if (!googleSheetsService.isConnected()) return;

    try {
      await Promise.all([
        googleSheetsService.syncWorkloadItems('profiles', store.profiles),
        googleSheetsService.syncWorkloadItems('contracts', store.contracts),
        googleSheetsService.syncWorkloadItems('projects', store.projects),
        store.tickets ? googleSheetsService.syncTicketsSummary(store.tickets) : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
    }
  }

  // Set up event listeners for Google Sheets sync
  useEffect(() => {
    const handleSyncToSheets = () => syncToSheets();
    const handleLoadFromSheets = () => loadFromSheets();

    window.addEventListener('sync-to-sheets', handleSyncToSheets);
    window.addEventListener('load-from-sheets', handleLoadFromSheets);
    
    return () => {
      window.removeEventListener('sync-to-sheets', handleSyncToSheets);
      window.removeEventListener('load-from-sheets', handleLoadFromSheets);
    };
  }, [store]);

  // Auto-sync to sheets when data changes (debounced)
  useEffect(() => {
    if (googleSheetsService.isConnected()) {
      const timeoutId = setTimeout(() => {
        syncToSheets();
      }, 2000); // Debounce for 2 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [store]);

  // Load from URL parameter on mount
  useEffect(() => {
    const loadFromUrl = async () => {
      await googleSheetsService.loadFromUrl();
      if (googleSheetsService.isConnected()) {
        loadFromSheets();
      }
    };
    loadFromUrl();
  }, []);

  const buckets: { key: BucketKey; label: string }[] = [
    { key: 'projects', label: 'Main Projects' },
    { key: 'profiles', label: 'Profiles' },
    { key: 'contracts', label: 'Contracts' }
  ];

  return (
    <div className="container">
      <header>
        <div>
          <div className="title">IT Workload Tracker</div>
          <div className="subtitle">Profiles, Contracts, Main Projects · Autosaves locally</div>
        </div>
        <div className="controls print-hide" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="Filter by name or owner…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: 240, height: 36 }}
          />
          <button className="btn" onClick={addOwner}>Add Owner</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Import JSON
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={importJson} />
          </label>
          <button className="btn" onClick={exportJson}>Export</button>
          <button className="btn" onClick={() => window.print()}>Print</button>
          <button className="btn danger" onClick={clearAll}>Clear</button>
        </div>
      </header>

      <section className="panel" style={{ marginBottom: 12 }}>
        <GoogleSheetsIntegration
          onSyncComplete={() => {
            loadFromSheets();
          }}
          onError={(error) => {
            console.error('Google Sheets error:', error);
          }}
        />
      </section>

      <section className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Tickets (Freshdesk)</h2>
          <div className="controls print-hide" style={{ gap: 6 }}>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              Upload CSV
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={importTicketsCsv} />
            </label>
            <button className="btn sm" onClick={clearTickets}>Clear</button>
          </div>
        </div>
        {store.tickets?.lastImportedAt && (
          <div className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
            Last import: {new Date(store.tickets.lastImportedAt).toLocaleString()}
          </div>
        )}
        {store.tickets?.meta === 'ticket-list' && (
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            CSV should include a Status column (numeric 2/3/4/5 or text Open/Pending/Resolved/Closed). Other columns are ignored.
          </div>
        )}
        {store.tickets?.meta === 'group-summary' && (
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Detected a group summary export. Showing totals by group and ticket type.
          </div>
        )}
        {store.tickets?.meta === 'group-summary' && store.tickets.breakdown && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
              <div className="metric">
                <div className="label">Submitted (Total)</div>
                <div className="value">{store.tickets.total}</div>
              </div>
              <div className="metric">
                <div className="label">Client Tickets</div>
                <div className="value">{store.tickets.breakdown.reduce((sum, r) => sum + (r.values['client tickets'] || 0), 0)}</div>
              </div>
              <div className="metric">
                <div className="label">Employee Tickets</div>
                <div className="value">{store.tickets.breakdown.reduce((sum, r) => sum + (r.values['employee tickets'] || 0), 0)}</div>
              </div>
              <div className="metric">
                <div className="label">Internal Tickets</div>
                <div className="value">{store.tickets.breakdown.reduce((sum, r) => sum + (r.values['internal tickets'] || 0), 0)}</div>
              </div>
              <div className="metric">
                <div className="label">Client Resolved</div>
                <div className="value">{store.tickets.clientResolved ?? 0}</div>
              </div>
              <div className="metric">
                <div className="label">Employee Resolved</div>
                <div className="value">{store.tickets.employeeResolved ?? 0}</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', border: '1px solid var(--ring)', background: 'rgba(2,6,23,0.5)', fontSize: '12px', fontWeight: 600 }}>Group</th>
                    {Object.keys(store.tickets.breakdown[0]?.values || {}).map(key => (
                      <th key={key} style={{ textAlign: 'right', padding: '8px', border: '1px solid var(--ring)', background: 'rgba(2,6,23,0.5)', fontSize: '12px', fontWeight: 600 }}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {store.tickets.breakdown.map(row => (
                    <tr key={row.label}>
                      <td style={{ padding: '8px', border: '1px solid var(--ring)', fontSize: '13px' }}>{row.label}</td>
                      {Object.keys(row.values).map(key => (
                        <td key={key} style={{ textAlign: 'right', padding: '8px', border: '1px solid var(--ring)', fontSize: '13px', fontWeight: 600 }}>{row.values[key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {buckets.map(b => (
        <section key={b.key} className="panel" style={{ marginBottom: 12 }}>
          <div className="section-header">
            <h2>
              {b.label} <small>({store[b.key].length})</small>
            </h2>
            <div className="section-metrics">
              <div className="section-metric progress">
                <div className="label">In Progress</div>
                <div className="value">{String(totals.inProgress[b.key] ?? 0)}</div>
              </div>
              <div className="section-metric overdue">
                <div className="label">Overdue</div>
                <div className="value">{String(totals.overdue[b.key] ?? 0)}</div>
              </div>
              <div className="section-metric completed">
                <div className="label">Completed</div>
                <div className="value">{String(totals.done[b.key] ?? 0)}</div>
              </div>
            </div>
          </div>
          <div className="controls print-hide" style={{ marginBottom: 8, gap: 6 }}>
            <button className="btn primary" onClick={() => addItem(b.key)}>Add</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="workload-table">
              <thead>
                <tr>
                  <th className="toggle-col"></th>
                  <th className="name-col">Name</th>
                  <th className="owner-col">Owner</th>
                  <th className="status-col">Status</th>
                  <th className="priority-col">Priority</th>
                  <th className="date-col">Start</th>
                  <th className="date-col">Due</th>
                  <th className="progress-col">Progress</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {store[b.key]
                  .filter(i => !filter || i.name.toLowerCase().includes(filter.toLowerCase()) || i.owner.toLowerCase().includes(filter.toLowerCase()))
                  .map(item => (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td>
                          <button className="btn sm" onClick={() => toggleCollapsed(item.id)} aria-label="Toggle details" style={{ padding: '2px 8px' }}>
                            {(collapsed[item.id] ?? true) ? '▸' : '▾'}
                          </button>
                        </td>
                        <td>
                          {!(collapsed[item.id] ?? true) ? (
                            <input className="input" value={item.name} onChange={e => updateItem(b.key, item.id, { name: e.target.value })} />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{item.name || 'Untitled'}</span>
                          )}
                        </td>
                        <td>
                          <select value={item.owner} onChange={e => updateItem(b.key, item.id, { owner: e.target.value })}>
                            {owners.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={item.status} onChange={e => updateItem(b.key, item.id, { status: e.target.value as WorkItem['status'] })}>
                            {['Not Started','In Progress','Blocked','Done'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={item.priority} onChange={e => updateItem(b.key, item.id, { priority: e.target.value as WorkItem['priority'] })}>
                            {['Low','Medium','High','Critical'].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td>
                          <input className="input" type="date" value={item.startDate || ''} onChange={e => updateItem(b.key, item.id, { startDate: e.target.value })} />
                        </td>
                        <td>
                          <input className="input" type="date" value={item.dueDate || ''} onChange={e => updateItem(b.key, item.id, { dueDate: e.target.value })} />
                        </td>
                        <td>
                          <div className="progress" style={{ marginBottom: 4 }}><div className="bar" style={{ width: `${Math.round(calcProgress(item))}%` }} /></div>
                          <div className="muted" style={{ fontSize: 11 }}>{formatTimeLeft(item.dueDate)}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="actions print-hide" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn sm" onClick={() => updateItem(b.key, item.id, { status: 'Done' })}>Done</button>
                            <button className="btn sm danger" onClick={() => removeItem(b.key, item.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                      {!(collapsed[item.id] ?? true) && (
                        <tr>
                          <td></td>
                          <td colSpan={8}>
                            <textarea className="input" placeholder="Notes" value={item.notes || ''} onChange={e => updateItem(b.key, item.id, { notes: e.target.value })} style={{ width: '100%', minHeight: 60 }} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                {store[b.key].length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '10px 8px' }}>
                      <div className="empty">No items yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="footer-note print-hide">Autosaves to your browser. Use Export/Import for backups or sharing.</div>
    </div>
  );
};


