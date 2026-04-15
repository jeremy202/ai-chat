<script setup lang="ts">
import { BookOpen, LoaderCircle, Sparkles } from "lucide-vue-next";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";

const router = useRouter();
const dashboard = useDashboardOps();

onMounted(async () => {
  await dashboard.initialize(router);
});
</script>

<template>
  <DashboardFrame
    title="Knowledge Base"
    subtitle="Upload and maintain the content your concierge uses to answer guests."
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.loadData"
    @logout="dashboard.logout(router)"
  >
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-slate-400">Knowledge base</p>
          <h2 class="mt-1 text-xl font-semibold text-white">Index hospitality knowledge</h2>
        </div>
        <BookOpen class="h-5 w-5 text-teal-300" />
      </div>

      <form class="mt-5 grid gap-4" @submit.prevent="dashboard.uploadKnowledge">
        <div class="grid gap-4 md:grid-cols-[1fr_220px]">
          <input
            v-model="dashboard.knowledgeForm.title"
            type="text"
            placeholder="Dog-friendly suites and winter pricing"
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
          placeholder="Describe room categories, amenities, rates, cancellation rules, breakfast policy, pet policy, and booking notes."
          class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300"
        />
        <div class="flex justify-end">
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="dashboard.savingKnowledge"
          >
            <LoaderCircle v-if="dashboard.savingKnowledge" class="h-4 w-4 animate-spin" />
            <Sparkles v-else class="h-4 w-4" />
            Index knowledge
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
          <span class="rounded-full bg-teal-500/20 px-2.5 py-1 text-xs text-teal-300">{{ item._count.chunks }} chunks</span>
        </div>
        <p class="mt-2 text-sm text-slate-300">
          {{ item.rawContent.slice(0, 260) }}<span v-if="item.rawContent.length > 260">...</span>
        </p>
      </article>
    </section>
  </DashboardFrame>
</template>
