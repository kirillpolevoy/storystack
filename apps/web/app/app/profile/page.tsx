'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Mail, Calendar, LogOut, Camera, Lock, Trash2, Eye, EyeOff, X } from 'lucide-react'
import dayjs from 'dayjs'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function ProfilePage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordFields, setShowPasswordFields] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

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

  // Load profile photo
  useEffect(() => {
    if (user?.id) {
      loadProfilePhoto()
    }
  }, [user?.id])

  const loadProfilePhoto = async () => {
    if (!user?.id) return
    
    try {
      const { data } = await supabase
        .storage
        .from('avatars')
        .getPublicUrl(`${user.id}/profile.jpg`)
      
      // Check if image exists
      const response = await fetch(data.publicUrl, { method: 'HEAD' })
      if (response.ok) {
        setProfilePhoto(`${data.publicUrl}?t=${Date.now()}`)
      }
    } catch (error) {
      // Silently handle - no profile photo is fine
    }
  }

  const handlePickPhoto = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    try {
      setIsUploadingPhoto(true)

      // Upload to Supabase storage
      const filePath = `${user.id}/profile.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL and update state
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      
      setProfilePhoto(`${urlData.publicUrl}?t=${Date.now()}`)
    } catch (error: any) {
      console.error('[Profile] Error uploading photo:', error)
      alert(error.message || 'Failed to upload photo. Please try again.')
    } finally {
      setIsUploadingPhoto(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all fields')
      return
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match')
      return
    }

    setIsChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        throw error
      }

      alert('Password updated successfully.')
      setShowPasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      alert(error.message || 'Failed to update password. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user?.id) return

    setIsDeletingAccount(true)
    try {
      // Delete user data in order (same as mobile app)
      const userId = user.id

      // 1. Get all story IDs
      const { data: userStories } = await supabase
        .from('stories')
        .select('id')
        .eq('user_id', userId)

      // 2. Delete story_assets
      if (userStories && userStories.length > 0) {
        const storyIds = userStories.map(s => s.id)
        await supabase
          .from('story_assets')
          .delete()
          .in('story_id', storyIds)
      }

      // 3. Delete stories
      await supabase
        .from('stories')
        .delete()
        .eq('user_id', userId)

      // 4. Get asset IDs and storage paths
      const { data: userAssets } = await supabase
        .from('assets')
        .select('id, storage_path')
        .eq('user_id', userId)

      // 5. Delete assets
      await supabase
        .from('assets')
        .delete()
        .eq('user_id', userId)

      // 6. Delete asset storage files
      if (userAssets && userAssets.length > 0) {
        const storagePaths = userAssets
          .map(asset => asset.storage_path)
          .filter(path => path)
        
        if (storagePaths.length > 0) {
          await supabase.storage
            .from('assets')
            .remove(storagePaths)
        }
      }

      // 7. Delete tag_config
      await supabase
        .from('tag_config')
        .delete()
        .eq('user_id', userId)

      // 8. Delete avatar
      try {
        await supabase.storage
          .from('avatars')
          .remove([`${userId}/profile.jpg`])
      } catch (error) {
        // Ignore avatar deletion errors
      }

      // 9. Delete auth user (this will cascade delete other user data)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
      
      if (deleteError) {
        // If admin API not available, try to delete via RPC or just sign out
        console.warn('[Profile] Admin delete not available, signing out instead')
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }

      // Sign out and redirect
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (error: any) {
      console.error('[Profile] Error deleting account:', error)
      alert(error.message || 'Failed to delete account. Please try again or contact support.')
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteConfirmModal(false)
      setShowDeleteAccountModal(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="px-8 pt-6 pb-4">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">
            Profile
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Manage your account and preferences
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Photo Section */}
          <Card className="rounded-xl border-gray-200 shadow-sm">
            <CardContent className="p-8">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <button
                    onClick={handlePickPhoto}
                    disabled={isUploadingPhoto}
                    className="relative group"
                  >
                    {profilePhoto ? (
                      <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-accent shadow-lg">
                        <Image
                          src={profilePhoto}
                          alt="Profile"
                          fill
                          className="object-cover"
                          sizes="128px"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-accent/10 border-4 border-accent flex items-center justify-center shadow-lg">
                        {isUploadingPhoto ? (
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-accent border-r-transparent"></div>
                        ) : (
                          <span className="text-5xl font-bold text-accent">
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Edit Badge */}
                    {!isUploadingPhoto && (
                      <div className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-accent border-4 border-white flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                
                <h2 className="mt-6 text-xl font-semibold text-gray-900">
                  {user?.email || 'Not available'}
                </h2>
                {user?.created_at && (
                  <p className="mt-1 text-sm text-gray-500">
                    Member since {dayjs(user.created_at).format('MMMM D, YYYY')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="rounded-xl border-gray-200 shadow-sm">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-semibold">Statistics</CardTitle>
              <CardDescription className="text-sm">
                Your account overview
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Photos</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats?.assetCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Stories</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats?.storyCount || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card className="rounded-xl border-gray-200 shadow-sm">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-semibold">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="flex items-center gap-3 py-2">
                <Mail className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-base font-medium text-gray-900">{user?.email}</p>
                </div>
              </div>
              {user?.created_at && (
                <div className="flex items-center gap-3 py-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Member since</p>
                    <p className="text-base font-medium text-gray-900">
                      {dayjs(user.created_at).format('MMMM D, YYYY')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="rounded-xl border-gray-200 shadow-sm">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-semibold">Account Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-3">
              <Button
                variant="outline"
                onClick={() => setShowPasswordModal(true)}
                className="w-full justify-start h-12 text-base font-medium border-gray-300 hover:bg-gray-50"
              >
                <Lock className="mr-3 h-5 w-5" />
                Change Password
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteAccountModal(true)}
                className="w-full justify-start h-12 text-base font-medium border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <Trash2 className="mr-3 h-5 w-5" />
                Delete Account
              </Button>
              <div className="pt-2 border-t border-gray-200">
                <Button
                  onClick={handleLogout}
                  className="w-full h-12 text-base font-semibold bg-red-600 hover:bg-red-700 text-white"
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Change Password</DialogTitle>
            <DialogDescription className="text-sm">
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Current Password</label>
              <div className="relative">
                <Input
                  type={showPasswordFields.current ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordFields({ ...showPasswordFields, current: !showPasswordFields.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPasswordFields.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">New Password</label>
              <div className="relative">
                <Input
                  type={showPasswordFields.new ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordFields({ ...showPasswordFields, new: !showPasswordFields.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPasswordFields.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showPasswordFields.confirm ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pr-12 ${confirmPassword && newPassword !== confirmPassword ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordFields({ ...showPasswordFields, confirm: !showPasswordFields.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPasswordFields.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordModal(false)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
              }}
              className="border-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="bg-accent hover:bg-accent/90"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteAccountModal} onOpenChange={setShowDeleteAccountModal}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                  Delete Account?
                </AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="text-sm text-gray-600 mt-2">
              Are you sure you want to delete your account? This action cannot be undone. All your photos, stories, and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteAccountModal(false)
                setShowDeleteConfirmModal(true)
              }}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final Delete Confirmation */}
      <AlertDialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                  Final Confirmation
                </AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="text-sm text-gray-600 mt-2">
              This will permanently delete your account and all data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {isDeletingAccount ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
