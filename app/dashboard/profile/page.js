'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, BookOpen, Briefcase, Crown, GraduationCap, User } from 'lucide-react'
import { getLearningStyleUiOptions } from '@/lib/learning-styles/recipes'
import { formatInTimeZone } from '@/lib/classrooms/format'

const learningStyleOptions = getLearningStyleUiOptions()

function ProfilePageFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse flex items-center gap-2 text-muted-foreground">
        <User className="h-6 w-6 text-primary" />
        <span className="text-lg font-medium">Loading Profile...</span>
      </div>
    </div>
  )
}

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rewards, setRewards] = useState([])
  const [formData, setFormData] = useState({
    full_name: '',
    education_level: '',
    occupation: '',
    learning_goals: '',
    preferred_learning_style: '',
    learning_schedule: ''
  })
  
  const nextPath = searchParams.get('next')

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const [profileResponse, rewardsResponse] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/classrooms/my/rewards')
        ])

        if (profileResponse.ok) {
          const data = await profileResponse.json()
          if (data) {
            setFormData({
              full_name: data.full_name || '',
              education_level: data.education_level || '',
              occupation: data.occupation || '',
              learning_goals: data.learning_goals || '',
              preferred_learning_style: data.preferred_learning_style || '',
              learning_schedule: data.learning_schedule || ''
            })
          }
        }

        if (rewardsResponse.ok) {
          const rewardPayload = await rewardsResponse.json()
          setRewards(rewardPayload.rewards || [])
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Basic Validation
    if (!formData.full_name || !formData.education_level || !formData.preferred_learning_style) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success('Profile updated successfully!')

        if (nextPath) {
          router.push(nextPath)
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return <ProfilePageFallback />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
            className="h-10 w-10 hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Your Profile
            </h1>
            <p className="text-muted-foreground">Tell us about yourself to get personalized learning paths</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            {rewards.length > 0 && (
              <Card className="glass-card border-amber-300/20 bg-amber-500/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <CardTitle>Active Classroom Rewards</CardTitle>
                  </div>
                  <CardDescription>Your current classroom badges stay visible until the next weekly winner is finalized.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rewards.map((reward) => (
                    <div key={reward.id} className="rounded-3xl border border-amber-300/20 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">Weekly Star</div>
                          <div className="mt-1 text-lg font-semibold text-foreground">{reward.classroomName}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Active until {formatInTimeZone(new Date(new Date(reward.badgeActiveTo).getTime() - 1), reward.classroomTimeZone)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-foreground">{reward.winnerScore}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Score</div>
                        </div>
                      </div>
                      {reward.rewardTitle && <div className="mt-3 font-medium text-foreground">{reward.rewardTitle}</div>}
                      {reward.teacherNote && <div className="mt-2 text-sm text-muted-foreground">{reward.teacherNote}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Personal Info Card */}
            <Card className="glass-card border-white/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>Personal Details</CardTitle>
                </div>
                <CardDescription>Basic information to personalize your experience</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input 
                    id="full_name" 
                    placeholder="e.g. Alex Doe" 
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    className="bg-background/50 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="occupation" 
                      placeholder="e.g. Software Engineer" 
                      className="pl-9 bg-background/50 border-white/10" 
                      value={formData.occupation}
                      onChange={(e) => handleChange('occupation', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Learning Preferences Card */}
            <Card className="glass-card border-white/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <CardTitle>Education & Learning Style</CardTitle>
                </div>
                <CardDescription>Helps us tailor the complexity and format of topics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="education_level">Education Level *</Label>
                    <Select 
                      value={formData.education_level} 
                      onValueChange={(val) => handleChange('education_level', val)}
                    >
                      <SelectTrigger className="bg-background/50 border-white/10">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High School">High School</SelectItem>
                        <SelectItem value="Undergraduate">Undergraduate</SelectItem>
                        <SelectItem value="Graduate">Graduate</SelectItem>
                        <SelectItem value="PhD">PhD</SelectItem>
                        <SelectItem value="Self-Taught">Self-Taught</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="learning_style">Preferred Learning Style *</Label>
                    <Select 
                      value={formData.preferred_learning_style} 
                      onValueChange={(val) => handleChange('preferred_learning_style', val)}
                    >
                      <SelectTrigger className="bg-background/50 border-white/10">
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {learningStyleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.preferred_learning_style ? (
                      <div className="rounded-xl border border-white/10 bg-background/40 px-3 py-3 text-sm">
                        {learningStyleOptions
                          .filter((option) => option.value === formData.preferred_learning_style)
                          .map((option) => (
                            <div key={option.value} className="space-y-1">
                              <p className="font-medium text-foreground">{option.description}</p>
                              <p className="text-muted-foreground">{option.preview}</p>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="learning_schedule">Typical Learning Schedule</Label>
                  <Select 
                    value={formData.learning_schedule} 
                    onValueChange={(val) => handleChange('learning_schedule', val)}
                  >
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue placeholder="How often do you learn?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily (30+ mins)">Daily (30+ mins)</SelectItem>
                      <SelectItem value="Few times a week">Few times a week</SelectItem>
                      <SelectItem value="Weekends only">Weekends only</SelectItem>
                      <SelectItem value="Sporadic">Sporadic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Goals Card */}
            <Card className="glass-card border-white/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <CardTitle>Learning Goals</CardTitle>
                </div>
                <CardDescription>What do you hope to achieve?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="goals">Goals *</Label>
                  <Textarea 
                    id="goals" 
                    placeholder="e.g. I want to learn React to build my own startup..." 
                    className="min-h-[100px] bg-background/50 border-white/10"
                    value={formData.learning_goals}
                    onChange={(e) => handleChange('learning_goals', e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-4 border-t border-white/5">
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-white min-w-[150px] shadow-lg shadow-primary/20"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <ProfilePageContent />
    </Suspense>
  )
}
