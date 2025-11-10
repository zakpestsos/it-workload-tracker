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
  private syncInterval: number | null = null;
  private calendarId: string | null = null;
  // Prefer environment variables provided by Vite; fall back to defined values if present
  private readonly CLIENT_ID: string = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '304831967056-kvdtr66m0ta8lm6gin3gf4f5q0naf47n.apps.googleusercontent.com';
  private readonly API_KEY: string = (import.meta as any).env?.VITE_GOOGLE_API_KEY || 'AIzaSyARpNQLLER7nub09yNmcn4ROZMYG2ZEo48';
  
  // Sheet names for different data types
  private readonly SHEET_NAMES = {
    PROFILES: 'Profiles',
    CONTRACTS: 'Contracts', 
    PROJECTS: 'Main Projects',
    TICKETS: 'Tickets Summary',
    METADATA: 'App Metadata'
  };

  // Calendar constants
  private readonly CALENDAR_NAME = 'IT Workload Tracker';
  private readonly CALENDAR_DESCRIPTION = 'Work sessions for IT projects, profiles, and contracts';

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
      // Load both GAPI and GIS libraries
      const loadGapi = () => {
        if (!window.gapi) {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.onload = () => {
            window.gapi.load('client', () => {
              this.initializeGapi().then(resolve).catch(reject);
            });
          };
          script.onerror = reject;
          document.head.appendChild(script);
        } else {
          this.initializeGapi().then(resolve).catch(reject);
        }
      };
      
      // Ensure GIS is loaded first
      this.ensureGisClientLoaded().then(loadGapi).catch(reject);
    });
  }

  private async initializeGapi(): Promise<void> {
    console.log('Initializing GAPI with:', {
      apiKey: this.API_KEY ? 'SET' : 'NOT_SET',
      origin: window.location.origin
    });

    try {
      // Initialize with Sheets and Drive APIs only
      // Calendar API will be loaded on-demand when needed
      await window.gapi.client.init({
        apiKey: this.API_KEY,
        discoveryDocs: [
          'https://sheets.googleapis.com/$discovery/rest?version=v4',
          'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
        ]
      });

      console.log('GAPI initialized successfully');

      // Check if there's an existing token
      const token = window.gapi.client.getToken?.();
      this.isAuthenticated = !!(token && token.access_token);
      if (this.isAuthenticated) {
        console.log('Found existing valid token');
        this.startSyncInterval();
      }
    } catch (error) {
      console.error('GAPI initialization failed:', error);
      throw error;
    }
  }

  // Authenticate with Google using GIS token client with popup mode
  async authenticate(): Promise<SheetsAuth> {
    console.log('Starting authentication with Google Identity Services (popup mode)...');
    
    // Ensure GIS is loaded
    await this.ensureGisClientLoaded();
    
    return new Promise((resolve, reject) => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar',
          // Force popup mode to avoid iframe issues
          ux_mode: 'popup',
          callback: (tokenResponse: any) => {
            console.log('Auth callback received:', tokenResponse);
            if (tokenResponse.error) {
              console.error('Authentication failed:', tokenResponse.error);
              reject(new Error(`Authentication failed: ${tokenResponse.error}`));
            } else {
              console.log('Authentication successful, setting token...');
              window.gapi.client.setToken(tokenResponse);
              this.isAuthenticated = true;
              this.startSyncInterval();
              this.saveConfig();
              resolve({
                access_token: tokenResponse.access_token,
                expires_in: tokenResponse.expires_in || 3600,
                token_type: 'Bearer'
              });
            }
          },
        });
        
        console.log('Requesting access token...');
        tokenClient.requestAccessToken({ 
          prompt: 'consent',
          hint: 'Use popup mode to avoid third-party cookie issues'
        });
      } catch (error) {
        console.error('Error initializing token client:', error);
        reject(error);
      }
    });
  }

  private async ensureGisClientLoaded(): Promise<void> {
    if ((window as any).google?.accounts?.oauth2) return;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
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
      accessToken: window.gapi.client.getToken?.().access_token
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
            { userEnteredValue: { stringValue: 'Updated At' } },
            { userEnteredValue: { stringValue: 'Calendar Sessions' } }
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

    try {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });
    } catch (error) {
      console.warn('Sheet formatting failed; continuing without it', error);
    }
  }

  // Sync workload items to Google Sheets
  async syncWorkloadItems(bucketKey: string, items: WorkItem[]): Promise<void> {
    console.log(`Syncing ${bucketKey} items:`, items);
    
    if (!this.config?.spreadsheetId) {
      throw new Error('No spreadsheet configured');
    }

    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Sheets');
    }

    const sheetName = this.getSheetNameForBucket(bucketKey);
    console.log(`Using sheet name: ${sheetName}`);
    
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
      new Date().toISOString(), // Updated At
      JSON.stringify(item.workSessions || []) // Calendar Sessions as JSON
    ]);

    console.log(`Prepared values for ${sheetName}:`, values);

    try {
      // Clear existing data first
      console.log(`Clearing existing data in ${sheetName}...`);
      await window.gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: this.config.spreadsheetId,
        range: `${sheetName}!A2:K`
      });

      // Add new data
      if (values.length > 0) {
        const range = `${sheetName}!A2:K${values.length + 1}`;
        console.log(`Updating range: ${range}`);
        
        const response = await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          resource: { values }
        });
        
        console.log(`Successfully updated ${sheetName}:`, response);
      } else {
        console.log(`No data to sync for ${sheetName}`);
      }
    } catch (error) {
      console.error(`Error syncing ${bucketKey} to sheets:`, error);
      throw error;
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
    const range = `${sheetName}!A2:K`;

    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range
      });

      const rows = response.result.values || [];
      console.log(`Loaded ${rows.length} rows from ${sheetName}`);
      
      return rows.map((row: any[], index: number) => {
        let workSessions = [];
        // Only try to parse calendar sessions if column K exists and has data
        if (row.length > 10 && row[10]) {
          try {
            workSessions = JSON.parse(row[10]);
          } catch (e) {
            console.warn(`Failed to parse calendar sessions for row ${index}:`, e);
          }
        }
        
        const item = {
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
          collapsed: true,
          workSessions,
          calendarSynced: workSessions.length > 0
        };
        
        console.log(`Loaded item ${index}:`, item.name);
        return item;
      });
    } catch (error) {
      console.error('Error loading from sheets:', error);
      return [];
    }
  }

  // Load tickets summary from Google Sheets
  async loadTicketsSummary(): Promise<TicketSummary | null> {
    if (!this.config?.spreadsheetId) {
      console.log('No spreadsheet configured for tickets');
      return null;
    }

    try {
      console.log('Loading tickets summary from sheet...');
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Tickets Summary!A2:F'
      });

      const rows = response.result.values || [];
      console.log('Tickets data rows:', rows);
      
      const summary: TicketSummary = {
        total: 0,
        completed: 0,
        open: 0,
        pending: 0
      };

      rows.forEach((row: any[]) => {
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

      console.log('Processed tickets summary:', summary);
      
      // Return summary even if total is 0, but with some default data to show the UI works
      if (rows.length === 0) {
        // No data in tickets sheet, return some sample data to show it's working
        return {
          total: 0,
          completed: 0,
          open: 0,
          pending: 0,
          lastImportedAt: 'No data imported yet',
          meta: 'Add ticket data to see summary'
        };
      }
      
      return summary;
    } catch (error) {
      console.error('Error loading tickets from sheets:', error);
      // Return placeholder data to show the feature works
      return {
        total: 0,
        completed: 0,
        open: 0,
        pending: 0,
        lastImportedAt: 'Error loading data',
        meta: 'Check sheet permissions'
      };
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

  // Debug function to check connection status
  debugConnectionStatus(): void {
    console.log('=== Google Sheets Debug Info ===');
    console.log('CLIENT_ID:', this.CLIENT_ID);
    console.log('API_KEY:', this.API_KEY ? 'SET' : 'NOT_SET');
    console.log('isAuthenticated:', this.isAuthenticated);
    console.log('config:', this.config);
    console.log('gapi loaded:', !!window.gapi);
    console.log('gapi.client:', !!window.gapi?.client);
    console.log('current token:', window.gapi?.client?.getToken?.());
    console.log('isConnected():', this.isConnected());
    console.log('isConfigured():', this.isConfigured());
    if (this.config?.spreadsheetId) {
      console.log('Spreadsheet URL:', this.getShareableLink());
    }
    console.log('================================');
  }

  // Check if connected to Google Sheets
  isConnected(): boolean {
    return this.isAuthenticated && !!this.config?.spreadsheetId;
  }

  // Check if credentials are properly configured
  isConfigured(): boolean {
    console.log('Checking config:', { 
      CLIENT_ID: this.CLIENT_ID, 
      API_KEY: this.API_KEY ? 'SET' : 'NOT_SET',
      configured: !!(this.CLIENT_ID && this.API_KEY && this.CLIENT_ID !== 'demo_mode' && this.API_KEY !== 'demo_mode')
    });
    return !!(this.CLIENT_ID && this.API_KEY && this.CLIENT_ID !== 'demo_mode' && this.API_KEY !== 'demo_mode');
  }

  // Disconnect from Google Sheets
  async disconnect(): Promise<void> {
    if (window.gapi?.client?.setToken) {
      window.gapi.client.setToken(null);
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
    // Auto-sync disabled to prevent interruptions while editing
    // this.syncInterval = setInterval(() => {
    //   // This will be called from the main app to sync data
    //   window.dispatchEvent(new CustomEvent('google-sheets-sync'));
    // }, 30000);
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
        accessToken: window.gapi.client.getToken?.().access_token
      };
      this.saveConfig();
    }
  }

  // Set a specific spreadsheet ID to use
  async setSpecificSheet(spreadsheetId: string): Promise<void> {
    console.log(`Setting specific sheet: ${spreadsheetId}`);
    this.config = {
      spreadsheetId,
      apiKey: this.API_KEY,
      accessToken: window.gapi.client.getToken?.().access_token
    };
    this.saveConfig();
    console.log('Specific sheet configuration saved');
  }

  // ==================== CALENDAR API METHODS ====================

  /**
   * Load Calendar API on-demand
   */
  private async ensureCalendarApiLoaded(): Promise<void> {
    // Check if calendar API is already loaded
    if ((window.gapi.client as any).calendar) {
      return;
    }

    try {
      console.log('Loading Calendar API...');
      await window.gapi.client.load('calendar', 'v3');
      console.log('Calendar API loaded successfully');
    } catch (error) {
      console.error('Failed to load Calendar API:', error);
      throw new Error('Calendar API not available. Please enable it in Google Cloud Console.');
    }
  }

  /**
   * Get or create the "IT Workload Tracker" calendar
   */
  async getOrCreateWorkloadCalendar(): Promise<string> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google');
    }

    // Ensure Calendar API is loaded
    await this.ensureCalendarApiLoaded();

    // Check if we have a cached calendar ID
    const cachedCalendarId = localStorage.getItem('workload_calendar_id');
    if (cachedCalendarId) {
      try {
        // Verify the calendar still exists
        await (window.gapi.client as any).calendar.calendars.get({
          calendarId: cachedCalendarId
        });
        this.calendarId = cachedCalendarId;
        console.log('Using cached calendar ID:', cachedCalendarId);
        return cachedCalendarId;
      } catch (error) {
        console.warn('Cached calendar not found, will create new one');
        localStorage.removeItem('workload_calendar_id');
      }
    }

    // List all calendars to find our workload calendar
    try {
      const response = await (window.gapi.client as any).calendar.calendarList.list();
      const calendars = response.result.items || [];
      
      const workloadCalendar = calendars.find((cal: any) => 
        cal.summary === this.CALENDAR_NAME
      );

      if (workloadCalendar) {
        this.calendarId = workloadCalendar.id;
        localStorage.setItem('workload_calendar_id', workloadCalendar.id);
        console.log('Found existing calendar:', workloadCalendar.id);
        return workloadCalendar.id;
      }
    } catch (error) {
      console.error('Error listing calendars:', error);
    }

    // Create new calendar
    try {
      const response = await (window.gapi.client as any).calendar.calendars.insert({
        resource: {
          summary: this.CALENDAR_NAME,
          description: this.CALENDAR_DESCRIPTION,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      this.calendarId = response.result.id;
      localStorage.setItem('workload_calendar_id', response.result.id);
      console.log('Created new calendar:', response.result.id);
      return response.result.id;
    } catch (error) {
      console.error('Error creating calendar:', error);
      throw new Error('Failed to create workload calendar');
    }
  }

  /**
   * Create a calendar event for a work session
   */
  async createCalendarEvent(workItem: any, session: any): Promise<string> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google');
    }

    const calendarId = await this.getOrCreateWorkloadCalendar();
    
    // Parse date and time
    const startDateTime = `${session.date}T${session.startTime}:00`;
    const endDateTime = `${session.date}T${session.endTime}:00`;

    const event = {
      summary: workItem.name || 'Untitled Work Item',
      description: session.notes || workItem.notes || '',
      start: {
        dateTime: startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      extendedProperties: {
        private: {
          workloadTrackerId: workItem.id,
          workloadTrackerBucket: session.bucket || 'unknown',
          workloadSessionId: session.id
        }
      },
      colorId: '9' // Blue color for work items
    };

    try {
      const response = await (window.gapi.client as any).calendar.events.insert({
        calendarId: calendarId,
        resource: event
      });

      console.log('Created calendar event:', response.result.id);
      return response.result.id;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateCalendarEvent(eventId: string, session: any, workItem: any): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google');
    }

    const calendarId = await this.getOrCreateWorkloadCalendar();
    
    const startDateTime = `${session.date}T${session.startTime}:00`;
    const endDateTime = `${session.date}T${session.endTime}:00`;

    const event = {
      summary: workItem.name || 'Untitled Work Item',
      description: session.notes || workItem.notes || '',
      start: {
        dateTime: startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    try {
      await (window.gapi.client as any).calendar.events.patch({
        calendarId: calendarId,
        eventId: eventId,
        resource: event
      });

      console.log('Updated calendar event:', eventId);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteCalendarEvent(eventId: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google');
    }

    const calendarId = await this.getOrCreateWorkloadCalendar();

    try {
      await (window.gapi.client as any).calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId
      });

      console.log('Deleted calendar event:', eventId);
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * List all calendar events from the workload calendar
   */
  async listCalendarEvents(): Promise<any[]> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google');
    }

    const calendarId = await this.getOrCreateWorkloadCalendar();

    try {
      const response = await (window.gapi.client as any).calendar.events.list({
        calendarId: calendarId,
        timeMin: new Date().toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.result.items || [];
    } catch (error) {
      console.error('Error listing calendar events:', error);
      return [];
    }
  }

  /**
   * Get calendar ID for external use
   */
  getCalendarId(): string | null {
    return this.calendarId;
  }
}

// Global instance
export const googleSheetsService = new GoogleSheetsService();

// Type declarations for global Google APIs
declare global {
  interface Window {
    gapi: any;
    googleSheetsService?: GoogleSheetsService;
  }
}

// Expose service on window for console usage
if (typeof window !== 'undefined') {
  (window as any).googleSheetsService = googleSheetsService;
  console.log('Google Sheets service exposed to window');
}
