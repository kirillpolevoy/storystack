import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionStatusResponse } from '@/types/subscription';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
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

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get workspace count using database function
    const { data: workspaceCountData } = await supabase
      .rpc('get_user_workspace_count', { p_user_id: user.id });

    // Get member count using database function
    const { data: memberCountData } = await supabase
      .rpc('get_user_total_member_count', { p_user_id: user.id });

    // Get quota check results
    const { data: canCreateWorkspace } = await supabase
      .rpc('can_user_create_workspace', { p_user_id: user.id });

    const { data: canAddMember } = await supabase
      .rpc('can_user_add_member', { p_user_id: user.id });

    const workspaceCount = workspaceCountData || 0;
    const memberCount = memberCountData || 0;

    const response: SubscriptionStatusResponse = {
      subscription: subscription
        ? {
            status: subscription.status,
            planName: subscription.plan_name,
            billingInterval: subscription.billing_interval,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            maxWorkspaces: subscription.max_workspaces,
            maxMembers: subscription.max_members,
          }
        : null,
      usage: {
        workspaceCount,
        memberCount,
      },
      canCreateWorkspace: canCreateWorkspace ?? false,
      canAddMember: canAddMember ?? false,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
