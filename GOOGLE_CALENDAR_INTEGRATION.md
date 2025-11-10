# Google Calendar Integration for IT Workload Tracker

## Overview

Integrate Google Calendar API to allow manual scheduling of work sessions with two-way sync, time picker fields, and support for multiple calendar events per work item in a dedicated "IT Workload" calendar.

## Key Requirements

- **Manual Control**: Add/Remove calendar events via buttons (not automatic sync)
- **Time Scheduling**: Add time picker fields for scheduling specific work sessions
- **Two-Way Sync**: Changes in calendar reflect in tracker and vice versa
- **Multiple Sessions**: One work item can have multiple calendar time blocks
- **Dedicated Calendar**: Create/use "IT Workload" calendar

## Implementation Plan

### 1. Update Google Sheets Service (googleSheetsService.ts)

Add Google Calendar API initialization and methods:

- Add Calendar API to discovery docs (`calendar/v3`)
- Extend OAuth scope to include `https://www.googleapis.com/auth/calendar`
- Add method: `getOrCreateWorkloadCalendar()` - finds or creates "IT Workload" calendar
- Add method: `createCalendarEvent(workItem, session)` - creates calendar event
- Add method: `updateCalendarEvent(eventId, session)` - updates existing event
- Add method: `deleteCalendarEvent(eventId)` - removes calendar event
- Add method: `listCalendarEvents(calendarId)` - fetches events for sync
- Add method: `syncCalendarToWorkItems()` - two-way sync from calendar to tracker

### 2. Extend WorkItem Type (App.tsx)

Add calendar-related fields to WorkItem interface:

```typescript
type WorkSession = {
  id: string;
  calendarEventId?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  notes?: string;
};

type WorkItem = {
  // ... existing fields
  workSessions?: WorkSession[];
  calendarSynced?: boolean;
};
```

### 3. Add Calendar Session UI Component

Create new component for managing work sessions within each card:

**Location**: Create `src/components/CalendarSessions.tsx`

**Features**:
- Display list of scheduled work sessions
- "Add to Calendar" button (opens session form)
- Session form with:
  - Date picker
  - Start time picker (HH:MM)
  - End time picker (HH:MM)
  - Optional session notes
- Each session shows:
  - Date and time range
  - Calendar sync status (✓ synced, ⚠ pending, ✗ error)
  - Edit button
  - Delete button (removes from calendar too)
- Visual indicator if item has calendar events

### 4. Update Card Layout (App.tsx renderBucket)

Modify work card to include calendar session management:

**Add after Notes section, before Footer**:

```tsx
{/* Calendar Sessions */}
<div className="work-card-calendar-section">
  <CalendarSessions
    workItem={item}
    onSessionAdd={(session) => handleAddSession(bucketKey, item.id, session)}
    onSessionUpdate={(sessionId, session) => handleUpdateSession(bucketKey, item.id, sessionId, session)}
    onSessionDelete={(sessionId) => handleDeleteSession(bucketKey, item.id, sessionId)}
  />
</div>
```

### 5. Add Calendar Management Functions (App.tsx)

Implement session CRUD operations:

- `handleAddSession(bucket, itemId, session)`:
  - Create calendar event via API
  - Store session with calendarEventId in work item
  - Update state and sync to sheets
- `handleUpdateSession(bucket, itemId, sessionId, session)`:
  - Update calendar event via API
  - Update session in work item
  - Sync changes
- `handleDeleteSession(bucket, itemId, sessionId)`:
  - Delete calendar event via API
  - Remove session from work item
  - Update state
- `syncFromCalendar()`:
  - Fetch all events from "IT Workload" calendar
  - Match events to work items by eventId
  - Update work items with calendar changes
  - Handle deleted events

### 6. Add Calendar CSS Styles (index.html)

Add styles for calendar session UI:

```css
.work-card-calendar-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(30,41,59,0.4);
  border: 1px solid rgba(71,85,105,0.5);
  border-radius: 8px;
}

.calendar-sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calendar-session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(11,18,32,0.6);
  border: 1px solid rgba(51,65,85,0.5);
  border-radius: 6px;
}

.time-picker-input {
  background: rgba(11,18,32,0.8);
  border: 1px solid rgba(51,65,85,0.5);
  border-radius: 6px;
  padding: 6px 10px;
  color: #e2e8f0;
  font-size: 13px;
}
```

### 7. Add Sync Indicator & Controls

Add UI elements for calendar sync status:

- Badge on work card showing number of scheduled sessions
- "Sync Calendar" button in header (manual two-way sync)
- Visual indicators:
  - 📅 icon if item has calendar events
  - ✓ green checkmark if all sessions synced
  - ⚠ yellow warning if sync pending/failed
- Last sync timestamp display

### 8. Handle Two-Way Sync

Implement bidirectional synchronization:

- **Tracker → Calendar**: When session added/updated/deleted in tracker, immediately update calendar
- **Calendar → Tracker**: 
  - Manual "Sync from Calendar" button
  - Periodic check (every 5 minutes when tab active)
  - Detect external calendar changes
  - Update work items accordingly
  - Handle conflicts (show warning if both changed)

### 9. Error Handling & User Feedback

Add robust error handling:

- Show toast notifications for:
  - ✓ "Event added to calendar"
  - ✓ "Event updated"
  - ✓ "Event removed from calendar"
  - ✗ "Failed to sync: [error]"
- Retry mechanism for failed API calls
- Graceful degradation if calendar API unavailable
- Clear error messages with actionable steps

### 10. Update Google Sheets Storage

Extend sheet structure to store calendar data:

- Add "Calendar Sessions" column to each sheet (Profiles, Contracts, Projects)
- Store sessions as JSON string
- Include calendarEventId for each session
- Preserve calendar data across reloads

## Files to Modify

### `it-workload-tracker/src/services/googleSheetsService.ts`
- Add Calendar API discovery doc
- Extend OAuth scopes
- Add calendar CRUD methods
- Add calendar sync methods

### `it-workload-tracker/src/ui/App.tsx`
- Extend WorkItem type with WorkSession
- Add calendar session management functions
- Update renderBucket to include calendar UI
- Add sync functions and error handling

### `it-workload-tracker/src/components/CalendarSessions.tsx` (NEW)
- Create component for session list
- Add session form with date/time pickers
- Display sync status
- Handle add/edit/delete actions

### `it-workload-tracker/index.html`
- Add CSS for calendar session UI
- Add time picker styles
- Add sync indicator styles

## Technical Considerations

### Calendar API Integration

- Use Google Calendar API v3
- Calendar ID stored in localStorage
- Event structure:

```javascript
{
  summary: "[Work Item Name]",
  description: "[Notes]",
  start: { dateTime: "2025-11-15T14:00:00-05:00" },
  end: { dateTime: "2025-11-15T16:00:00-05:00" },
  extendedProperties: {
    private: {
      workloadTrackerId: "[item.id]",
      workloadTrackerBucket: "[profiles|contracts|projects]"
    }
  }
}
```

### Conflict Resolution

- If event changed in both places:
  - Show modal with both versions
  - Let user choose which to keep
  - Or merge changes intelligently

### Performance

- Batch calendar API calls when possible
- Cache calendar events locally
- Only sync when necessary
- Debounce sync requests

## User Workflow

1. User clicks "Add to Calendar" on a work item
2. Modal opens with session form (date, start time, end time)
3. User fills in schedule and clicks "Create"
4. Event created in "IT Workload" calendar
5. Session appears in work item with ✓ synced indicator
6. User can add multiple sessions for same work item
7. Changes in calendar automatically sync back (or via manual sync button)
8. User can edit/delete sessions from tracker (updates calendar)

## Benefits

- Clear visibility of scheduled work time
- Calendar integration for time management
- Flexible scheduling with multiple sessions
- Two-way sync keeps everything in sync
- Manual control prevents unwanted calendar clutter

