import React, { useEffect } from 'react';
import { GoogleSheetsIntegration } from '../components/GoogleSheetsIntegration';

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
  useEffect(() => {
    const handleSync = () => {
      // In a fuller app, collect current UI data and call
      // googleSheetsService.syncWorkloadItems / syncTicketsSummary here.
      // For now, we just log the sync trigger.
      console.debug('Sync event received');
    };

    window.addEventListener('sync-to-sheets', handleSync as EventListener);
    window.addEventListener('google-sheets-sync', handleSync as EventListener);
    return () => {
      window.removeEventListener('sync-to-sheets', handleSync as EventListener);
      window.removeEventListener('google-sheets-sync', handleSync as EventListener);
    };
  }, []);

  return (
    <div className="container">
      <header className="print-hide">
        <div>
          <div className="title">IT Workload Tracker</div>
          <div className="subtitle">Connect to Google Sheets to sync your data</div>
        </div>
      </header>
      <div className="panel">
        <GoogleSheetsIntegration />
      </div>
    </div>
  );
};


