<script setup lang="ts">
import { Bot, LoaderCircle } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { adminApi } from "../../services/api";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

const question = ref("");
const answer = ref("");
const usedSnippets = ref<{ id: string; score: number }[]>([]);
const isAsking = ref(false);

async function ask() {
  if (!question.value.trim()) return;
  isAsking.value = true;
  try {
    const { data } = await adminApi.getInternalAssistantAnswer(question.value);
    answer.value = data.answer;
    usedSnippets.value = data.usedKnowledgeSnippets;
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to fetch internal answer.";
  } finally {
    isAsking.value = false;
  }
}

onMounted(async () => {
  await dashboard.initialize(router, { skipDataLoad: true });
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.internal.title')"
    :subtitle="locale.t('dashboard.internal.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.initialize(router, { skipDataLoad: true })"
    @logout="dashboard.logout(router)"
  >
    <article class="dashboard-card">
      <div class="flex items-center gap-3">
        <Bot class="h-5 w-5 text-teal-300" />
        <p class="text-sm text-slate-300">{{ locale.t("dashboard.internal.helper") }}</p>
      </div>
      <textarea
        v-model="question"
        rows="4"
        class="dashboard-input mt-4 w-full"
        :placeholder="locale.t('dashboard.internal.placeholder')"
      />
      <button class="dashboard-button-primary mt-3" :disabled="isAsking" @click="ask">
        <LoaderCircle v-if="isAsking" class="h-4 w-4 animate-spin" />
        {{ locale.t("dashboard.internal.ask") }}
      </button>
    </article>

    <article class="dashboard-card mt-4">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ locale.t("dashboard.internal.answer") }}</p>
      <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
        {{ answer || locale.t("dashboard.internal.empty") }}
      </p>
      <div class="mt-4">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ locale.t("dashboard.internal.references") }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span v-for="snippet in usedSnippets" :key="snippet.id" class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
            {{ snippet.id.slice(0, 8) }} · {{ snippet.score.toFixed(2) }}
          </span>
        </div>
      </div>
    </article>
  </DashboardFrame>
</template>
