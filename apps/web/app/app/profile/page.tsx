'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Mail, Calendar, LogOut } from 'lucide-react'
import dayjs from 'dayjs'

export default function ProfilePage() {
  const supabase = createClient()

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['profile-stats'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return null

      const [assetsResult, storiesResult] = await Promise.all([
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('stories').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])

      return {
        assetCount: assetsResult.count || 0,
        storyCount: storiesResult.count || 0,
      }
    },
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Profile
          </h1>
          <p className="text-sm text-gray-500">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">
                    {user?.email || 'User'}
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    Account Information
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-base font-medium text-foreground">{user?.email}</p>
                  </div>
                </div>
                {user?.created_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Member since</p>
                      <p className="text-base font-medium text-foreground">
                        {dayjs(user.created_at).format('MMMM D, YYYY')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <CardTitle className="text-2xl font-semibold">Statistics</CardTitle>
              <CardDescription className="text-sm">
                Your account overview
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Photos</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats?.assetCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Stories</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats?.storyCount || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="p-6">
              <CardTitle className="text-2xl font-semibold">Account Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

