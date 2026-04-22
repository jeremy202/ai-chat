<script setup lang="ts">
import { Inbox, LoaderCircle, Mail } from "lucide-vue-next";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

onMounted(async () => {
  await dashboard.initialize(router, { sections: ["conversations"] });
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.inbox.title')"
    :subtitle="locale.t('dashboard.inbox.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.loadData({ sections: ['conversations'] })"
    @logout="dashboard.logout(router)"
  >
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-slate-400">{{ locale.t("dashboard.inbox.kicker") }}</p>
          <h2 class="mt-1 text-xl font-semibold text-white">{{ locale.t("dashboard.inbox.heading") }}</h2>
        </div>
        <Inbox class="h-5 w-5 text-teal-300" />
      </div>

      <div class="mt-5 space-y-4">
        <article
          v-for="conversation in dashboard.sortedConversations"
          :key="conversation.id"
          class="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-white">
                  {{ conversation.visitorName ?? conversation.visitorEmail ?? locale.t("dashboard.common.anonymousGuest") }}
                </p>
                <span class="rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs text-cyan-200">{{ conversation.status }}</span>
                <span class="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-200">{{ conversation.leadStatus }}</span>
              </div>
              <p class="mt-2 text-sm text-slate-300">{{ dashboard.summarizeConversation(conversation) }}</p>
              <p class="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                {{ locale.t("dashboard.inbox.updated") }} {{ dashboard.formatDate(conversation.updatedAt) }} · {{ conversation.messages.length }} {{ locale.t("dashboard.inbox.messages") }}
              </p>
            </div>

            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/20"
              @click="dashboard.toggleTakeover(conversation)"
            >
              <Mail class="h-3.5 w-3.5" />
              {{ conversation.status === 'HUMAN' ? locale.t("dashboard.inbox.returnAi") : locale.t("dashboard.inbox.takeover") }}
            </button>
          </div>

          <div class="mt-3 grid gap-2">
            <div
              v-for="message in conversation.messages.slice(-4)"
              :key="message.id"
              class="rounded-lg px-3 py-2 text-sm"
              :class="
                message.role === 'USER'
                  ? 'bg-slate-800 text-slate-100'
                  : message.role === 'ASSISTANT'
                    ? 'bg-cyan-500/10 text-cyan-100'
                    : 'bg-emerald-500/10 text-emerald-100'
              "
            >
              <span class="mr-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">{{ message.role }}</span>
              {{ message.content }}
            </div>
          </div>

          <div class="mt-3 flex gap-2">
            <input
              v-model="dashboard.replyDrafts[conversation.id]"
              type="text"
              :placeholder="locale.t('dashboard.inbox.replyPlaceholder')"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-300"
            />
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="dashboard.replyingConversationId === conversation.id"
              @click="dashboard.sendReply(conversation.id)"
            >
              <LoaderCircle v-if="dashboard.replyingConversationId === conversation.id" class="h-3.5 w-3.5 animate-spin" />
              <Mail v-else class="h-3.5 w-3.5" />
              {{ locale.t("dashboard.inbox.reply") }}
            </button>
          </div>
        </article>
      </div>
    </article>
  </DashboardFrame>
</template>
