'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Play, Lock, Clock, BookOpen, CheckCircle,
  ChevronDown, Download, FileText, ExternalLink,
  Smartphone, Monitor, ThumbsUp, ThumbsDown, Star, Trophy,
  Eye, Shield, Link2, Bot, Search, AlertTriangle, Sparkles,
  Video, Globe, Lightbulb, ArrowRight, Users,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Course {
  id: string
  title: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  modules: number
  duration: string
  progress: number // 0-100, -1 = locked
  description: string
}

interface Tutorial {
  id: string
  title: string
  duration: string
  category: string
  views: string
  thumbnailColor: string
}

interface ReferenceCard {
  id: string
  title: string
  icon: React.ElementType
  points: string[]
}

interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

interface CommunityTip {
  id: string
  user: string
  avatar: string
  tip: string
  upvotes: number
  downvotes: number
  timestamp: string
  badge: string
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Deepfake Detection 101',
    difficulty: 'Beginner',
    modules: 8,
    duration: '2.5 hrs',
    progress: 40,
    description: 'Learn the fundamentals of identifying AI-generated and manipulated video content.',
  },
  {
    id: 'c2',
    title: 'Advanced Image Forensics',
    difficulty: 'Advanced',
    modules: 12,
    duration: '4 hrs',
    progress: -1, // locked
    description: 'Deep dive into ELA analysis, metadata forensics, and pixel-level manipulation detection.',
  },
  {
    id: 'c3',
    title: 'Fact-Checking Methodology',
    difficulty: 'Intermediate',
    modules: 6,
    duration: '1.5 hrs',
    progress: 75,
    description: 'Master the systematic approach to verifying claims and identifying misinformation.',
  },
  {
    id: 'c4',
    title: 'Understanding AI Bias',
    difficulty: 'Beginner',
    modules: 5,
    duration: '1 hr',
    progress: 0,
    description: 'Explore how AI models can perpetuate bias and learn to recognize biased outputs.',
  },
]

const TUTORIALS: Tutorial[] = [
  { id: 't1', title: 'How to Spot AI-Generated Faces', duration: '8 min', category: 'Deepfakes', views: '24.5K', thumbnailColor: 'from-zinc-500/20 to-zinc-500/20' },
  { id: 't2', title: 'Understanding ELA Analysis', duration: '12 min', category: 'Forensics', views: '18.2K', thumbnailColor: 'from-purple-500/20 to-pink-500/20' },
  { id: 't3', title: 'Fact-Checking with Google Tools', duration: '10 min', category: 'Fact-Check', views: '31.7K', thumbnailColor: 'from-amber-500/20 to-orange-500/20' },
  { id: 't4', title: 'Audio Deepfake Red Flags', duration: '7 min', category: 'Deepfakes', views: '12.8K', thumbnailColor: 'from-red-500/20 to-rose-500/20' },
  { id: 't5', title: 'Metadata Analysis Deep Dive', duration: '15 min', category: 'Forensics', views: '9.4K', thumbnailColor: 'from-cyan-500/20 to-blue-500/20' },
  { id: 't6', title: 'Protecting Yourself Online', duration: '6 min', category: 'Safety', views: '45.1K', thumbnailColor: 'from-zinc-500/20 to-cyan-500/20' },
]

const REFERENCE_CARDS: ReferenceCard[] = [
  {
    id: 'r1',
    title: '5 Signs of a Deepfake Video',
    icon: Video,
    points: [
      'Unnatural blinking patterns or no blinking at all',
      'Inconsistent lighting and shadows on the face',
      'Blurring or flickering around the edges of the face',
      'Audio-visual desync (lip movements don\'t match audio)',
      'Unusual skin texture - too smooth or waxy appearance',
    ],
  },
  {
    id: 'r2',
    title: 'How to Verify an Image Source',
    icon: Search,
    points: [
      'Perform a reverse image search on Google or TinEye',
      'Check EXIF metadata for camera and editing software info',
      'Look for inconsistent compression artifacts (ELA analysis)',
      'Cross-reference with known original sources',
      'Verify the upload date vs. claimed event date',
    ],
  },
  {
    id: 'r3',
    title: 'Recognizing Clickbait Headlines',
    icon: AlertTriangle,
    points: [
      'Uses extreme emotional language (SHOCKING, UNBELIEVABLE)',
      'Withholds key information to force clicks ("You won\'t believe...")',
      'Makes extraordinary claims without evidence links',
      'Mismatches between headline and article content',
    ],
  },
  {
    id: 'r4',
    title: 'Checking URL Authenticity',
    icon: Link2,
    points: [
      'Verify the domain matches the claimed organization',
      'Look for subtle misspellings (g00gle.com vs google.com)',
      'Check for HTTPS - but remember HTTPS ≠ trustworthy',
      'Use WHOIS lookup to check domain registration details',
      'Beware of URL shorteners hiding the real destination',
    ],
  },
  {
    id: 'r5',
    title: 'Identifying Bot Accounts',
    icon: Bot,
    points: [
      'Profile with no profile picture or generic stock images',
      'Extremely high posting frequency with repetitive content',
      'Account created recently with sudden large following',
      'Lack of personal posts, only retweets or shares',
    ],
  },
  {
    id: 'r6',
    title: 'Evaluating Source Credibility',
    icon: Shield,
    points: [
      'Check if the source has a clear editorial policy and corrections section',
      'Look for author bylines with verifiable credentials',
      'Cross-reference claims with multiple independent sources',
      'Check the "About Us" page for transparency and ownership',
      'Be wary of sources that only cite themselves or anonymous tips',
    ],
  },
]

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Which of the following is a common indicator of a deepfake video?',
    options: [
      'Perfect audio-visual synchronization',
      'Consistent lighting across all elements',
      'Unnatural blinking patterns or absence of blinking',
      'High-resolution metadata in the file',
    ],
    correctIndex: 2,
  },
  {
    id: 'q2',
    question: 'What does ELA (Error Level Analysis) help detect in images?',
    options: [
      'The resolution quality of the image',
      'Areas that have been edited or modified differently',
      'The original camera model used to take the photo',
      'The geographic location where the image was taken',
    ],
    correctIndex: 1,
  },
  {
    id: 'q3',
    question: 'Which of these is the MOST reliable way to verify a viral claim?',
    options: [
      'Check how many people have shared it on social media',
      'Look for a matching claim on a single fact-checking site',
      'Cross-reference with multiple independent, credible sources',
      'Ask an AI chatbot if the claim is true',
    ],
    correctIndex: 2,
  },
]

const COMMUNITY_TIPS: CommunityTip[] = [
  {
    id: 'tip1',
    user: 'Priya Sharma',
    avatar: 'PS',
    tip: 'Always check the date on viral images - I found a 2019 flood photo being shared as a 2024 event on WhatsApp. A simple reverse image search revealed the truth in seconds!',
    upvotes: 47,
    downvotes: 2,
    timestamp: '2 hrs ago',
    badge: 'Gold',
  },
  {
    id: 'tip2',
    user: 'Rajesh Kumar',
    avatar: 'RK',
    tip: 'When verifying YouTube videos, use the "Upload Date" and check the channel\'s history. Deepfake channels often have very few subscribers and were created recently.',
    upvotes: 34,
    downvotes: 1,
    timestamp: '4 hrs ago',
    badge: 'Silver',
  },
  {
    id: 'tip3',
    user: 'Anita Desai',
    avatar: 'AD',
    tip: 'For WhatsApp forwards, look for formatting inconsistencies in government notices - real ones use specific fonts and layout. Also check the official website directly.',
    upvotes: 56,
    downvotes: 3,
    timestamp: '6 hrs ago',
    badge: 'Platinum',
  },
  {
    id: 'tip4',
    user: 'Vikram Patel',
    avatar: 'VP',
    tip: 'If an emotional headline makes you angry or scared, pause before sharing. That\'s exactly what misinformation is designed to do. Take a breath and fact-check first.',
    upvotes: 89,
    downvotes: 5,
    timestamp: '8 hrs ago',
    badge: 'Gold',
  },
  {
    id: 'tip5',
    user: 'Meera Nair',
    avatar: 'MN',
    tip: 'Use the InVID plugin for video verification - it helps extract keyframes from videos for reverse image search. Extremely useful for detecting recycled old footage.',
    upvotes: 41,
    downvotes: 1,
    timestamp: '10 hrs ago',
    badge: 'Silver',
  },
  {
    id: 'tip6',
    user: 'Arjun Singh',
    avatar: 'AS',
    tip: 'For election-related news, always check the Election Commission of India website first. Most fake election claims can be debunked with official ECIR data within minutes.',
    upvotes: 63,
    downvotes: 2,
    timestamp: '12 hrs ago',
    badge: 'Gold',
  },
]

// ─── Difficulty Color Map ───────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
  Intermediate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  Advanced: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
}

const CATEGORY_COLORS: Record<string, string> = {
  Deepfakes: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  Forensics: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  'Fact-Check': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Safety: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
}

const BADGE_COLORS: Record<string, string> = {
  Bronze: 'bg-amber-700/20 text-amber-700 dark:text-amber-400',
  Silver: 'bg-slate-400/20 text-slate-600 dark:text-slate-300',
  Gold: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  Platinum: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EducationResourcesTab() {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number | null>>({})
  const [quizScore, setQuizScore] = useState(0)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [tipVotes, setTipVotes] = useState<Record<string, { up: number; down: number }>>(
    Object.fromEntries(COMMUNITY_TIPS.map(t => [t.id, { up: t.upvotes, down: t.downvotes }]))
  )

  // Toggle reference card expansion
  const toggleCard = useCallback((id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Handle quiz answer
  const handleQuizAnswer = useCallback((questionId: string, optionIndex: number) => {
    if (quizAnswers[questionId] !== undefined && quizAnswers[questionId] !== null) return

    const question = QUIZ_QUESTIONS.find(q => q.id === questionId)
    if (!question) return

    const isCorrect = optionIndex === question.correctIndex
    setQuizAnswers(prev => ({ ...prev, [questionId]: optionIndex }))
    if (isCorrect) {
      setQuizScore(prev => prev + 1)
      toast.success('Correct! Great job!')
    } else {
      toast.error('Not quite - the correct answer is highlighted.')
    }

    // Check if quiz is complete
    const newAnswers = { ...quizAnswers, [questionId]: optionIndex }
    if (Object.keys(newAnswers).length === QUIZ_QUESTIONS.length) {
      setQuizCompleted(true)
      const finalScore = isCorrect ? quizScore + 1 : quizScore
      setTimeout(() => {
        if (finalScore === QUIZ_QUESTIONS.length) {
          toast.success(`Perfect score! ${finalScore}/${QUIZ_QUESTIONS.length} - You're a media literacy expert! 🏆`)
        } else {
          toast.info(`Quiz complete! You scored ${finalScore}/${QUIZ_QUESTIONS.length}`)
        }
      }, 600)
    }
  }, [quizAnswers, quizScore])

  // Reset quiz
  const resetQuiz = useCallback(() => {
    setQuizAnswers({})
    setQuizScore(0)
    setQuizCompleted(false)
  }, [])

  // Handle tip vote
  const handleTipVote = useCallback((tipId: string, voteType: 'up' | 'down') => {
    setTipVotes(prev => ({
      ...prev,
      [tipId]: {
        ...prev[tipId],
        [voteType === 'up' ? 'up' : 'down']: prev[tipId][voteType === 'up' ? 'up' : 'down'] + 1,
      },
    }))
  }, [])

  return (
    <div className="space-y-6">
      {/* ─── Hero Section ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 via-zinc-500/5 to-cyan-500/5 pointer-events-none" />
          <CardHeader className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative">
                <div className="p-3 rounded-xl bg-zinc-500/10 border border-zinc-500/20">
                  <GraduationCap className="h-8 w-8 text-zinc-500" />
                </div>
                <div className="absolute -inset-2 rounded-2xl bg-zinc-500/10 blur-xl -z-10" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl bg-gradient-to-r from-zinc-600 to-zinc-600 dark:from-zinc-400 dark:to-zinc-400 bg-clip-text text-transparent">
                  Digital Media Literacy Hub
                </CardTitle>
                <CardDescription className="mt-1 text-base">
                  Learn to identify deepfakes, misinformation, and manipulated media
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
                  <Star className="h-3 w-3 mr-1" />
                  4 Courses
                </Badge>
                <Badge variant="outline" className="border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
                  <Video className="h-3 w-3 mr-1" />
                  6 Tutorials
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* ─── Interactive Courses Section ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-zinc-500" />
              Interactive Courses
            </CardTitle>
            <CardDescription>Structured learning paths from beginner to advanced</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COURSES.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                    course.progress === -1
                      ? 'opacity-75 bg-muted/30'
                      : 'hover:border-zinc-500/30 bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight">{course.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                    </div>
                    {course.progress === -1 && (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shrink-0">
                        <Lock className="h-3 w-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="outline" className={DIFFICULTY_COLORS[course.difficulty]}>
                      {course.difficulty}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {course.modules} modules
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {course.duration}
                    </span>
                  </div>

                  {course.progress >= 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {course.progress === 0 ? 'Not started' : `${course.progress}% complete`}
                        </span>
                        <span className="font-medium text-zinc-600 dark:text-zinc-400">
                          {course.progress}%
                        </span>
                      </div>
                      <Progress value={course.progress} className="h-2" />
                      <Button
                        size="sm"
                        className={`w-full mt-1 ${
                          course.progress === 0
                            ? 'bg-zinc-600 hover:bg-zinc-700 text-white'
                            : 'bg-zinc-600 hover:bg-zinc-700 text-white'
                        }`}
                        onClick={() => toast.info(course.progress === 0 ? 'Starting course...' : 'Resuming course...')}
                      >
                        {course.progress === 0 ? (
                          <>
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            Start Course
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                            Continue
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-3">
                      <Lock className="h-6 w-6 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground text-center">
                        Upgrade to Premium to unlock this course
                      </p>
                      <Button variant="outline" size="sm" className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Unlock Premium
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Video Tutorials Grid ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="h-5 w-5 text-zinc-500" />
              Video Tutorials
            </CardTitle>
            <CardDescription>Quick video guides on media verification techniques</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TUTORIALS.map((tutorial, i) => (
                <motion.div
                  key={tutorial.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  className="group rounded-xl border overflow-hidden hover:shadow-lg transition-all hover:border-zinc-500/30 cursor-pointer"
                  onClick={() => toast.info(`Playing: ${tutorial.title}`)}
                >
                  {/* Thumbnail */}
                  <div className={`relative h-36 bg-gradient-to-br ${tutorial.thumbnailColor} flex items-center justify-center`}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                    <div className="relative z-10 p-3 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                    {/* Duration badge */}
                    <Badge className="absolute bottom-2 right-2 bg-black/60 text-white border-0 text-[10px]">
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      {tutorial.duration}
                    </Badge>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                      {tutorial.title}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[tutorial.category] || ''}`}>
                        {tutorial.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {tutorial.views}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Quick Reference Cards ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-zinc-500" />
              Quick Reference Cards
            </CardTitle>
            <CardDescription>Click to expand - essential tips at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {REFERENCE_CARDS.map((card, i) => {
                const isExpanded = expandedCards.has(card.id)
                const IconComp = card.icon
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + i * 0.06 }}
                    className={`rounded-xl border transition-all cursor-pointer ${
                      isExpanded
                        ? 'border-zinc-500/40 shadow-md bg-zinc-500/[0.02]'
                        : 'hover:border-zinc-500/20 hover:shadow-sm'
                    }`}
                    onClick={() => toggleCard(card.id)}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-zinc-500/10">
                            <IconComp className="h-4 w-4 text-zinc-500" />
                          </div>
                          <h3 className="font-medium text-sm">{card.title}</h3>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </motion.div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <Separator className="my-3" />
                            <ul className="space-y-2">
                              {card.points.map((point, j) => (
                                <motion.li
                                  key={j}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: j * 0.05 }}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <CheckCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                                  <span className="text-muted-foreground">{point}</span>
                                </motion.li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Quizzes Section ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-zinc-500" />
                  Test Your Media Literacy
                </CardTitle>
                <CardDescription>Interactive quiz - see how well you can spot misinformation</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-500/10 border border-zinc-500/20">
                  <Trophy className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    {quizScore}/{QUIZ_QUESTIONS.length}
                  </span>
                </div>
                {quizCompleted && (
                  <Button variant="outline" size="sm" onClick={resetQuiz}>
                    Retake Quiz
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {QUIZ_QUESTIONS.map((question, qi) => {
              const answered = quizAnswers[question.id] !== undefined && quizAnswers[question.id] !== null
              const selectedOption = quizAnswers[question.id]
              return (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + qi * 0.1 }}
                  className="rounded-xl border p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 h-7 w-7 rounded-full bg-zinc-500/10 border border-zinc-500/20 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      {qi + 1}
                    </span>
                    <p className="font-medium text-sm pt-0.5">{question.question}</p>
                  </div>
                  <div className="space-y-2 pl-10">
                    {question.options.map((option, oi) => {
                      const isCorrect = oi === question.correctIndex
                      const isSelected = selectedOption === oi
                      let optionStyle = 'border hover:border-zinc-500/30 hover:bg-muted/30 cursor-pointer'
                      if (answered) {
                        if (isCorrect) {
                          optionStyle = 'border-zinc-500/40 bg-zinc-500/10'
                        } else if (isSelected && !isCorrect) {
                          optionStyle = 'border-red-500/40 bg-red-500/10'
                        } else {
                          optionStyle = 'border bg-muted/20 opacity-50 cursor-not-allowed'
                        }
                      }
                      return (
                        <button
                          key={oi}
                          className={`w-full text-left p-3 rounded-lg text-sm transition-all ${optionStyle}`}
                          onClick={() => handleQuizAnswer(question.id, oi)}
                          disabled={answered}
                        >
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-medium">
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span className="flex-1">{option}</span>
                            {answered && isCorrect && (
                              <CheckCircle className="h-4 w-4 text-zinc-500 shrink-0" />
                            )}
                            {answered && isSelected && !isCorrect && (
                              <span className="text-red-500 text-xs font-medium shrink-0">✗</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}

            {/* Quiz Complete Message */}
            <AnimatePresence>
              {quizCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-4"
                >
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-zinc-500/10 to-zinc-500/10 border border-zinc-500/20">
                    <Trophy className="h-6 w-6 text-zinc-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">
                        {quizScore === QUIZ_QUESTIONS.length
                          ? 'Perfect Score! 🏆'
                          : quizScore >= 2
                            ? 'Great Job! 👏'
                            : 'Keep Learning! 📚'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        You got {quizScore} out of {QUIZ_QUESTIONS.length} correct
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Downloads & Resources ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-zinc-500" />
              Downloads & Resources
            </CardTitle>
            <CardDescription>Free tools and guides to help you verify media</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PDF Guides */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  PDF Guides
                </h4>
                {[
                  { title: 'Verification Checklist', desc: 'Step-by-step checklist for verifying any media content', size: '2.4 MB' },
                  { title: 'Media Literacy Toolkit', desc: 'Comprehensive guide to digital media literacy', size: '5.1 MB' },
                  { title: "Reporter's Guide", desc: 'Essential verification guide for journalists and reporters', size: '3.8 MB' },
                ].map((guide, i) => (
                  <motion.div
                    key={guide.title}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.06 }}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:border-zinc-500/30 hover:bg-zinc-500/[0.02] transition-all cursor-pointer group"
                    onClick={() => toast.info(`Downloading: ${guide.title}`)}
                  >
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/15">
                      <FileText className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">{guide.title}</p>
                      <p className="text-xs text-muted-foreground">{guide.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{guide.size}</Badge>
                      <Download className="h-4 w-4 text-muted-foreground group-hover:text-zinc-500 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Browser Extension & Mobile App */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Tools
                </h4>
                {/* Browser Extension Card */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-4 rounded-xl border bg-gradient-to-br from-zinc-500/5 to-zinc-500/5 hover:border-zinc-500/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-zinc-500/10 border border-zinc-500/20">
                      <Monitor className="h-5 w-5 text-zinc-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">TruthShield Browser Extension</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Verify media directly in your browser - works on Chrome, Firefox, and Edge
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
                          v2.1.0
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-0.5 text-amber-500 fill-amber-500" />
                          4.8
                        </Badge>
                      </div>
                      <Button size="sm" className="mt-3 bg-zinc-600 hover:bg-zinc-700 text-white" onClick={() => toast.info('Redirecting to Chrome Web Store...')}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Install Extension
                      </Button>
                    </div>
                  </div>
                </motion.div>

                {/* Mobile App Card */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 }}
                  className="p-4 rounded-xl border bg-gradient-to-br from-zinc-500/5 to-cyan-500/5 hover:border-zinc-500/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-zinc-500/10 border border-zinc-500/20">
                      <Smartphone className="h-5 w-5 text-zinc-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">TruthShield Mobile App</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Verify images and videos on the go - available for Android and iOS
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
                          v1.8.0
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-0.5 text-amber-500 fill-amber-500" />
                          4.6
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="text-zinc-600 border-zinc-500/30 hover:bg-zinc-500/10" onClick={() => toast.info('Redirecting to Play Store...')}>
                          Android
                        </Button>
                        <Button size="sm" variant="outline" className="text-zinc-600 border-zinc-500/30 hover:bg-zinc-500/10" onClick={() => toast.info('Redirecting to App Store...')}>
                          iOS
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Community Tips ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-zinc-500" />
              Community Tips
            </CardTitle>
            <CardDescription>Real verification tips from fellow digital citizens</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {COMMUNITY_TIPS.map((tip, i) => (
                  <motion.div
                    key={tip.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                    className="p-4 rounded-xl border hover:border-zinc-500/20 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-zinc-500/20 to-zinc-500/20 flex items-center justify-center shrink-0 ring-2 ring-zinc-500/20">
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{tip.avatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{tip.user}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${BADGE_COLORS[tip.badge]}`}>
                            {tip.badge}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{tip.timestamp}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{tip.tip}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-zinc-500 transition-colors"
                            onClick={() => handleTipVote(tip.id, 'up')}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>{tipVotes[tip.id]?.up || tip.upvotes}</span>
                          </button>
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                            onClick={() => handleTipVote(tip.id, 'down')}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            <span>{tipVotes[tip.id]?.down || tip.downvotes}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
