<script setup lang="ts">
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CalendarDays,
  Copy,
  Inbox,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  adminApi,
  type Booking,
  type Conversation,
  type DashboardOverview,
  type KnowledgeItem,
} from '../services/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const savingKnowledge = ref(false)
const replyingConversationId = ref<string | null>(null)
const error = ref('')
const success = ref('')

const overview = ref<DashboardOverview | null>(null)
const knowledgeItems = ref<KnowledgeItem[]>([])
const conversations = ref<Conversation[]>([])
const bookings = ref<Booking[]>([])
const widgetSnippet = ref('')

const knowledgeForm = reactive({
  title: '',
  sourceType: 'FAQ',
  content: '',
})

const replyDrafts = reactive<Record<string, string>>({})

const business = computed(() => overview.value?.business ?? auth.business)

const cards = computed(() => {
  const metrics = overview.value?.metrics
  if (!metrics) return []

  return [
    {
      label: 'Chats handled',
      value: metrics.totalChats,
      helper: 'Guest conversations answered by AI',
      icon: MessageSquare,
    },
    {
      label: 'Qualified leads',
      value: metrics.qualifiedLeads,
      helper: 'Visitors who shared real booking intent',
      icon: Sparkles,
    },
    {
      label: 'Booking requests',
      value: metrics.bookings,
      helper: 'Captures ready for staff follow-up',
      icon: CalendarDays,
    },
    {
      label: 'Conversion rate',
      value: `${metrics.conversionRate}%`,
      helper: 'Simple ROI signal for operators',
      icon: ShieldCheck,
    },
  ]
})

const sortedConversations = computed(() =>
  [...conversations.value].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  ),
)

const recentBookings = computed(() => bookings.value.slice(0, 8))

function formatDate(value?: string | null) {
  if (!value) return 'Not provided'

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function summarizeConversation(conversation: Conversation) {
  const latest = conversation.messages[conversation.messages.length - 1]
  return latest?.content ?? 'No messages yet.'
}

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const [overviewResponse, knowledgeResponse, conversationResponse, bookingResponse, widgetResponse] =
      await Promise.all([
        adminApi.getOverview(),
        adminApi.getKnowledge(),
        adminApi.getConversations(),
        adminApi.getBookings(),
        adminApi.getWidgetSettings(),
      ])

    overview.value = overviewResponse.data
    knowledgeItems.value = knowledgeResponse.data.items
    conversations.value = conversationResponse.data.conversations
    bookings.value = bookingResponse.data.bookings
    widgetSnippet.value = widgetResponse.data.widgetSnippet
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : 'Unable to load your hospitality dashboard.'
  } finally {
    loading.value = false
  }
}

async function uploadKnowledge() {
  if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
    error.value = 'Provide a title and content before indexing knowledge.'
    return
  }

  savingKnowledge.value = true
  error.value = ''
  success.value = ''

  try {
    const formData = new FormData()
    formData.append('title', knowledgeForm.title.trim())
    formData.append('sourceType', knowledgeForm.sourceType)
    formData.append('content', knowledgeForm.content.trim())

    await adminApi.createKnowledge(formData)
    knowledgeForm.title = ''
    knowledgeForm.sourceType = 'FAQ'
    knowledgeForm.content = ''
    success.value = 'Knowledge indexed successfully. Your concierge can use it immediately.'
    await loadData()
  } catch (uploadError) {
    error.value = uploadError instanceof Error ? uploadError.message : 'Could not upload knowledge.'
  } finally {
    savingKnowledge.value = false
  }
}

async function toggleTakeover(conversation: Conversation) {
  error.value = ''
  success.value = ''

  try {
    await adminApi.toggleTakeover(conversation.id, conversation.status !== 'HUMAN')
    success.value =
      conversation.status === 'HUMAN'
        ? 'Conversation returned to AI mode.'
        : 'Conversation moved to human handoff.'
    await loadData()
  } catch (toggleError) {
    error.value =
      toggleError instanceof Error ? toggleError.message : 'Unable to update handoff state.'
  }
}

async function sendReply(conversationId: string) {
  const content = replyDrafts[conversationId]?.trim()
  if (!content) return

  replyingConversationId.value = conversationId
  error.value = ''
  success.value = ''

  try {
    await adminApi.sendAdminReply(conversationId, content)
    replyDrafts[conversationId] = ''
    success.value = 'Reply sent. Staff handoff transcript updated.'
    await loadData()
  } catch (replyError) {
    error.value = replyError instanceof Error ? replyError.message : 'Unable to send admin reply.'
  } finally {
    replyingConversationId.value = null
  }
}

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(widgetSnippet.value)
    success.value = 'Embed snippet copied to clipboard.'
  } catch {
    error.value = 'Clipboard copy failed. You can still copy the snippet manually.'
  }
}

function logout() {
  auth.clearSession()
  router.push('/login')
}

onMounted(async () => {
  await auth.hydrate()

  if (!auth.isAuthenticated) {
    await router.push('/login')
    return
  }

  await loadData()
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header class="mb-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_100px_-50px_rgba(34,211,238,0.45)]">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/25">
                <Bot class="h-6 w-6" />
              </div>
              <div>
                <p class="text-sm text-cyan-300">AI Concierge Assistant</p>
                <h1 class="text-2xl font-semibold text-white sm:text-3xl">
                  {{ business?.name ?? 'Hospitality dashboard' }}
                </h1>
              </div>
            </div>

            <p class="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              A premium hospitality dashboard built to increase bookings, answer guest questions
              from approved knowledge, and move high-intent leads into a human follow-up queue.
            </p>

            <div class="mt-5 flex flex-wrap gap-3 text-sm">
              <div class="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-emerald-200">
                Multi-tenant PostgreSQL + Prisma
              </div>
              <div class="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-cyan-200">
                OpenAI-ready RAG flow
              </div>
              <div class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                Under-5-minute widget installation
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              @click="router.push('/')"
            >
              <ArrowLeft class="h-4 w-4" />
              View landing page
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              @click="loadData"
            >
              <RefreshCw class="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              @click="logout"
            >
              <LogOut class="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <div v-if="error" class="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {{ error }}
      </div>
      <div v-if="success" class="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
        {{ success }}
      </div>

      <div v-if="loading" class="flex min-h-[340px] items-center justify-center">
        <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
          <LoaderCircle class="h-4 w-4 animate-spin" />
          Loading concierge operations...
        </div>
      </div>

      <template v-else>
        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="card in cards"
            :key="card.label"
            class="rounded-[1.75rem] border border-white/10 bg-white/5 p-5"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm text-slate-400">{{ card.label }}</p>
                <p class="mt-3 text-3xl font-semibold text-white">{{ card.value }}</p>
                <p class="mt-2 text-sm text-slate-300">{{ card.helper }}</p>
              </div>
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <component :is="card.icon" class="h-5 w-5" />
              </div>
            </div>
          </article>
        </section>

        <section class="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div class="space-y-6">
            <article class="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-slate-400">Knowledge base</p>
                  <h2 class="mt-1 text-xl font-semibold text-white">Index hospitality knowledge</h2>
                </div>
                <BookOpen class="h-5 w-5 text-cyan-300" />
              </div>
              <p class="mt-3 text-sm leading-6 text-slate-300">
                Upload FAQs, room details, pricing, and policies. The assistant is instructed to answer only from these retrieved snippets.
              </p>

              <form class="mt-6 grid gap-4" @submit.prevent="uploadKnowledge">
                <div class="grid gap-4 md:grid-cols-[1fr_220px]">
                  <input
                    v-model="knowledgeForm.title"
                    type="text"
                    placeholder="Dog-friendly suites and winter pricing"
                    class="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  />
                  <select
                    v-model="knowledgeForm.sourceType"
                    class="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                  >
                    <option value="FAQ">FAQ</option>
                    <option value="ROOM">ROOM</option>
                    <option value="POLICY">POLICY</option>
                    <option value="PRICING">PRICING</option>
                    <option value="SERVICE">SERVICE</option>
                    <option value="FILE">FILE</option>
                  </select>
                </div>

                <textarea
                  v-model="knowledgeForm.content"
                  rows="8"
                  placeholder="Describe room categories, amenities, rates, cancellation rules, breakfast policy, pet policy, and booking notes."
                  class="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                />

                <div class="flex justify-end">
                  <button
                    type="submit"
                    class="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
                    :disabled="savingKnowledge"
                  >
                    <LoaderCircle v-if="savingKnowledge" class="h-4 w-4 animate-spin" />
                    <Sparkles v-else class="h-4 w-4" />
                    Index knowledge
                  </button>
                </div>
              </form>

              <div class="mt-6 grid gap-4">
                <article
                  v-for="item in knowledgeItems"
                  :key="item.id"
                  class="rounded-3xl border border-white/10 bg-slate-900/70 p-5"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="text-base font-semibold text-white">{{ item.title }}</p>
                      <p class="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                        {{ item.sourceType }}
                      </p>
                    </div>
                    <span class="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-200">
                      {{ item._count.chunks }} chunks
                    </span>
                  </div>
                  <p class="mt-3 text-sm leading-6 text-slate-300">
                    {{ item.rawContent.slice(0, 240) }}<span v-if="item.rawContent.length > 240">...</span>
                  </p>
                </article>
              </div>
            </article>

            <article class="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-slate-400">Conversation inbox</p>
                  <h2 class="mt-1 text-xl font-semibold text-white">Human handoff and live transcripts</h2>
                </div>
                <Inbox class="h-5 w-5 text-cyan-300" />
              </div>

              <div class="mt-6 space-y-4">
                <article
                  v-for="conversation in sortedConversations"
                  :key="conversation.id"
                  class="rounded-3xl border border-white/10 bg-slate-900/70 p-5"
                >
                  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-3">
                        <p class="text-base font-semibold text-white">
                          {{ conversation.visitorName ?? conversation.visitorEmail ?? 'Anonymous guest' }}
                        </p>
                        <span class="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-200">
                          {{ conversation.status }}
                        </span>
                        <span class="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-200">
                          {{ conversation.leadStatus }}
                        </span>
                      </div>
                      <p class="mt-2 text-sm text-slate-300">
                        {{ summarizeConversation(conversation) }}
                      </p>
                      <p class="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                        Updated {{ formatDate(conversation.updatedAt) }} · {{ conversation.messages.length }} messages
                      </p>
                    </div>

                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                      @click="toggleTakeover(conversation)"
                    >
                      <Mail class="h-4 w-4" />
                      {{ conversation.status === 'HUMAN' ? 'Return to AI' : 'Take over chat' }}
                    </button>
                  </div>

                  <div class="mt-4 grid gap-3">
                    <div
                      v-for="message in conversation.messages.slice(-4)"
                      :key="message.id"
                      class="rounded-2xl px-4 py-3 text-sm leading-6"
                      :class="
                        message.role === 'USER'
                          ? 'bg-white/5 text-slate-100'
                          : message.role === 'ASSISTANT'
                            ? 'bg-cyan-400/10 text-cyan-50'
                            : 'bg-emerald-400/10 text-emerald-50'
                      "
                    >
                      <span class="mr-2 text-xs uppercase tracking-[0.2em] text-slate-400">{{ message.role }}</span>
                      {{ message.content }}
                    </div>
                  </div>

                  <div class="mt-4 flex gap-3">
                    <input
                      v-model="replyDrafts[conversation.id]"
                      type="text"
                      placeholder="Send a human follow-up message..."
                      class="flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                    />
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                      :disabled="replyingConversationId === conversation.id"
                      @click="sendReply(conversation.id)"
                    >
                      <LoaderCircle
                        v-if="replyingConversationId === conversation.id"
                        class="h-4 w-4 animate-spin"
                      />
                      <Mail v-else class="h-4 w-4" />
                      Reply
                    </button>
                  </div>
                </article>
              </div>
            </article>
          </div>

          <aside class="space-y-6">
            <article class="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-slate-400">Embed widget</p>
                  <h2 class="mt-1 text-xl font-semibold text-white">Install on any website</h2>
                </div>
                <Bot class="h-5 w-5 text-cyan-300" />
              </div>
              <p class="mt-3 text-sm leading-6 text-slate-300">
                Paste the script below into your website footer or tag manager. It loads the hosted widget with your tenant slug.
              </p>
              <div class="mt-4 rounded-3xl border border-white/10 bg-slate-950/90 p-4">
                <pre class="overflow-x-auto whitespace-pre-wrap text-sm text-cyan-100">{{ widgetSnippet }}</pre>
              </div>
              <button
                type="button"
                class="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                @click="copySnippet"
              >
                <Copy class="h-4 w-4" />
                Copy snippet
              </button>
            </article>

            <article class="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-slate-400">Booking pipeline</p>
                  <h2 class="mt-1 text-xl font-semibold text-white">Captured leads and requests</h2>
                </div>
                <CalendarDays class="h-5 w-5 text-cyan-300" />
              </div>

              <div class="mt-5 space-y-4">
                <article
                  v-for="booking in recentBookings"
                  :key="booking.id"
                  class="rounded-3xl border border-white/10 bg-slate-900/70 p-5"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-base font-semibold text-white">
                        {{ booking.guestName ?? booking.conversation?.visitorName ?? 'Guest lead' }}
                      </p>
                      <p class="mt-1 text-sm text-slate-300">
                        {{ booking.email ?? booking.conversation?.visitorEmail ?? 'No email yet' }}
                      </p>
                    </div>
                    <span class="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                      {{ booking.status }}
                    </span>
                  </div>
                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <div class="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
                      <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Arrival</p>
                      <p class="mt-1 text-sm text-white">{{ formatDate(booking.arrivalDate) }}</p>
                    </div>
                    <div class="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
                      <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Departure</p>
                      <p class="mt-1 text-sm text-white">{{ formatDate(booking.departureDate) }}</p>
                    </div>
                  </div>
                  <p class="mt-3 text-sm text-slate-300">
                    Guests: {{ booking.guests ?? 'Unknown' }} · Room: {{ booking.roomType ?? 'Flexible' }}
                  </p>
                  <p class="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Created {{ formatDate(booking.createdAt) }}
                  </p>
                </article>
              </div>
            </article>

            <article class="rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-400/15 via-slate-900 to-indigo-500/10 p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-cyan-200/80">Architecture</p>
                  <h2 class="mt-1 text-xl font-semibold text-white">Production-ready MVP</h2>
                </div>
                <ShieldCheck class="h-5 w-5 text-cyan-200" />
              </div>
              <ul class="mt-5 space-y-3 text-sm leading-6 text-slate-200">
                <li>Vue 3 dashboard and hosted widget UI.</li>
                <li>Express + TypeScript API with JWT auth.</li>
                <li>Prisma + PostgreSQL multi-tenant data model.</li>
                <li>OpenAI chat + embeddings with local fallback behavior.</li>
                <li>SMTP notifications for new leads and booking requests.</li>
              </ul>
            </article>
          </aside>
        </section>
      </template>
    </div>
  </div>
</template>
