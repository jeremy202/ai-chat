<script setup lang="ts">
import { BookOpen, LoaderCircle, Sparkles, Trash2 } from "lucide-vue-next";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

function presetCompanyGuide() {
  if (!dashboard.knowledgeForm.title.trim()) {
    dashboard.knowledgeForm.title = "Company Guide";
  }
  dashboard.knowledgeForm.sourceType = "POLICY";
}

onMounted(async () => {
  await dashboard.initialize(router, { sections: ["knowledge"] });
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.knowledge.title')"
    :subtitle="locale.t('dashboard.knowledge.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.loadData({ sections: ['knowledge'] })"
    @logout="dashboard.logout(router)"
  >
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-slate-400">{{ locale.t("dashboard.knowledge.kicker") }}</p>
          <h2 class="mt-1 text-xl font-semibold text-white">{{ locale.t("dashboard.knowledge.heading") }}</h2>
          <p class="mt-2 text-sm text-slate-300">
            Paste your full company guide below and click index. The AI will use this content for customer and internal answers.
          </p>
        </div>
        <BookOpen class="h-5 w-5 text-teal-300" />
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <span class="text-xs uppercase tracking-[0.2em] text-slate-400">Quick setup</span>
        <button
          type="button"
          class="rounded-full border border-teal-300/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200 hover:bg-teal-500/20"
          @click="presetCompanyGuide"
        >
          Use as company guide
        </button>
        <span class="text-xs text-slate-400">Tip: keep sections like policies, services, pricing, and FAQs in one guide.</span>
      </div>

      <form class="mt-5 grid gap-4" @submit.prevent="dashboard.editingKnowledgeId ? dashboard.saveKnowledgeEdit() : dashboard.uploadKnowledge()">
        <div class="grid gap-4 md:grid-cols-[1fr_220px]">
          <input
            v-model="dashboard.knowledgeForm.title"
            type="text"
            :placeholder="locale.t('dashboard.knowledge.titlePlaceholder')"
            class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300"
          />
          <select
            v-model="dashboard.knowledgeForm.sourceType"
            class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300"
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
          v-model="dashboard.knowledgeForm.content"
          rows="8"
          :placeholder="'Paste your company guide here. Example: About us, policies, pricing rules, services, escalation paths, and FAQs.'"
          class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300"
        />
        <div class="flex justify-end">
          <button
            v-if="dashboard.editingKnowledgeId"
            type="button"
            class="mr-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            @click="dashboard.cancelEditKnowledge"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="dashboard.savingKnowledge"
          >
            <LoaderCircle v-if="dashboard.savingKnowledge" class="h-4 w-4 animate-spin" />
            <Sparkles v-else class="h-4 w-4" />
            {{ dashboard.editingKnowledgeId ? "Save changes" : locale.t("dashboard.knowledge.indexButton") }}
          </button>
        </div>
      </form>
    </article>

    <section class="mt-4 grid gap-3">
      <article
        v-for="item in dashboard.knowledgeItems"
        :key="item.id"
        class="rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-white">{{ item.title }}</p>
            <p class="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{{ item.sourceType }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="rounded-full bg-teal-500/20 px-2.5 py-1 text-xs text-teal-300">{{ item._count.chunks }} {{ locale.t("dashboard.knowledge.chunks") }}</span>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
              @click="dashboard.startEditKnowledge(item)"
            >
              Edit
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
              @click="dashboard.deleteKnowledge(item.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
        <p class="mt-2 text-sm text-slate-300">
          {{ item.rawContent.slice(0, 260) }}<span v-if="item.rawContent.length > 260">...</span>
        </p>
      </article>
    </section>
  </DashboardFrame>
</template>
