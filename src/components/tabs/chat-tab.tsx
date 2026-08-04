'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore, type ChatMessage } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  MessageSquare, Send, Trash2, Loader2, Shield,
  FileText, ImageIcon, Video, CheckCircle, HelpCircle, Sparkles,
  Bot, User,
} from 'lucide-react'

const quickPrompts = [
  { label: 'How do I verify a deepfake video?', icon: Video },
  { label: 'What are signs of AI-generated images?', icon: ImageIcon },
  { label: 'Help me fact-check this claim', icon: CheckCircle },
  { label: 'Analyze this text for propaganda', icon: FileText },
]

export function ChatTab() {
  const { chatMessages, chatLoading, sendChatMessage, clearChatHistory } = useAppStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, chatLoading])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || chatLoading) return
    setInput('')
    await sendChatMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-zinc-500/5 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-500/10">
                  <MessageSquare className="h-5 w-5 text-zinc-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">AI Verification Assistant</h2>
                  <p className="text-sm text-muted-foreground">
                    Expert guidance for digital media verification
                  </p>
                </div>
              </div>
              {chatMessages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearChatHistory} className="gap-2 text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Chat Area */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1 min-h-0">
        <Card className="border rounded-xl hover:shadow-md transition-shadow flex flex-col h-[calc(100vh-16rem)] sm:h-[calc(100vh-14rem)]">
          <CardContent className="p-0 flex flex-col flex-1 min-h-0">
            {chatMessages.length === 0 ? (
              /* Empty state with quick prompts */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="p-4 rounded-full bg-zinc-500/10 mb-4">
                  <Bot className="h-10 w-10 text-zinc-500" />
                </div>
                <h3 className="text-lg font-medium mb-2">How can I help you verify?</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  I&apos;m your AI verification assistant. Ask me about deepfakes, misinformation, fact-checking, image forensics, or any media verification topic.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {quickPrompts.map((prompt) => (
                    <Button
                      key={prompt.label}
                      variant="outline"
                      className="h-auto py-3 px-4 justify-start text-left gap-3 hover:bg-zinc-500/10 hover:border-zinc-500/30 hover:text-zinc-600 dark:hover:text-zinc-400 transition-all"
                      onClick={() => handleQuickPrompt(prompt.label)}
                    >
                      <prompt.icon className="h-4 w-4 text-zinc-500 shrink-0" />
                      <span className="text-sm">{prompt.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4 max-w-3xl mx-auto">
                  <AnimatePresence initial={false}>
                    {chatMessages.map((msg, i) => (
                      <ChatBubble key={i} message={msg} />
                    ))}
                  </AnimatePresence>
                  {chatLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 max-w-3xl"
                    >
                      <div className="h-8 w-8 rounded-full bg-zinc-500/20 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-zinc-500" />
                      </div>
                      <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-zinc-500/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-zinc-500/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-zinc-500/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span>AI is thinking<span className="animate-blink-cursor">|</span></span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Input Area */}
            <div className="border-t p-3 sm:p-4">
              {chatMessages.length > 0 && chatMessages.length <= 2 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {quickPrompts.slice(0, 2).map((prompt) => (
                    <Button
                      key={prompt.label}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-zinc-600 hover:bg-zinc-500/10"
                      onClick={() => handleQuickPrompt(prompt.label)}
                    >
                      <Sparkles className="h-3 w-3" />
                      {prompt.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Ask about deepfakes, fact-checking, image forensics..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={chatLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || chatLoading}
                  className="bg-zinc-600 hover:bg-zinc-700 text-white gap-2 shrink-0"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
    >
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-zinc-500/20' : 'bg-zinc-500/20'
      }`}>
        {isUser ? (
          <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        ) : (
          <Bot className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        )}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-zinc-600 text-white rounded-tr-sm'
          : 'bg-muted/50 rounded-tl-sm'
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:text-foreground [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-muted/30 [&_pre]:p-2 [&_pre]:rounded-lg">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <p className={`text-[10px] mt-1 ${isUser ? 'text-zinc-200' : 'text-muted-foreground'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  )
}
