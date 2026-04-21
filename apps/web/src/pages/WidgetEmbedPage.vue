<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Bot, LoaderCircle, Send, Sparkles, X } from 'lucide-vue-next'
import { widgetApi, type Conversation, type WidgetConfig } from '../services/api'

type WidgetMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
}

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? 'demo-property'))

const config = ref<WidgetConfig | null>(null)
const messages = ref<WidgetMessage[]>([])
const input = ref('')
const isSending = ref(false)
const conversationId = ref<string>()
const loadError = ref('')

function applyConversation(conversation: Conversation) {
  conversationId.value = conversation.id
  messages.value = conversation.messages
    .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
    .map((message) => ({
      id: message.id,
      role: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content,
    }))

  if (messages.value.length === 0) {
    messages.value = [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          config.value?.business.welcomeMessage ??
          'Hi there! Ask about rooms, pricing, availability, or special requests.',
      },
    ]
  }
}

async function loadConfig() {
  loadError.value = ''

  try {
    const { data } = await widgetApi.getConfig(slug.value)
    config.value = data
    messages.value = [
      {
        id: 'welcome',
        role: 'assistant',
        content: data.business.welcomeMessage,
      },
    ]
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Unable to load widget configuration.'
  }
}

async function sendMessage() {
  const message = input.value.trim()
  if (!message || isSending.value) return

  isSending.value = true
  input.value = ''

  if (!conversationId.value) {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
    })
  }

  try {
    const { data } = await widgetApi.sendMessage(slug.value, {
      conversationId: conversationId.value,
      message,
    })

    applyConversation(data.conversation)
  } catch (error) {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        error instanceof Error
          ? error.message
          : 'The concierge could not answer right now. Please try again shortly.',
    })
  } finally {
    isSending.value = false
  }
}

onMounted(async () => {
  await loadConfig()
})

function closeWidget() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'AI_CONCIERGE_CLOSE_WIDGET' }, '*')
  }
}
</script>

<template>
  <main class="min-h-screen bg-slate-950 px-3 py-3 text-white">
    <div
      class="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-4xl border border-white/10 bg-slate-900/95 shadow-[0_26px_80px_-44px_rgba(2,6,23,0.9)]"
    >
      <header class="border-b border-white/10 px-5 py-4">
        <div class="flex items-center gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-2xl"
            :style="{ backgroundColor: `${config?.business.brandColor ?? '#0F766E'}22`, color: config?.business.brandColor ?? '#5EEAD4' }"
          >
            <Bot class="h-6 w-6" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              AI Concierge
            </p>
            <h1 class="text-lg font-semibold text-white">
              {{ config?.business.name ?? 'Hospitality Concierge' }}
            </h1>
          </div>
          <button
            type="button"
            class="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close chat"
            @click="closeWidget"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <span class="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
            <Sparkles class="h-3.5 w-3.5" />
            Revenue-focused assistant
          </span>
          <span
            v-for="suggestion in config?.suggestions ?? []"
            :key="suggestion"
            class="inline-flex rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400"
          >
            {{ suggestion }}
          </span>
        </div>
      </header>

      <div v-if="loadError" class="border-b border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {{ loadError }}
      </div>

      <div class="widget-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-6"
            :class="
              message.role === 'user'
                ? 'bg-teal-300 text-slate-950'
                : 'border border-white/10 bg-white/5 text-slate-100'
            "
          >
            {{ message.content }}
          </div>
        </div>

        <div
          v-if="isSending"
          class="mr-auto inline-flex items-center gap-2 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300"
        >
          <LoaderCircle class="h-4 w-4 animate-spin" />
          Thinking through the best concierge answer...
        </div>
      </div>

      <form class="border-t border-white/10 p-4" @submit.prevent="sendMessage">
        <div class="rounded-3xl border border-white/10 bg-slate-950/80 p-2">
          <div class="flex items-end gap-2">
            <textarea
              v-model="input"
              rows="2"
              class="min-h-[60px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Ask about rooms, amenities, pet policy, rates, or a booking request."
            />
            <button
              type="submit"
              class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-300 text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSending"
            >
              <Send class="h-4 w-4" />
            </button>
          </div>
        </div>
        <p class="mt-3 text-center text-xs text-slate-500">
          Answers stay grounded in the property knowledge base and can hand off to staff when needed.
        </p>
      </form>
    </div>
  </main>
</template>
