# Quickstart: Real-Time Chat System Manual Testing Guide

**Date**: 2025-10-04
**Purpose**: Manual testing steps to validate all acceptance scenarios from spec.md

## Prerequisites

1. **Backend Running**:
   ```bash
   cd backend
   npm install
   npm run dev  # Starts Express + Socket.IO server on port 3000
   ```

2. **Frontend Running**:
   ```bash
   cd frontend
   npm install
   npm run dev  # Starts Vite dev server on port 5173
   ```

3. **Redis Running**:
   ```bash
   redis-server  # Default port 6379
   ```

4. **SQLite Database Initialized**:
   ```bash
   cd backend
   npm run db:migrate  # Creates tables and indexes
   ```

5. **Test Data (Optional)**:
   ```bash
   npm run db:seed  # Creates test rooms and users
   ```

---

## Test Scenario 1: User Authentication & Room Join

**Acceptance Criteria**: Scenario #1 from spec.md

### Steps

1. **Open browser** to `http://localhost:5173`

2. **Authenticate**:
   - Enter username: `alice` (3-20 alphanumeric characters)
   - Click "Login"
   - ✅ **Verify**: Redirected to chat view, username displayed in header

3. **Join Room**:
   - Select "general" room from room list sidebar
   - Click "Join Room"
   - ✅ **Verify**: Message history loads within 2 seconds (PR-002)
   - ✅ **Verify**: Presence indicator shows "alice" in online users list (FR-004)

4. **Open Second Browser Tab**:
   - Repeat steps 1-3 with username: `bob`
   - ✅ **Verify**: Alice's browser shows "bob" in online users list within 500ms (PR-003)
   - ✅ **Verify**: Bob's browser shows both "alice" and "bob" online

**Expected Result**: ✅ Both users see each other's presence in real-time without page refresh

---

## Test Scenario 2: Real-Time Message Delivery

**Acceptance Criteria**: Scenario #2 from spec.md

### Steps

1. **As Alice** (from Scenario 1):
   - Type message: "Hello, Bob!"
   - Click "Send" or press Enter
   - ✅ **Verify**: Checkmark (✓) appears next to message within 1 second (FR-012, PR-001)

2. **As Bob** (in separate browser tab):
   - ✅ **Verify**: Message "Hello, Bob!" appears instantly (within 1 second) without page refresh (FR-002)
   - ✅ **Verify**: Message shows sender "alice", timestamp, and content

3. **As Bob**:
   - Reply with: "Hi, Alice!"
   - ✅ **Verify**: Alice's browser receives message instantly

**Expected Result**: ✅ Messages delivered bidirectionally in real-time (<1s delivery per PR-001)

---

## Test Scenario 3: Presence Updates (Join/Leave)

**Acceptance Criteria**: Scenario #3 from spec.md

### Steps

1. **As Charlie** (open third browser tab):
   - Login as `charlie`
   - Join "general" room
   - ✅ **Verify**: Alice and Bob's browsers show "charlie" in online users list within 500ms (PR-003)

2. **As Charlie**:
   - Click "Leave Room" button
   - ✅ **Verify**: Charlie's browser shows empty chat view (no room active)
   - ✅ **Verify**: Alice and Bob's browsers remove "charlie" from online users list

3. **As Alice**:
   - Close browser tab (simulate disconnect)
   - ✅ **Verify**: Bob's browser removes "alice" from online users list

**Expected Result**: ✅ Presence updates propagate to all room users in real-time

---

## Test Scenario 4: Message History Persistence

**Acceptance Criteria**: Scenario #4, #6 from spec.md

### Steps

1. **As Alice**:
   - Send 3 messages to "general" room:
     - "Message 1"
     - "Message 2"
     - "Message 3"

2. **Stop Frontend Server**:
   ```bash
   # Ctrl+C in frontend terminal
   ```

3. **Restart Frontend Server**:
   ```bash
   npm run dev
   ```

4. **As Alice**:
   - Re-login as `alice`
   - Join "general" room
   - ✅ **Verify**: All 3 messages appear in message history
   - ✅ **Verify**: Messages displayed in chronological order (oldest first, based on timestamp)

5. **Restart Backend Server**:
   ```bash
   # Ctrl+C in backend terminal, then:
   npm run dev
   ```

6. **As Alice**:
   - Refresh browser
   - Re-login and join "general" room
   - ✅ **Verify**: All messages still present (persisted to SQLite; FR-023)

**Expected Result**: ✅ Messages persist across app restarts (SQLite storage; FR-014)

---

## Test Scenario 5: Message Ordering with Concurrent Sends

**Acceptance Criteria**: Edge case - client timestamp ordering

### Steps

1. **Setup**:
   - Alice and Bob both in "general" room

2. **Simulate Concurrent Sends**:
   - As Alice: Send "Alice message 1" (note timestamp T1)
   - As Bob: Send "Bob message 1" immediately after (timestamp T2, where T2 > T1)
   - As Alice: Send "Alice message 2" (timestamp T3, where T3 > T2)

3. **Verify Ordering**:
   - ✅ **Verify**: Both browsers display messages in order:
     1. Alice message 1 (T1)
     2. Bob message 1 (T2)
     3. Alice message 2 (T3)
   - ✅ **Verify**: Order matches client timestamps (FR-008)

**Expected Result**: ✅ Messages ordered by client timestamp, not server arrival time

---

## Test Scenario 6: Pagination (Large Message History)

**Acceptance Criteria**: FR-020 (50/100/200/500 messages per page)

### Steps

1. **Seed Large Dataset**:
   ```bash
   cd backend
   npm run db:seed:large  # Creates 500 messages in "general" room
   ```

2. **As Alice**:
   - Join "general" room
   - ✅ **Verify**: Only 50 most recent messages load initially (default page size)
   - ✅ **Verify**: Load time <2 seconds (PR-002)

3. **Load More Messages**:
   - Scroll to top of message list
   - Click "Load More" button
   - ✅ **Verify**: Next 50 messages load (page 2)

4. **Change Page Size**:
   - Select "100 messages" from page size dropdown
   - Click "Refresh"
   - ✅ **Verify**: 100 messages displayed

5. **Verify Pagination Controls**:
   - ✅ **Verify**: "Previous" and "Next" buttons enable/disable correctly
   - ✅ **Verify**: Current page number displayed
   - ✅ **Verify**: "Load More" button hidden when no more messages

**Expected Result**: ✅ Pagination works correctly with 50/100/200/500 message page sizes

---

## Test Scenario 7: Room Switching (One Room at a Time)

**Acceptance Criteria**: Scenario #9, FR-017, FR-018

### Steps

1. **Create Rooms**:
   - As Alice: Create room "room-a"
   - As Alice: Create room "room-b"

2. **Join Room A**:
   - As Alice: Join "room-a"
   - As Bob: Join "room-a"
   - ✅ **Verify**: Both users see each other online in "room-a"

3. **Switch Room (Alice)**:
   - As Alice: Click "room-b" in room list (join room-b)
   - ✅ **Verify**: Alice's browser shows "room-b" as active room
   - ✅ **Verify**: Bob's browser removes "alice" from "room-a" online users
   - ✅ **Verify**: Room switching completes within 1 second (PR-008)

4. **Verify Single Room Constraint**:
   - As Alice: Try to open "room-a" in new browser tab while still in "room-b"
   - ✅ **Verify**: Opening "room-a" disconnects Alice from "room-b" (FR-017 single session)

**Expected Result**: ✅ Users can only be in one room at a time; presence updates correctly on room switch

---

## Test Scenario 8: Connection Loss & Reconnection

**Acceptance Criteria**: FR-016, FR-025 (5 retry attempts)

### Steps

1. **Simulate Connection Loss**:
   - As Alice: In "general" room
   - Stop backend server (`Ctrl+C` in backend terminal)
   - ✅ **Verify**: Alice's browser shows "Disconnected" status
   - ✅ **Verify**: Alice's browser shows "Reconnecting... (attempt 1 of 5)" message

2. **Restart Server**:
   - Restart backend: `npm run dev`
   - ✅ **Verify**: Alice's browser shows "Reconnected" within 5 seconds
   - ✅ **Verify**: Alice remains in "general" room after reconnection

3. **Simulate Failed Reconnection**:
   - Stop backend server again
   - Wait for 5 reconnection attempts (10-15 seconds total)
   - ✅ **Verify**: After 5 attempts, Alice's browser shows error: "Unable to reconnect. Please refresh the page."
   - ✅ **Verify**: "Retry" button appears for manual reconnection

**Expected Result**: ✅ Automatic reconnection with 5 retries; user-friendly error after failures

---

## Test Scenario 9: Message Send Failure & Retry

**Acceptance Criteria**: FR-019 (3 retry attempts)

### Steps

1. **Setup**:
   - As Alice: In "general" room with Bob

2. **Simulate Send Failure**:
   - As Alice: Disconnect network (turn off Wi-Fi or unplug Ethernet)
   - As Alice: Type and send message "This will fail"
   - ✅ **Verify**: Message shows "Sending..." spinner
   - ✅ **Verify**: After 3 retry attempts (~3 seconds), message shows red X icon
   - ✅ **Verify**: Error message: "Failed to send. Try again later."

3. **Retry Send**:
   - As Alice: Reconnect network
   - As Alice: Click "Retry" button next to failed message
   - ✅ **Verify**: Message sends successfully and shows checkmark

**Expected Result**: ✅ Failed messages retry 3 times; user can manually retry after failure

---

## Test Scenario 10: Accessibility (Keyboard Navigation)

**Acceptance Criteria**: UI-009 (WCAG 2.1 AA keyboard navigation)

### Steps

1. **Keyboard Navigation**:
   - Press `Tab` to navigate between UI elements
   - ✅ **Verify**: Focus indicator visible on: room list, message input, send button, pagination controls
   - ✅ **Verify**: Tab order logical (top-to-bottom, left-to-right)

2. **Message Input**:
   - Focus message input field (Tab until focused)
   - Type message and press `Enter`
   - ✅ **Verify**: Message sends without clicking "Send" button

3. **Room Switching**:
   - Use `Tab` to focus room list
   - Use arrow keys to select different room
   - Press `Enter` to join selected room
   - ✅ **Verify**: Room switch works without mouse

4. **Screen Reader Test** (if available):
   - Enable screen reader (VoiceOver on Mac, NVDA on Windows)
   - ✅ **Verify**: All interactive elements have ARIA labels
   - ✅ **Verify**: New messages announced to screen reader

**Expected Result**: ✅ All functionality accessible via keyboard; ARIA labels present

---

## Test Scenario 11: Cross-Browser Compatibility

**Acceptance Criteria**: UI-011 (Chrome, Firefox, Safari, Edge)

### Steps

1. **Test in Chrome**:
   - Repeat Scenarios 1-5 in Google Chrome
   - ✅ **Verify**: All functionality works

2. **Test in Firefox**:
   - Repeat Scenarios 1-5 in Mozilla Firefox
   - ✅ **Verify**: All functionality works

3. **Test in Safari** (if on macOS):
   - Repeat Scenarios 1-5 in Safari
   - ✅ **Verify**: All functionality works

4. **Test in Edge** (if on Windows):
   - Repeat Scenarios 1-5 in Microsoft Edge
   - ✅ **Verify**: All functionality works

**Expected Result**: ✅ Consistent behavior across all supported browsers

---

## Test Scenario 12: Performance Budgets

**Acceptance Criteria**: PR-001, PR-002, PR-003, PR-007

### Steps

1. **Open DevTools** (F12 in browser)

2. **Measure Page Load**:
   - Reload frontend page
   - Check Network tab → "Load" time
   - ✅ **Verify**: Page load <2 seconds (PR-007)

3. **Measure Message Delivery**:
   - As Alice: Send message
   - As Bob: Note timestamp when message appears
   - ✅ **Verify**: Delivery time <1 second (PR-001)

4. **Measure Presence Update**:
   - As Charlie: Join room
   - As Alice/Bob: Note timestamp when "charlie" appears in online users
   - ✅ **Verify**: Presence update <500ms (PR-003)

5. **Measure Message History Load**:
   - As Alice: Join room with 500 messages
   - Check Network tab → API request duration
   - ✅ **Verify**: History load <2 seconds (PR-002)

**Expected Result**: ✅ All performance budgets met

---

## Test Scenario 13: Security (Input Sanitization)

**Acceptance Criteria**: SR-002 (prevent XSS injection)

### Steps

1. **XSS Test**:
   - As Alice: Send message containing HTML: `<script>alert('XSS')</script>`
   - ✅ **Verify**: Message displays as plain text (HTML escaped)
   - ✅ **Verify**: No alert popup appears

2. **SQL Injection Test** (username):
   - Try to login with username: `admin' OR '1'='1`
   - ✅ **Verify**: Login fails with error "Invalid username format"

3. **Message Length Validation**:
   - As Alice: Send message with 2001 characters
   - ✅ **Verify**: Error message: "Message too long (max 2000 characters)"

**Expected Result**: ✅ All inputs validated and sanitized; no injection attacks possible

---

## Performance Checklist

- [ ] Page load <2 seconds (PR-007)
- [ ] Message delivery <1 second (PR-001)
- [ ] Presence updates <500ms (PR-003)
- [ ] Message history load <2 seconds (PR-002)
- [ ] Room switching <1 second (PR-008)
- [ ] Database writes <100ms (PR-005) - check server logs

---

## Acceptance Checklist

- [ ] Scenario 1: User authentication & room join ✅
- [ ] Scenario 2: Real-time message delivery ✅
- [ ] Scenario 3: Presence updates ✅
- [ ] Scenario 4: Message history persistence ✅
- [ ] Scenario 5: Message ordering ✅
- [ ] Scenario 6: Pagination ✅
- [ ] Scenario 7: Room switching ✅
- [ ] Scenario 8: Reconnection logic ✅
- [ ] Scenario 9: Message retry ✅
- [ ] Scenario 10: Accessibility ✅
- [ ] Scenario 11: Cross-browser ✅
- [ ] Scenario 12: Performance ✅
- [ ] Scenario 13: Security ✅

---

## Notes

- Run all scenarios in sequence for comprehensive validation
- Document any failures or deviations from expected behavior
- Re-run tests after bug fixes
- Performance measurements may vary based on network/hardware; aim for averages over 5 runs
