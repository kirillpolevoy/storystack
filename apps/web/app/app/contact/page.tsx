'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { MobileMenuButton } from '@/components/app/MobileMenuButton'
import { useQuery } from '@tanstack/react-query'

export default function ContactPage() {
  const supabase = createClient()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user
    },
  })

  // Get email from user (always use logged-in user's email)
  const email = user?.email || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!subject.trim() || !message.trim()) {
      setSubmitStatus('error')
      setErrorMessage('Please fill in all fields')
      return
    }

    if (!email) {
      setSubmitStatus('error')
      setErrorMessage('You must be logged in to submit a contact form')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          userId: user?.id || null,
        },
      })

      if (error) {
        throw error
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      setSubmitStatus('success')
      setSubject('')
      setMessage('')
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitStatus('idle')
      }, 5000)
    } catch (error: any) {
      console.error('[Contact] Error submitting form:', error)
      setSubmitStatus('error')
      setErrorMessage(error.message || 'Failed to send message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <MobileMenuButton />
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                  Contact Us
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">We're here to help</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
              <MessageCircle className="h-6 w-6 text-accent" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3 tracking-tight">
              How can we help you?
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Have a question, suggestion, or need assistance? We'd love to hear from you.
            </p>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-900 mb-2">
                  What's this about?
                </label>
                <Input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Feature request, bug report, question..."
                  required
                  className="w-full h-11 text-base border-gray-300 focus:border-accent focus:ring-accent rounded-lg transition-colors"
                  disabled={isSubmitting}
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-900 mb-2">
                  Tell us more
                </label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your thoughts, questions, or feedback in detail..."
                  required
                  rows={6}
                  className="w-full resize-none text-base border-gray-300 focus:border-accent focus:ring-accent rounded-lg transition-colors"
                  disabled={isSubmitting}
                />
                <p className="mt-1.5 text-sm text-gray-500">
                  The more details you provide, the better we can help you.
                </p>
              </div>

              {/* User Email Display (Read-only) */}
              {email && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                        We'll reply to
                      </p>
                      <p className="text-sm font-medium text-gray-900">{email}</p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {submitStatus === 'success' && (
                <div className="flex items-start gap-2.5 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-900 mb-0.5">
                      Message sent successfully!
                    </p>
                    <p className="text-sm text-green-700">
                      We've received your message and will get back to you soon. Typically within 24 hours.
                    </p>
                  </div>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900 mb-0.5">
                      Something went wrong
                    </p>
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className="w-full h-11 text-base font-medium bg-accent hover:bg-accent/90 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent mr-2" />
                      Sending your message...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Additional Help Section */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Need immediate assistance? Check out our{' '}
              <a href="/app/how-to" className="text-accent hover:text-accent/80 font-medium underline">
                help center
              </a>
              {' '}for answers to common questions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
