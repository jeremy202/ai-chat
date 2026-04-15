<script setup lang="ts">
import { Copy, ShieldCheck, Sparkles } from "lucide-vue-next";
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
    title="Widget Setup"
    subtitle="Copy your embed script and install the concierge on your website."
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
          <p class="text-sm text-slate-400">Embed widget</p>
          <h2 class="mt-1 text-xl font-semibold text-white">Install on any website</h2>
        </div>
        <Sparkles class="h-5 w-5 text-teal-300" />
      </div>
      <p class="mt-3 text-sm text-slate-300">
        Paste this script into your footer or tag manager to load your concierge widget.
      </p>
      <div class="mt-4 rounded-xl border border-white/10 bg-slate-950 p-3">
        <pre class="overflow-x-auto whitespace-pre-wrap text-xs text-cyan-100">{{ dashboard.widgetSnippet }}</pre>
      </div>
      <button
        type="button"
        class="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        @click="dashboard.copySnippet"
      >
        <Copy class="h-4 w-4" />
        Copy snippet
      </button>
    </article>

    <article class="mt-4 rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/10 via-slate-900 to-indigo-500/10 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-teal-300/80">Architecture</p>
          <h2 class="mt-1 text-xl font-semibold text-white">Production-ready MVP</h2>
        </div>
        <ShieldCheck class="h-5 w-5 text-teal-300" />
      </div>
      <ul class="mt-4 space-y-2 text-sm text-slate-300">
        <li>Vue dashboard and hosted widget UI</li>
        <li>Express + TypeScript API</li>
        <li>Prisma + PostgreSQL multi-tenant model</li>
        <li>RAG retrieval for grounded concierge answers</li>
        <li>SMTP notifications for new booking leads</li>
      </ul>
    </article>
  </DashboardFrame>
</template>
