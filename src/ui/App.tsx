import React, { useEffect, useMemo, useState } from 'react';
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

    const toggleNotesExpansion = (itemId: string) => {
      console.log(`Toggling notes for item ${itemId}`);
      const item = items.find(i => i.id === itemId);
      console.log('Current item state:', item);
      updateField(bucketKey, itemId, 'collapsed', !item?.collapsed);
    };

    const markCompleted = (itemId: string) => {
      console.log(`Marking item ${itemId} as completed`);
      updateField(bucketKey, itemId, 'status', 'Completed');
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
          <table className="workload-table">
            <thead>
              <tr>
                <th className="name-col">Name</th>
                <th className="owner-col">Owner</th>
                <th className="status-col">Status</th>
                <th className="priority-col">Priority</th>
                <th className="date-col">Start</th>
                <th className="date-col">Due</th>
                <th style={{width: '200px'}}>Notes</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><input className="input" value={item.name} onChange={e => updateField(bucketKey, item.id, 'name', e.target.value)} placeholder="Title" /></td>
                  <td><input className="input" value={item.owner} onChange={e => updateField(bucketKey, item.id, 'owner', e.target.value)} placeholder="Owner" /></td>
                  <td>
                    <select className="input" value={item.status} onChange={e => updateField(bucketKey, item.id, 'status', e.target.value)}>
                      <option>Not Started</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                      <option>On Hold</option>
                      <option>Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <select className="input" value={item.priority} onChange={e => updateField(bucketKey, item.id, 'priority', e.target.value)}>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </select>
                  </td>
                  <td><input className="input" type="date" value={item.startDate || ''} onChange={e => updateField(bucketKey, item.id, 'startDate', e.target.value)} /></td>
                  <td><input className="input" type="date" value={item.dueDate || ''} onChange={e => updateField(bucketKey, item.id, 'dueDate', e.target.value)} /></td>
                  <td>
                    <textarea 
                      value={item.notes || ''} 
                      onChange={e => updateField(bucketKey, item.id, 'notes', e.target.value)} 
                      placeholder="Add notes here..."
                      style={{ 
                        width: '100%', 
                        minHeight: '40px', 
                        maxHeight: '100px',
                        resize: 'vertical'
                      }}
                      className="input"
                    />
                  </td>
                  <td className="actions">
                    <button 
                      onClick={() => updateField(bucketKey, item.id, 'status', 'Completed')}
                      style={{ 
                        background: 'green',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        margin: '2px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title="Mark as Completed"
                    >
                      DONE
                    </button>
                    <button 
                      onClick={() => removeRow(bucketKey, item.id)}
                      style={{ 
                        background: 'red',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        margin: '2px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title="Delete Item"
                    >
                      DEL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="panel">
          <h2>Google Sheets <small>Integration</small></h2>
          <GoogleSheetsIntegration />
        </div>

        {renderBucket('Profiles', 'profiles', profiles, setProfiles)}
        {renderBucket('Contracts', 'contracts', contracts, setContracts)}
        {renderBucket('Main Projects', 'projects', projects, setProjects)}

        <div className="panel">
          <h2>Tickets Summary</h2>
          {!tickets ? (
            <div className="empty">No ticket summary loaded.</div>
          ) : (
            <div className="row">
              <div className="metric"><div className="label">Total</div><div className="value">{tickets.total ?? 0}</div></div>
              <div className="metric"><div className="label">Completed</div><div className="value">{tickets.completed ?? 0}</div></div>
              <div className="metric"><div className="label">Open</div><div className="value">{tickets.open ?? 0}</div></div>
              <div className="metric"><div className="label">Pending</div><div className="value">{tickets.pending ?? 0}</div></div>
            </div>
          )}
        </div>
      </div>

      {!hasAnyData && (
        <p className="footer-note">Tip: attach a sheet with ?sheet=SPREADSHEET_ID to the URL, then use Reload/Save buttons.</p>
      )}
    </div>
  );
};


