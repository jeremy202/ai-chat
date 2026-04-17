<script setup lang="ts">
import { LifeBuoy, LoaderCircle } from "lucide-vue-next";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { adminApi } from "../../services/api";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

const form = reactive({
  customerMessage: "",
  channel: "WEB_CHAT",
  priority: "NORMAL" as "LOW" | "NORMAL" | "HIGH",
});

const isGenerating = ref(false);
const suggestedReply = ref("");
const groundingSnippetCount = ref(0);

async function generateReply() {
  if (!form.customerMessage.trim()) return;
  isGenerating.value = true;
  dashboard.error = "";
  try {
    const { data } = await adminApi.getSupportReply(form);
    suggestedReply.value = data.suggestedReply;
    groundingSnippetCount.value = data.groundingSnippetCount;
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to generate support reply.";
  } finally {
    isGenerating.value = false;
  }
}

onMounted(async () => {
  await dashboard.initialize(router);
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.support.title')"
    :subtitle="locale.t('dashboard.support.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.loadData"
    @logout="dashboard.logout(router)"
  >
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-center gap-3">
        <LifeBuoy class="h-5 w-5 text-teal-300" />
        <p class="text-sm text-slate-300">{{ locale.t("dashboard.support.helper") }}</p>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-[1fr_180px_160px]">
        <input v-model="form.channel" type="text" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" :placeholder="locale.t('dashboard.support.channelPlaceholder')" />
        <select v-model="form.priority" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
          <option value="LOW">{{ locale.t("dashboard.common.low") }}</option>
          <option value="NORMAL">{{ locale.t("dashboard.common.normal") }}</option>
          <option value="HIGH">{{ locale.t("dashboard.common.high") }}</option>
        </select>
      </div>
      <textarea
        v-model="form.customerMessage"
        rows="5"
        class="mt-4 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        :placeholder="locale.t('dashboard.support.messagePlaceholder')"
      />
      <button
        type="button"
        class="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        :disabled="isGenerating"
        @click="generateReply"
      >
        <LoaderCircle v-if="isGenerating" class="h-4 w-4 animate-spin" />
        {{ locale.t("dashboard.support.generate") }}
      </button>
    </article>

    <article class="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ locale.t("dashboard.support.suggested") }}</p>
      <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
        {{ suggestedReply || locale.t("dashboard.support.empty") }}
      </p>
      <p class="mt-3 text-xs text-slate-400">{{ locale.t("dashboard.support.grounding") }}: {{ groundingSnippetCount }}</p>
    </article>
  </DashboardFrame>
</template>
