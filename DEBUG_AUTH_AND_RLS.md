# Debugging Auth and RLS Issues

## The Problem
- Cannot create campaigns (RLS error 42501)
- Cannot import photos
- Photos not showing up

## Root Cause Analysis

The RLS policies look correct, but the issue might be:

1. **Session not loaded**: The app might be trying to create campaigns before the session is fully loaded
2. **Auth context timing**: `getDefaultCampaignId()` might be called before user is authenticated
3. **RLS policy evaluation**: The `auth.uid()` function might not be returning the correct value

## Solutions

### Solution 1: Ensure User is Authenticated Before Operations

The `getDefaultCampaignId()` function checks for user, but we should also ensure the session is active.

### Solution 2: Add Better Error Handling

Add more detailed logging to see exactly what's happening.

### Solution 3: Verify RLS Policies Are Active

Run `VERIFY_RLS_WORKING.sql` to check if policies are actually being evaluated.

## Quick Test

1. Sign out completely
2. Sign back in
3. Check browser console/logs for:
   - Session loaded
   - User ID retrieved
   - Campaign creation attempt
   - RLS error details

## Expected Flow

1. User signs in → Session created
2. `AuthContext` detects `SIGNED_IN` event
3. `initializeUserData()` runs → Creates campaign
4. `getDefaultCampaignId()` finds existing campaign
5. Library screen loads assets

## If Still Failing

Check:
- Is the user actually signed in? (Check `auth.users` table)
- Is the session token valid? (Check Supabase dashboard → Authentication → Users)
- Are RLS policies actually enabled? (Run `VERIFY_RLS_WORKING.sql`)


