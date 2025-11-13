import React, { useState } from 'react';
import { WorkItem, WorkSession } from '../ui/App';

interface CalendarSessionsProps {
  workItem: WorkItem;
  bucket: 'profiles' | 'contracts' | 'projects';
  onSessionAdd: (session: Omit<WorkSession, 'id'>) => Promise<void>;
  onSessionUpdate: (sessionId: string, session: Partial<WorkSession>) => Promise<void>;
  onSessionDelete: (sessionId: string) => Promise<void>;
}

export const CalendarSessions: React.FC<CalendarSessionsProps> = ({
  workItem,
  bucket,
  onSessionAdd,
  onSessionUpdate,
  onSessionDelete
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessions = workItem.workSessions || [];

  const handleOpenForm = (session?: WorkSession) => {
    if (session) {
      setEditingSessionId(session.id);
      setFormData({
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        notes: session.notes || ''
      });
    } else {
      setEditingSessionId(null);
      setFormData({
        date: '',
        startTime: '',
        endTime: '',
        notes: ''
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingSessionId(null);
    setFormData({ date: '', startTime: '', endTime: '', notes: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.startTime || !formData.endTime) {
      alert('Please fill in date, start time, and end time');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSessionId) {
        await onSessionUpdate(editingSessionId, formData);
      } else {
        await onSessionAdd(formData);
      }
      handleCloseForm();
    } catch (error) {
      console.error('Error saving session:', error);
      alert(`Failed to ${editingSessionId ? 'update' : 'create'} calendar session`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this calendar session?')) return;
    
    setIsSubmitting(true);
    try {
      await onSessionDelete(sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete calendar session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSessionTime = (session: WorkSession) => {
    const date = new Date(session.date);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${dateStr} • ${session.startTime} - ${session.endTime}`;
  };

  return (
    <div className="work-card-calendar-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
            📅 Calendar Sessions
          </span>
          {sessions.length > 0 && (
            <span style={{ 
              fontSize: '11px', 
              background: 'var(--accent)', 
              color: 'white', 
              padding: '2px 6px', 
              borderRadius: '10px',
              fontWeight: 600
            }}>
              {sessions.length}
            </span>
          )}
        </div>
        <button
          className="btn sm"
          onClick={() => handleOpenForm()}
          disabled={isSubmitting}
          style={{ fontSize: '11px', padding: '4px 10px' }}
        >
          + Add Session
        </button>
      </div>

      {/* Session List */}
      {sessions.length > 0 && (
        <div className="calendar-sessions-list">
          {sessions.map(session => (
            <div key={session.id} className="calendar-session-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>
                  {formatSessionTime(session)}
                </div>
                {session.notes && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
                    {session.notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {session.calendarEventId && (
                  <span style={{ fontSize: '14px', color: 'var(--brand)' }} title="Synced to calendar">
                    ✓
                  </span>
                )}
                <button
                  onClick={() => handleOpenForm(session)}
                  disabled={isSubmitting}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--ring)',
                    color: 'var(--accent)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(session.id)}
                  disabled={isSubmitting}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && !isFormOpen && (
        <div style={{ 
          textAlign: 'center', 
          padding: '16px', 
          color: 'var(--muted)', 
          fontSize: '12px',
          border: '1px dashed var(--ring)',
          borderRadius: '6px'
        }}>
          No calendar sessions scheduled. Click "Add Session" to schedule work time.
        </div>
      )}

      {/* Session Form Modal */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--ring)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>
              {editingSessionId ? 'Edit' : 'Add'} Calendar Session
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                  Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                    Start Time *
                  </label>
                  <input
                    type="time"
                    className="time-picker-input"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                    End Time *
                  </label>
                  <input
                    type="time"
                    className="time-picker-input"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                  Session Notes (optional)
                </label>
                <textarea
                  className="input"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any specific notes for this work session..."
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCloseForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingSessionId ? 'Update' : 'Create'} Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};



