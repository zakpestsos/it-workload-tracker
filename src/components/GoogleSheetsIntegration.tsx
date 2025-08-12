import React, { useState, useEffect } from 'react';
import { googleSheetsService } from '../services/googleSheetsService';

interface GoogleSheetsIntegrationProps {
  onSyncComplete?: () => void;
  onError?: (error: string) => void;
}

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({
  onSyncComplete,
  onError
}) => {
  console.log('GoogleSheetsIntegration component rendering...');
  const [isConnected, setIsConnected] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'reader' | 'writer' | 'commenter'>('writer');
  const [appShareLink, setAppShareLink] = useState('');
  const [sheetsLink, setSheetsLink] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    checkConnection();
    initializeService();
  }, []);

  // Disabled auto-sync to prevent interruptions while editing
  // useEffect(() => {
  //   if (autoSync && isConnected) {
  //     const interval = setInterval(handleAutoSync, 30000); // Sync every 30 seconds
  //     return () => clearInterval(interval);
  //   }
  // }, [autoSync, isConnected]);

  const initializeService = async () => {
    try {
      setIsLoading(true);
      await googleSheetsService.initialize();
      checkConnection();
      // If we just returned from OAuth redirect, we're authenticated but may not
      // have created the spreadsheet yet. Attempt creation once.
      if (!googleSheetsService.isConnected()) {
        try {
          await googleSheetsService.createWorkloadSheet(
            `IT Workload Tracker - ${new Date().toLocaleDateString()}`
          );
          checkConnection();
          onSyncComplete?.();
        } catch {
          // Ignore if not authenticated yet or user canceled; user can click Connect.
        }
      }
    } catch (error) {
      onError?.(`Failed to initialize Google Sheets: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnection = () => {
    const connected = googleSheetsService.isConnected();
    const configured = googleSheetsService.isConfigured();
    setIsConnected(connected);
    setIsConfigured(configured);
    
    if (connected) {
      setAppShareLink(googleSheetsService.getAppShareLink());
      setSheetsLink(googleSheetsService.getShareableLink());
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      console.log('Starting authentication process...');
      
      // Add debug info
      console.log('Current URL:', window.location.href);
      console.log('Is configured:', googleSheetsService.isConfigured());
      
      await googleSheetsService.authenticate();
      console.log('Authentication completed');
      
      // Use the specific sheet ID instead of creating new ones
      const specificSheetId = '1A1MdU3y0nRD8Fzzs-Ojj2VfE-UA903S6b9vuAavEkEI';
      console.log('Using specific sheet:', specificSheetId);
      
      // Set the specific sheet configuration
      await googleSheetsService.setSpecificSheet(specificSheetId);
      
      checkConnection();
      onSyncComplete?.();
      
      // Trigger initial sync
      handleSync();
      
    } catch (error) {
      console.error('Authentication error:', error);
      onError?.(`Failed to connect to Google Sheets: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      await googleSheetsService.disconnect();
      setIsConnected(false);
      setAppShareLink('');
      setSheetsLink('');
      setLastSync(null);
    } catch (error) {
      onError?.(`Failed to disconnect: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsLoading(true);
      
      // Trigger sync event for main app to sync data
      window.dispatchEvent(new CustomEvent('sync-to-sheets'));
      
      setLastSync(new Date());
      onSyncComplete?.();
      
    } catch (error) {
      onError?.(`Sync failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoSync = () => {
    if (isConnected && !isLoading) {
      handleSync();
    }
  };

  const handleShare = async () => {
    if (!shareEmail.trim()) {
      onError?.('Please enter an email address');
      return;
    }

    try {
      setIsLoading(true);
      await googleSheetsService.shareSpreadsheet(shareEmail.trim(), shareRole);
      setShareEmail('');
      onSyncComplete?.();
    } catch (error) {
      onError?.(`Failed to share: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      onError?.(`Failed to copy ${type} to clipboard`);
    }
  };

  return (
    <div className="google-sheets-integration">
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div 
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#22c55e' : '#ef4444'
            }}
          />
          <strong>Google Sheets Integration v3</strong>
          {lastSync && (
            <span className="muted" style={{ fontSize: '11px' }}>
              Last sync: {lastSync.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        {!isConfigured ? (
          <div>
            <p className="muted" style={{ fontSize: '13px', margin: '8px 0' }}>
              Google Sheets integration requires API credentials. 
            </p>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '12px', margin: '8px 0' }}>
              <strong style={{ fontSize: '13px', color: '#f59e0b' }}>Setup Required:</strong>
              <ol style={{ fontSize: '12px', margin: '8px 0 0 16px', color: 'var(--muted)' }}>
                <li>Create Google Cloud project</li>
                <li>Enable Google Sheets & Drive APIs</li>
                <li>Create OAuth 2.0 credentials</li>
                <li>Set environment variables</li>
              </ol>
              <p style={{ fontSize: '11px', margin: '8px 0 0 0', color: 'var(--muted)' }}>
                See <strong>GOOGLE_SHEETS_SETUP.md</strong> for detailed instructions.
              </p>
            </div>
          </div>
        ) : !isConnected ? (
          <div>
            <p className="muted" style={{ fontSize: '13px', margin: '8px 0' }}>
              Connect to Google Sheets for real-time collaboration and data backup.
            </p>
            <button 
              className="btn primary" 
              onClick={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? 'Connecting...' : 'Connect to Google Sheets'}
            </button>
          </div>
        ) : (
          <div>
            {/* Connection Status & Controls */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button 
                className="btn" 
                onClick={handleSync}
                disabled={isLoading}
              >
                {isLoading ? 'Syncing...' : 'Sync Now'}
              </button>
              <button 
                className="btn" 
                onClick={() => window.open(sheetsLink, '_blank')}
                disabled={!sheetsLink}
              >
                Open Sheets
              </button>
              <button 
                className="btn danger" 
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                Disconnect
              </button>
            </div>

            {/* Auto-sync disabled to prevent interruptions while editing */}

            {/* Sharing Section */}
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Share with Others</h4>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  className="input"
                  placeholder="Enter email address"
                  aria-label="Email address for sharing"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  style={{ flex: '1', minWidth: '200px' }}
                />
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as any)}
                  className="input"
                  aria-label="Share role"
                  style={{ width: 'auto' }}
                >
                  <option value="reader">View Only</option>
                  <option value="commenter">Comment</option>
                  <option value="writer">Edit</option>
                </select>
                <button 
                  className="btn primary" 
                  onClick={handleShare}
                  disabled={isLoading || !shareEmail.trim()}
                >
                  Share
                </button>
              </div>
            </div>

            {/* Share Links */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Share Links</h4>
              
              {appShareLink && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                    App with Data:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="input"
                      value={appShareLink}
                      readOnly
                      style={{ flex: '1', fontSize: '11px' }}
                    />
                    <button 
                      className="btn sm" 
                      onClick={() => copyToClipboard(appShareLink, 'app link')}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {sheetsLink && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Google Sheets:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="input"
                      value={sheetsLink}
                      readOnly
                      style={{ flex: '1', fontSize: '11px' }}
                    />
                    <button 
                      className="btn sm" 
                      onClick={() => copyToClipboard(sheetsLink, 'sheets link')}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
