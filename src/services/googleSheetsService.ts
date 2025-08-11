import { WorkItem, TicketSummary } from '../ui/App';

// Types for our Google Sheets integration
export interface SheetsConfig {
  spreadsheetId: string;
  apiKey: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface SheetsAuth {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

// Google Sheets API client for browser environment
class GoogleSheetsService {
  private config: SheetsConfig | null = null;
  private isAuthenticated = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  private readonly API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
  
  // Sheet names for different data types
  private readonly SHEET_NAMES = {
    PROFILES: 'Profiles',
    CONTRACTS: 'Contracts', 
    PROJECTS: 'Main Projects',
    TICKETS: 'Tickets Summary',
    METADATA: 'App Metadata'
  };

  constructor() {
    this.loadConfig();
  }

  // Initialize Google APIs and authenticate
  async initialize(): Promise<void> {
    // Check if credentials are configured
    if (!this.CLIENT_ID || !this.API_KEY || this.CLIENT_ID === 'demo_mode' || this.API_KEY === 'demo_mode') {
      console.warn('Google Sheets integration not configured. Please set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY environment variables.');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // Load Google APIs script
      if (!window.gapi) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          window.gapi.load('auth2:client', () => {
            this.initializeGapi().then(resolve).catch(reject);
          });
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        this.initializeGapi().then(resolve).catch(reject);
      }
    });
  }

  private async initializeGapi(): Promise<void> {
    await window.gapi.client.init({
      apiKey: this.API_KEY,
      clientId: this.CLIENT_ID,
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
    });

    // Check if user is already signed in
    const authInstance = window.gapi.auth2.getAuthInstance();
    this.isAuthenticated = authInstance.isSignedIn.get();
    
    if (this.isAuthenticated) {
      this.startSyncInterval();
    }
  }

  // Authenticate with Google
  async authenticate(): Promise<SheetsAuth> {
    const authInstance = window.gapi.auth2.getAuthInstance();
    
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn();
    }
    
    const user = authInstance.currentUser.get();
    const authResponse = user.getAuthResponse();
    
    this.isAuthenticated = true;
    this.startSyncInterval();
    
    return {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
      expires_in: authResponse.expires_in,
      token_type: 'Bearer'
    };
  }

  // Create a new Google Sheet with proper structure
  async createWorkloadSheet(name: string = 'IT Workload Tracker'): Promise<string> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google');
    }

    // Create new spreadsheet
    const response = await window.gapi.client.sheets.spreadsheets.create({
      resource: {
        properties: {
          title: name,
          timeZone: 'America/New_York'
        },
        sheets: [
          this.createSheetStructure('Profiles'),
          this.createSheetStructure('Contracts'),
          this.createSheetStructure('Main Projects'),
          this.createTicketsSheetStructure(),
          this.createMetadataSheetStructure()
        ]
      }
    });

    const spreadsheetId = response.result.spreadsheetId!;
    
    // Set up initial data and formatting
    await this.setupSheetFormatting(spreadsheetId);
    
    // Save config
    this.config = {
      spreadsheetId,
      apiKey: this.API_KEY,
      accessToken: window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token
    };
    
    this.saveConfig();
    
    return spreadsheetId;
  }

  // Create sheet structure for workload items
  private createSheetStructure(sheetName: string) {
    return {
      properties: {
        title: sheetName,
        sheetType: 'GRID',
        gridProperties: {
          rowCount: 1000,
          columnCount: 10
        }
      },
      data: [{
        rowData: [{
          values: [
            { userEnteredValue: { stringValue: 'Name' } },
            { userEnteredValue: { stringValue: 'Owner' } },
            { userEnteredValue: { stringValue: 'Status' } },
            { userEnteredValue: { stringValue: 'Priority' } },
            { userEnteredValue: { stringValue: 'Start Date' } },
            { userEnteredValue: { stringValue: 'Due Date' } },
            { userEnteredValue: { stringValue: 'Progress' } },
            { userEnteredValue: { stringValue: 'Notes' } },
            { userEnteredValue: { stringValue: 'Created At' } },
            { userEnteredValue: { stringValue: 'Updated At' } }
          ]
        }]
      }]
    };
  }

  // Create tickets sheet structure
  private createTicketsSheetStructure() {
    return {
      properties: {
        title: 'Tickets Summary',
        sheetType: 'GRID',
        gridProperties: {
          rowCount: 100,
          columnCount: 8
        }
      },
      data: [{
        rowData: [{
          values: [
            { userEnteredValue: { stringValue: 'Metric' } },
            { userEnteredValue: { stringValue: 'Value' } },
            { userEnteredValue: { stringValue: 'Last Updated' } },
            { userEnteredValue: { stringValue: 'Source File' } },
            { userEnteredValue: { stringValue: 'Import Type' } },
            { userEnteredValue: { stringValue: 'Breakdown' } }
          ]
        }]
      }]
    };
  }

  // Create metadata sheet for app configuration
  private createMetadataSheetStructure() {
    return {
      properties: {
        title: 'App Metadata',
        sheetType: 'GRID',
        gridProperties: {
          rowCount: 50,
          columnCount: 4
        }
      },
      data: [{
        rowData: [{
          values: [
            { userEnteredValue: { stringValue: 'Setting' } },
            { userEnteredValue: { stringValue: 'Value' } },
            { userEnteredValue: { stringValue: 'Description' } },
            { userEnteredValue: { stringValue: 'Updated At' } }
          ]
        }]
      }]
    };
  }

  // Set up formatting and validation for sheets
  private async setupSheetFormatting(spreadsheetId: string): Promise<void> {
    const requests = [
      // Format headers with bold text and colors
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: {
                red: 0.2,
                green: 0.3,
                blue: 0.4
              },
              textFormat: {
                foregroundColor: {
                  red: 1,
                  green: 1,
                  blue: 1
                },
                bold: true
              }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      },
      // Add data validation for Status column
      {
        setDataValidation: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            startColumnIndex: 2,
            endColumnIndex: 3
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'Not Started' },
                { userEnteredValue: 'In Progress' },
                { userEnteredValue: 'Completed' },
                { userEnteredValue: 'On Hold' },
                { userEnteredValue: 'Cancelled' }
              ]
            },
            strict: true,
            showCustomUi: true
          }
        }
      },
      // Add data validation for Priority column
      {
        setDataValidation: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            startColumnIndex: 3,
            endColumnIndex: 4
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'Low' },
                { userEnteredValue: 'Medium' },
                { userEnteredValue: 'High' },
                { userEnteredValue: 'Urgent' }
              ]
            },
            strict: true,
            showCustomUi: true
          }
        }
      }
    ];

    await window.gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });
  }

  // Sync workload items to Google Sheets
  async syncWorkloadItems(bucketKey: string, items: WorkItem[]): Promise<void> {
    if (!this.config?.spreadsheetId) {
      throw new Error('No spreadsheet configured');
    }

    const sheetName = this.getSheetNameForBucket(bucketKey);
    const range = `${sheetName}!A2:J${items.length + 1}`;
    
    const values = items.map(item => [
      item.name,
      item.owner,
      item.status,
      item.priority,
      item.startDate || '',
      item.dueDate || '',
      item.progress?.toString() || '0',
      item.notes || '',
      item.createdAt || new Date().toISOString(),
      new Date().toISOString() // Updated At
    ]);

    // Clear existing data first
    await window.gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: this.config.spreadsheetId,
      range: `${sheetName}!A2:J`
    });

    // Add new data
    if (values.length > 0) {
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
    }
  }

  // Sync tickets summary to Google Sheets
  async syncTicketsSummary(tickets: TicketSummary): Promise<void> {
    if (!this.config?.spreadsheetId) {
      throw new Error('No spreadsheet configured');
    }

    const values = [
      ['Total Submitted', tickets.total?.toString() || '0', tickets.lastImportedAt || '', '', tickets.meta || '', ''],
      ['Completed', tickets.completed?.toString() || '0', tickets.lastImportedAt || '', '', '', ''],
      ['Open', tickets.open?.toString() || '0', tickets.lastImportedAt || '', '', '', ''],
      ['Pending', tickets.pending?.toString() || '0', tickets.lastImportedAt || '', '', '', '']
    ];

    if (tickets.clientResolved !== undefined) {
      values.push(['Client Tickets Resolved', tickets.clientResolved.toString(), tickets.lastImportedAt || '', '', '', '']);
    }

    if (tickets.employeeResolved !== undefined) {
      values.push(['Employee Tickets Resolved', tickets.employeeResolved.toString(), tickets.lastImportedAt || '', '', '', '']);
    }

    // Clear and update
    await window.gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: this.config.spreadsheetId,
      range: 'Tickets Summary!A2:F'
    });

    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.spreadsheetId,
      range: 'Tickets Summary!A2:F',
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
  }

  // Load workload items from Google Sheets
  async loadWorkloadItems(bucketKey: string): Promise<WorkItem[]> {
    if (!this.config?.spreadsheetId) {
      return [];
    }

    const sheetName = this.getSheetNameForBucket(bucketKey);
    const range = `${sheetName}!A2:J`;

    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range
      });

      const rows = response.result.values || [];
      return rows.map((row, index) => ({
        id: `${bucketKey}-${index}`,
        name: row[0] || '',
        owner: row[1] || '',
        status: row[2] || 'Not Started',
        priority: row[3] || 'Medium',
        startDate: row[4] || '',
        dueDate: row[5] || '',
        progress: parseInt(row[6] || '0'),
        notes: row[7] || '',
        createdAt: row[8] || new Date().toISOString(),
        collapsed: true
      }));
    } catch (error) {
      console.error('Error loading from sheets:', error);
      return [];
    }
  }

  // Load tickets summary from Google Sheets
  async loadTicketsSummary(): Promise<TicketSummary | null> {
    if (!this.config?.spreadsheetId) {
      return null;
    }

    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Tickets Summary!A2:F'
      });

      const rows = response.result.values || [];
      const summary: TicketSummary = {
        total: 0,
        completed: 0,
        open: 0,
        pending: 0
      };

      rows.forEach(row => {
        const metric = row[0];
        const value = parseInt(row[1] || '0');
        const lastImported = row[2];
        const meta = row[4];

        switch (metric) {
          case 'Total Submitted':
            summary.total = value;
            summary.lastImportedAt = lastImported;
            summary.meta = meta;
            break;
          case 'Completed':
            summary.completed = value;
            break;
          case 'Open':
            summary.open = value;
            break;
          case 'Pending':
            summary.pending = value;
            break;
          case 'Client Tickets Resolved':
            summary.clientResolved = value;
            break;
          case 'Employee Tickets Resolved':
            summary.employeeResolved = value;
            break;
        }
      });

      return summary.total > 0 ? summary : null;
    } catch (error) {
      console.error('Error loading tickets from sheets:', error);
      return null;
    }
  }

  // Share spreadsheet with specific permissions
  async shareSpreadsheet(email: string, role: 'reader' | 'writer' | 'commenter' = 'writer'): Promise<void> {
    if (!this.config?.spreadsheetId) {
      throw new Error('No spreadsheet configured');
    }

    // Use Drive API to share the spreadsheet
    await window.gapi.client.request({
      path: `https://www.googleapis.com/drive/v3/files/${this.config.spreadsheetId}/permissions`,
      method: 'POST',
      body: {
        role,
        type: 'user',
        emailAddress: email
      }
    });
  }

  // Get shareable link for the spreadsheet
  getShareableLink(): string {
    if (!this.config?.spreadsheetId) {
      return '';
    }
    return `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/edit`;
  }

  // Get embeddable app link with spreadsheet ID
  getAppShareLink(): string {
    if (!this.config?.spreadsheetId) {
      return '';
    }
    return `${window.location.origin}${window.location.pathname}?sheet=${this.config.spreadsheetId}`;
  }

  // Check if connected to Google Sheets
  isConnected(): boolean {
    return this.isAuthenticated && !!this.config?.spreadsheetId;
  }

  // Check if credentials are properly configured
  isConfigured(): boolean {
    return !!(this.CLIENT_ID && this.API_KEY && this.CLIENT_ID !== 'demo_mode' && this.API_KEY !== 'demo_mode');
  }

  // Disconnect from Google Sheets
  async disconnect(): Promise<void> {
    if (window.gapi?.auth2) {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
    }
    
    this.isAuthenticated = false;
    this.config = null;
    this.stopSyncInterval();
    this.clearConfig();
  }

  // Helper methods
  private getSheetNameForBucket(bucketKey: string): string {
    switch (bucketKey) {
      case 'profiles': return this.SHEET_NAMES.PROFILES;
      case 'contracts': return this.SHEET_NAMES.CONTRACTS;
      case 'projects': return this.SHEET_NAMES.PROJECTS;
      default: return this.SHEET_NAMES.PROFILES;
    }
  }

  private startSyncInterval(): void {
    // Sync every 30 seconds when active
    this.syncInterval = setInterval(() => {
      // This will be called from the main app to sync data
      window.dispatchEvent(new CustomEvent('google-sheets-sync'));
    }, 30000);
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private saveConfig(): void {
    if (this.config) {
      localStorage.setItem('google-sheets-config', JSON.stringify(this.config));
    }
  }

  private loadConfig(): void {
    const saved = localStorage.getItem('google-sheets-config');
    if (saved) {
      try {
        this.config = JSON.parse(saved);
      } catch (error) {
        console.error('Error loading saved config:', error);
      }
    }
  }

  private clearConfig(): void {
    localStorage.removeItem('google-sheets-config');
  }

  // Load spreadsheet from URL parameter
  async loadFromUrl(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const sheetId = urlParams.get('sheet');
    
    if (sheetId && this.isAuthenticated) {
      this.config = {
        spreadsheetId: sheetId,
        apiKey: this.API_KEY,
        accessToken: window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token
      };
      this.saveConfig();
    }
  }
}

// Global instance
export const googleSheetsService = new GoogleSheetsService();

// Type declarations for global Google APIs
declare global {
  interface Window {
    gapi: any;
  }
}
