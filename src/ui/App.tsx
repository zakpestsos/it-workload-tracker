import React, { useEffect, useMemo, useState, useRef } from 'react';
import { GoogleSheetsIntegration } from '../components/GoogleSheetsIntegration';
import { googleSheetsService } from '../services/googleSheetsService';

// Ensure service is exposed to window immediately
if (typeof window !== 'undefined') {
  (window as any).googleSheetsService = googleSheetsService;
  console.log('GoogleSheetsService exposed globally');
  console.log('App.tsx loaded successfully');
}

export type WorkItem = {
  id: string;
  name: string;
  owner: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled' | string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  startDate?: string;
  dueDate?: string;
  progress?: number;
  notes?: string;
  createdAt?: string;
  collapsed?: boolean;
};

export type TicketSummary = {
  total?: number;
  completed?: number;
  open?: number;
  pending?: number;
  clientResolved?: number;
  employeeResolved?: number;
  lastImportedAt?: string;
  meta?: string;
};

export const App: React.FC = () => {
  const [isBusy, setIsBusy] = useState(false);
  // Collapsible tickets sidebar state
  const [ticketsPanelCollapsed, setTicketsPanelCollapsed] = useState(() => {
    const saved = localStorage.getItem('ticketsPanelCollapsed');
    return saved ? JSON.parse(saved) : true; // Default to collapsed
  });
  
  // Add sample data to ensure UI elements are visible
  const [profiles, setProfiles] = useState<WorkItem[]>([
    { id: '1', name: 'Sample Profile Task', owner: 'Demo User', status: 'In Progress', priority: 'Medium', notes: 'This is a sample task to show UI elements' }
  ]);
  const [contracts, setContracts] = useState<WorkItem[]>([
    { id: '2', name: 'Sample Contract Task', owner: 'Demo User', status: 'Not Started', priority: 'High', notes: 'Another sample task' }
  ]);
  const [projects, setProjects] = useState<WorkItem[]>([
    { id: '3', name: 'Sample Project Task', owner: 'Demo User', status: 'Completed', priority: 'Low', notes: 'Completed sample task' }
  ]);
  const [tickets, setTickets] = useState<TicketSummary | null>(null);
  const [csvUploadDate, setCsvUploadDate] = useState<string | null>(null);

  // Toggle tickets panel and save to localStorage
  const toggleTicketsPanel = () => {
    const newState = !ticketsPanelCollapsed;
    setTicketsPanelCollapsed(newState);
    localStorage.setItem('ticketsPanelCollapsed', JSON.stringify(newState));
  };

  const handleTicketsUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Get the file's last modified date or current date as timestamp
    const uploadDate = new Date(file.lastModified || Date.now());
    setCsvUploadDate(uploadDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }));

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const lines = csv.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) return;
      
      // Parse headers to determine CSV format
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const hasResolvedColumns = headers.includes('employee tickets resolved') || headers.includes('client tickets resolved');
      
      console.log('CSV Headers:', headers);
      console.log('Has resolved columns:', hasResolvedColumns);
      
      let employeeTickets = 0;
      let clientTickets = 0;
      let employeeResolved = 0;
      let clientResolved = 0;
      
      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
        
        if (columns.length >= 3) {
          // Always have: Group, Employee Tickets, Client Tickets
          employeeTickets += parseInt(columns[1]) || 0;
          clientTickets += parseInt(columns[2]) || 0;
          
          // If resolved columns exist
          if (hasResolvedColumns && columns.length >= 5) {
            employeeResolved += parseInt(columns[3]) || 0;
            clientResolved += parseInt(columns[4]) || 0;
          }
        }
      }
      
      const ticketsOpened = employeeTickets + clientTickets;
      const ticketsClosed = employeeResolved + clientResolved;
      const stillOpen = Math.max(0, ticketsOpened - ticketsClosed);
      
      // Create summary with proper terminology
      const summary: TicketSummary = {
        total: ticketsOpened,
        completed: ticketsClosed,
        open: stillOpen,
        pending: stillOpen // All non-closed tickets are "pending"
      };
      
      console.log('Parsed tickets from CSV:', {
        employeeTickets,
        clientTickets,
        employeeResolved,
        clientResolved,
        summary
      });
      
      setTickets(summary);
    };
    reader.readAsText(file);
  };

  const hasAnyData = useMemo(
    () => profiles.length + contracts.length + projects.length > 0 || !!tickets,
    [profiles.length, contracts.length, projects.length, tickets]
  );

  const loadAllFromSheets = async () => {
    setIsBusy(true);
    try {
      console.log('Starting load from sheets...');
      await googleSheetsService.initialize();
      
      // Use the specific sheet ID instead of URL parameter
      const specificSheetId = '1A1MdU3y0nRD8Fzzs-Ojj2VfE-UA903S6b9vuAavEkEI';
      await googleSheetsService.setSpecificSheet(specificSheetId);
      
      const [p, c, pr, t] = await Promise.all([
        googleSheetsService.loadWorkloadItems('profiles'),
        googleSheetsService.loadWorkloadItems('contracts'),
        googleSheetsService.loadWorkloadItems('projects'),
        googleSheetsService.loadTicketsSummary()
      ]);
      console.log('Loaded data:', { profiles: p.length, contracts: c.length, projects: pr.length, tickets: t });
      setProfiles(p);
      setContracts(c);
      setProjects(pr);
      setTickets(t);
    } finally {
      setIsBusy(false);
    }
  };

  const saveAllToSheets = async () => {
    setIsBusy(true);
    try {
      console.log('Starting save to sheets...', { profiles: profiles.length, contracts: contracts.length, projects: projects.length });
      await googleSheetsService.initialize();
      
      // Use the specific sheet ID instead of URL parameter
      const specificSheetId = '1A1MdU3y0nRD8Fzzs-Ojj2VfE-UA903S6b9vuAavEkEI';
      await googleSheetsService.setSpecificSheet(specificSheetId);
      
      console.log('Saving profiles...', profiles);
      await googleSheetsService.syncWorkloadItems('profiles', profiles);
      
      console.log('Saving contracts...', contracts);
      await googleSheetsService.syncWorkloadItems('contracts', contracts);
      
      console.log('Saving projects...', projects);
      await googleSheetsService.syncWorkloadItems('projects', projects);
      
      console.log('Save to sheets completed successfully!');
      alert('Data saved to Google Sheets successfully!');
    } catch (error) {
      console.error('Error saving to sheets:', error);
      alert(`Error saving to sheets: ${error}`);
    } finally {
      setIsBusy(false);
    }
  };

  const addRow = (bucket: 'profiles'|'contracts'|'projects') => {
    const newItem: WorkItem = {
      id: `${bucket}-${Date.now()}`,
      name: '', owner: '', status: 'Not Started', priority: 'Medium',
      startDate: '', dueDate: '', progress: 0, notes: '', createdAt: new Date().toISOString(), collapsed: true
    };
    if (bucket === 'profiles') setProfiles(p => [newItem, ...p]);
    if (bucket === 'contracts') setContracts(p => [newItem, ...p]);
    if (bucket === 'projects') setProjects(p => [newItem, ...p]);
  };

  const removeRow = (bucket: 'profiles'|'contracts'|'projects', id: string) => {
    if (bucket === 'profiles') setProfiles(p => p.filter(i => i.id !== id));
    if (bucket === 'contracts') setContracts(p => p.filter(i => i.id !== id));
    if (bucket === 'projects') setProjects(p => p.filter(i => i.id !== id));
  };

  const updateField = (
    bucket: 'profiles'|'contracts'|'projects', id: string,
    field: keyof WorkItem, value: string | number | boolean
  ) => {
    const map = (arr: WorkItem[]) => arr.map(i => i.id === id ? { ...i, [field]: value } as WorkItem : i);
    if (bucket === 'profiles') setProfiles(map);
    if (bucket === 'contracts') setContracts(map);
    if (bucket === 'projects') setProjects(map);
  };

  useEffect(() => {
    console.log('App initialized, exposing debug functions...');
    
    // Expose debug functions to window for console access
    (window as any).debugApp = {
      loadAllFromSheets,
      saveAllToSheets,
      profiles,
      contracts,
      projects,
      tickets
    };
    
    const onSync = () => { loadAllFromSheets(); };
    window.addEventListener('sync-to-sheets', onSync as EventListener);
    window.addEventListener('google-sheets-sync', onSync as EventListener);
    
    // Always try to load from the specific sheet (ignore URL parameter)
    console.log('Auto-loading from specific sheet...');
    loadAllFromSheets();
    
    return () => {
      window.removeEventListener('sync-to-sheets', onSync as EventListener);
      window.removeEventListener('google-sheets-sync', onSync as EventListener);
    };
  }, []);

  const renderBucket = (title: string, bucketKey: 'profiles'|'contracts'|'projects', items: WorkItem[], setItems: React.Dispatch<React.SetStateAction<WorkItem[]>>) => {
    console.log(`Rendering ${title} bucket with ${items.length} items:`, items);
    
    // Calculate status metrics
    const inProgress = items.filter(item => item.status === 'In Progress').length;
    const completed = items.filter(item => item.status === 'Completed').length;
    const overdue = items.filter(item => {
      if (!item.dueDate) return false;
      const due = new Date(item.dueDate);
      const today = new Date();
      return due < today && item.status !== 'Completed';
    }).length;

    // Helper to get status badge color
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'In Progress': return '#60a5fa';
        case 'Completed': return '#22c55e';
        case 'On Hold': return '#f59e0b';
        case 'Cancelled': return '#ef4444';
        default: return '#94a3b8';
      }
    };

    // Helper to get priority badge color
    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'Urgent': return '#ef4444';
        case 'High': return '#f59e0b';
        case 'Medium': return '#60a5fa';
        case 'Low': return '#94a3b8';
        default: return '#94a3b8';
      }
    };

    // Helper to format date
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
      <div className="panel">
        <div className="section-header">
          <h2>{title} <small>{items.length}</small></h2>
          <div className="section-metrics">
            <div className="section-metric progress">
              <div className="label">In Progress</div>
              <div className="value">{inProgress}</div>
            </div>
            <div className="section-metric completed">
              <div className="label">Completed</div>
              <div className="value">{completed}</div>
            </div>
            <div className="section-metric overdue">
              <div className="label">Overdue</div>
              <div className="value">{overdue}</div>
            </div>
            <button className="btn sm" onClick={() => addRow(bucketKey)}>Add</button>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty">No items. Click Add to create one.</div>
        ) : (
          <div className="work-cards-container">
            {items.map(item => (
              <div key={item.id} className="work-card">
                {/* Name - Large and prominent */}
                <div className="work-card-name-section">
                  <input 
                    className="work-card-name-input" 
                    value={item.name} 
                    onChange={e => updateField(bucketKey, item.id, 'name', e.target.value)} 
                    placeholder="Task name..."
                  />
                </div>

                {/* Notes - Prominent and auto-expanding */}
                <div className="work-card-notes-section">
                  <textarea 
                    className="work-card-notes-textarea"
                    value={item.notes || ''} 
                    onChange={e => {
                      updateField(bucketKey, item.id, 'notes', e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
                    }}
                    onFocus={e => {
                      // Ensure proper height on focus
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
                    }}
                    placeholder="Add implementation notes, details, and context here..."
                    style={{
                      height: item.notes ? 'auto' : '80px',
                      overflow: 'auto'
                    }}
                  />
                </div>

                {/* Secondary info badges and actions */}
                <div className="work-card-footer">
                  <div className="work-card-badges">
                    {/* Owner badge */}
                    <div className="info-badge owner-badge">
                      <span className="badge-label">Owner:</span>
                      <input 
                        className="badge-input"
                        value={item.owner} 
                        onChange={e => updateField(bucketKey, item.id, 'owner', e.target.value)} 
                        placeholder="Name"
                      />
                    </div>

                    {/* Status badge */}
                    <div className="info-badge status-badge" style={{ borderColor: getStatusColor(item.status) }}>
                      <select 
                        className="badge-select"
                        value={item.status} 
                        onChange={e => updateField(bucketKey, item.id, 'status', e.target.value)}
                        style={{ color: getStatusColor(item.status) }}
                      >
                        <option>Not Started</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>On Hold</option>
                        <option>Cancelled</option>
                      </select>
                    </div>

                    {/* Priority badge */}
                    <div className="info-badge priority-badge" style={{ borderColor: getPriorityColor(item.priority) }}>
                      <select 
                        className="badge-select"
                        value={item.priority} 
                        onChange={e => updateField(bucketKey, item.id, 'priority', e.target.value)}
                        style={{ color: getPriorityColor(item.priority) }}
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Urgent</option>
                      </select>
                    </div>

                    {/* Date badge */}
                    <div className="info-badge date-badge">
                      <input 
                        type="date" 
                        className="badge-date-input"
                        value={item.startDate || ''} 
                        onChange={e => updateField(bucketKey, item.id, 'startDate', e.target.value)}
                        title="Start Date"
                      />
                      <span style={{ margin: '0 4px', color: 'var(--muted)' }}>→</span>
                      <input 
                        type="date" 
                        className="badge-date-input"
                        value={item.dueDate || ''} 
                        onChange={e => updateField(bucketKey, item.id, 'dueDate', e.target.value)}
                        title="Due Date"
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="work-card-actions">
                    <button 
                      className="action-btn done-btn"
                      onClick={() => updateField(bucketKey, item.id, 'status', 'Completed')}
                      title="Mark as Completed"
                    >
                      DONE
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => removeRow(bucketKey, item.id)}
                      title="Delete Item"
                    >
                      DEL
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  console.log('App component rendering...', { hasAnyData, isBusy });

  return (
    <div className="container">
      <header className="print-hide">
        <div>
          <div className="title">IT Workload Tracker</div>
          <div className="subtitle">Profiles • Contracts • Main Projects</div>
        </div>
        <div className="controls">
          <button className="btn" onClick={loadAllFromSheets} disabled={isBusy}>{isBusy ? 'Loading…' : 'Reload from Sheets'}</button>
          <button className="btn" onClick={saveAllToSheets} disabled={isBusy}>{isBusy ? 'Saving…' : 'Save to Sheets'}</button>
        </div>
      </header>

      <div className="panel print-hide">
        <h2>Google Sheets <small>Integration</small></h2>
        <GoogleSheetsIntegration />
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left side - Tickets Summary (Collapsible) */}
        <div 
          className={ticketsPanelCollapsed ? 'tickets-sidebar-collapsed' : 'tickets-sidebar-expanded'}
          style={{ 
            width: ticketsPanelCollapsed ? '60px' : '240px',
            flexShrink: 0,
            transition: 'width 0.3s ease',
            position: 'relative'
          }}
        >
          <div className="panel" style={{ padding: ticketsPanelCollapsed ? '12px 8px' : '20px', height: '100%' }}>
            {ticketsPanelCollapsed ? (
              // Collapsed view - icon and count only
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={toggleTicketsPanel}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--ring)',
                    color: 'var(--accent)',
                    padding: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    width: '100%',
                    transition: 'all 0.2s ease'
                  }}
                  title="Expand Tickets Panel"
                >
                  &gt;&gt;
                </button>
                <div style={{ 
                  fontSize: '24px', 
                  textAlign: 'center',
                  marginTop: '8px'
                }}>
                  📊
                </div>
                {tickets && (
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: 'var(--accent)',
                    textAlign: 'center'
                  }}>
                    {tickets.total ?? 0}
                  </div>
                )}
              </div>
            ) : (
              // Expanded view - full content
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Support Tickets</h3>
                  <button 
                    onClick={toggleTicketsPanel}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--ring)',
                      color: 'var(--muted)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'all 0.2s ease'
                    }}
                    title="Collapse Tickets Panel"
                  >
                    &lt;&lt;
                  </button>
                </div>
                {csvUploadDate && (
                  <div style={{ 
                    fontSize: '10px', 
                    color: 'var(--muted)', 
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--ring)',
                    marginBottom: '12px',
                    textAlign: 'center'
                  }}>
                    {csvUploadDate}
                  </div>
                )}
              </>
            )}
            
            {!ticketsPanelCollapsed && (
              <>
                {/* Upload Button */}
                <div style={{ marginBottom: '20px' }}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleTicketsUpload}
                    style={{ display: 'none' }}
                    id="tickets-upload"
                  />
                  <label 
                    htmlFor="tickets-upload" 
                    className="btn" 
                    style={{ 
                      display: 'block', 
                      textAlign: 'center', 
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
                      borderColor: 'var(--accent)',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    📊 Upload CSV Data
                  </label>
                </div>

                {/* Tickets Metrics */}
                {!tickets ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '24px 0', 
                    color: 'var(--muted)', 
                    fontSize: '13px',
                    border: '2px dashed var(--ring)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📈</div>
                    <div>Upload your tickets CSV</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>to see analytics</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Opened vs Closed Overview */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.1))',
                      border: '1px solid var(--ring)',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Activity Overview
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        <div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#60a5fa' }}>{tickets.total ?? 0}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Opened</div>
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: '16px', alignSelf: 'center' }}>→</div>
                        <div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--brand)' }}>{tickets.completed ?? 0}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Closed</div>
                        </div>
                      </div>
                    </div>

                    {/* Current Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Current Status
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        background: tickets.open > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${tickets.open > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                        borderRadius: '6px'
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Still Open</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: tickets.open > 0 ? '#ef4444' : 'var(--brand)' }}>
                            {tickets.open ?? 0}
                          </div>
                        </div>
                        <div style={{ fontSize: '20px' }}>
                          {tickets.open > 0 ? '⚠️' : '✅'}
                        </div>
                      </div>

                      {/* Resolution Rate */}
                      {tickets.total > 0 && (
                        <div style={{
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--ring)',
                          borderRadius: '6px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>Resolution Rate</div>
                          <div style={{ fontSize: '14px', fontWeight: '600' }}>
                            {Math.round((tickets.completed / tickets.total) * 100)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right side - Workload Items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {renderBucket('Profiles', 'profiles', profiles, setProfiles)}
          {renderBucket('Contracts', 'contracts', contracts, setContracts)}
          {renderBucket('Main Projects', 'projects', projects, setProjects)}
        </div>
      </div>

      {!hasAnyData && (
        <p className="footer-note">Tip: attach a sheet with ?sheet=SPREADSHEET_ID to the URL, then use Reload/Save buttons.</p>
      )}
    </div>
  );
};


