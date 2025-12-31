import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { QuotaCheckResponse } from '@/types/subscription';

export async function GET(request: NextRequest) {
  try {
    // Get query parameter
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!action || (action !== 'create_workspace' && action !== 'add_member')) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "create_workspace" or "add_member".' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (action === 'create_workspace') {
      return await checkWorkspaceQuota(supabase, user.id);
    } else {
      return await checkMemberQuota(supabase, user.id);
    }
  } catch (error: any) {
    console.error('Error checking quota:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function checkWorkspaceQuota(supabase: any, userId: string) {
  // Get subscription
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Get current workspace count
  const { data: currentCount } = await supabase
    .rpc('get_user_workspace_count', { p_user_id: userId });

  // Get can create workspace
  const { data: allowed } = await supabase
    .rpc('can_user_create_workspace', { p_user_id: userId });

  const count = currentCount || 0;
  const limit = subscription?.max_workspaces || 1; // Free tier: 1 workspace

  let reason: QuotaCheckResponse['reason'] | undefined;
  if (!allowed) {
    if (!subscription) {
      reason = 'no_subscription';
    } else if (!['active', 'trialing'].includes(subscription.status)) {
      reason = 'subscription_inactive';
    } else {
      reason = 'quota_exceeded';
    }
  }

  const response: QuotaCheckResponse = {
    allowed: allowed ?? false,
    reason,
    current: count,
    limit,
  };

  return NextResponse.json(response);
}

async function checkMemberQuota(supabase: any, userId: string) {
  // Get subscription
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Get current member count
  const { data: currentCount } = await supabase
    .rpc('get_user_total_member_count', { p_user_id: userId });

  // Get can add member
  const { data: allowed } = await supabase
    .rpc('can_user_add_member', { p_user_id: userId });

  const count = currentCount || 0;
  const limit = subscription?.max_members || 3; // Free tier: 3 members

  let reason: QuotaCheckResponse['reason'] | undefined;
  if (!allowed) {
    if (!subscription) {
      reason = 'no_subscription';
    } else if (!['active', 'trialing'].includes(subscription.status)) {
      reason = 'subscription_inactive';
    } else {
      reason = 'quota_exceeded';
    }
  }

  const response: QuotaCheckResponse = {
    allowed: allowed ?? false,
    reason,
    current: count,
    limit,
  };

  return NextResponse.json(response);
}
