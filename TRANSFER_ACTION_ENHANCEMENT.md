# Transfer Action Enhancement - SC & Catchment Level Support

**Date:** 2026-02-04
**Status:** ✓ COMPLETE
**Build:** ✓ SUCCESS (15.24s)

---

## CHANGE SUMMARY

Enhanced the Transfer action to support both SC-scoped AND CATCHMENT-scoped users, enabling lateral transfers at both organizational levels.

---

## WHAT WAS FIXED

### Previous Limitation
- Transfer button was disabled for CATCHMENT-scoped users
- Only SC-scoped users could transfer to different Service Centres
- CATCHMENT managers couldn't transfer to other catchments

### New Capability
✅ **SC-scoped users** can transfer to different Service Centres (within any Catchment)
✅ **CATCHMENT-scoped users** can transfer to different Catchments
✅ **NATIONAL-scoped users** cannot transfer (role doesn't change location)

---

## IMPLEMENTATION DETAILS

### 1. Transfer Button Availability

**Before:**
```typescript
disabled={user.scope_type !== 'SC'}  // Only SC users could transfer
```

**After:**
```typescript
disabled={user.scope_type === 'NATIONAL'}  // Only NATIONAL users disabled
```

**Logic:**
- ✅ SC users → enabled
- ✅ CATCHMENT users → enabled
- ❌ NATIONAL users → disabled (no lateral transfer for system-wide roles)

---

### 2. Transfer Modal - Scope-Based UI

**For SC-Scoped Users:**
```
1. Current Service Centre (display only)
2. Select New Catchment → Loads Service Centres in that catchment
3. Select New Service Centre → Updates location
4. Confirm → Transfers to new SC with same role
```

**For CATCHMENT-Scoped Users:**
```
1. Current Catchment (display only)
2. Select New Catchment → Direct selection
3. Confirm → Transfers to new Catchment with same role
```

**Code:**
```typescript
{selectedUser.scope_type === 'SC' ? (
  // Show Catchment → Service Centre hierarchy
  <>
    <select value={transferCatchmentId} ...>
      {/* Catchments */}
    </select>
    <select value={transferSCId} disabled={!transferCatchmentId} ...>
      {/* Service Centres in selected catchment */}
    </select>
  </>
) : selectedUser.scope_type === 'CATCHMENT' ? (
  // Show only Catchment selection, excluding current one
  <>
    <select value={transferCatchmentId} ...>
      {catchments.filter(c => c.id !== selectedUser.scope_id).map(...)}
    </select>
  </>
) : null}
```

---

### 3. Transfer Handler - Unified Logic

**Single handler supports both transfer types:**

```typescript
const handleTransfer = async () => {
  if (selectedUser.scope_type === 'SC') {
    // SC transfer: validate new SC exists
    newScopeId = transferSCId;
    newScopeName = newSC.name;
  }
  else if (selectedUser.scope_type === 'CATCHMENT') {
    // CATCHMENT transfer: validate new catchment exists
    newScopeId = transferCatchmentId;
    newScopeName = newCatchment.name;
  }
  else {
    throw new Error('Transfer not available for National-scoped roles');
  }

  // Same logic for both: retire old, assign to new location
  await supabase.from('user_roles').update({ effective_to: NOW() })...
  await supabase.from('user_roles').insert({
    scope_type: selectedUser.scope_type,  // Keep same scope type
    scope_id: newScopeId,                 // New location
    ...
  });
};
```

---

## DATA INTEGRITY GUARANTEES

### Scope Type Never Changes
```typescript
scope_type: selectedUser.scope_type  // Always preserved
```
- SC user stays SC → transferred to different SC only
- CATCHMENT user stays CATCHMENT → transferred to different catchment only
- NATIONAL user cannot transfer (transfer button disabled)

### Role Never Changes
```typescript
role_id: selectedUser.role_id  // Always same role
```
- Technical Officer stays Technical Officer
- Catchment Manager stays Catchment Manager
- No promotions/demotions via transfer

### Foreign Key Constraints Respected
```typescript
// Validate SC belongs to database
const newSC = serviceCentres.find(sc => sc.id === transferSCId);
if (!newSC) throw new Error('Service Centre not found');

// Validate Catchment exists
const newCatchment = catchments.find(c => c.id === transferCatchmentId);
if (!newCatchment) throw new Error('Catchment not found');
```

---

## RBAC COMPLIANCE

✅ **ROLE_SCOPE_MATRIX Respected**
- SC roles (TO, RO, MO, STL) can only be transferred within SC scope
- CATCHMENT roles (CM) can only be transferred within CATCHMENT scope
- NATIONAL roles cannot transfer

✅ **Single Operational Role Maintained**
- System automatically retires old role assignment
- Creates new role assignment with new location
- Only one active role exists at any time

✅ **Audit Trail Complete**
- Logs old scope → new scope transition
- Records reason for transfer
- Documents scope_type consistency
- Captures who approved transfer

---

## TESTING SCENARIOS

### Scenario 1: Transfer SC User
1. SC-level Technical Officer at Harare SC
2. Click Transfer button → Modal shows Catchment → SC selection
3. Select Murombedzi Catchment → Loads SCs in Murombedzi
4. Select Glenorah SC (in Murombedzi)
5. Confirm → User now assigned to Glenorah SC with same role

**Result:** ✅ Role unchanged, location changed

### Scenario 2: Transfer CATCHMENT User
1. Catchment Manager at Murombedzi Catchment
2. Click Transfer button → Modal shows Catchment selection only
3. Select Harare Catchment
4. Confirm → User now assigned to Harare Catchment with same role

**Result:** ✅ Role unchanged, location changed

### Scenario 3: NATIONAL User Cannot Transfer
1. WSSE (national role) user
2. Transfer button is **DISABLED** (greyed out)
3. Cannot click to transfer

**Result:** ✅ Correctly prevents invalid transfer

---

## COMPARISON TABLE

| Level | Before | After | Button | Modal |
|-------|--------|-------|--------|-------|
| SC | ✅ Transfer | ✅ Transfer | Enabled | Catchment → SC |
| CATCHMENT | ❌ Disabled | ✅ Transfer | Enabled | Catchment only |
| NATIONAL | ❌ Disabled | ❌ Disabled | Disabled | N/A |

---

## BACKWARD COMPATIBILITY

✅ **No Breaking Changes**
- Existing SC transfers work exactly as before
- Audit logs format unchanged
- scope_type and scope_id handling identical
- RLS policies unaffected
- Route authorization unaffected

---

## DEPLOYMENT NOTES

**Build Status:** ✓ SUCCESS
**TypeScript:** ✓ No errors
**Bundle Size:** Stable (~1.9 MB)

**No new dependencies added**
**No database migrations needed**
**No configuration changes needed**

Simply deploy updated `src/pages/RoleManagement.tsx` and the feature is live.

---

## COMPLETE ACTION BUTTON REFERENCE

| Level | Promote | Demote | Transfer | Assign | Retire | Suspend | Resign |
|-------|---------|--------|----------|--------|--------|---------|--------|
| SC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CATCHMENT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| NATIONAL | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## CONCLUSION

The Transfer action now properly supports lateral transfers at both SC and CATCHMENT organizational levels, while maintaining complete data integrity, RBAC compliance, and audit accountability.

