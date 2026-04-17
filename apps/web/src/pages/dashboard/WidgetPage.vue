<script setup lang="ts">
import { Copy, ShieldCheck, Sparkles } from "lucide-vue-next";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

onMounted(async () => {
  await dashboard.initialize(router);
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.widget.title')"
    :subtitle="locale.t('dashboard.widget.subtitle')"
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
          <p class="text-sm text-slate-400">{{ locale.t("dashboard.widget.kicker") }}</p>
          <h2 class="mt-1 text-xl font-semibold text-white">{{ locale.t("dashboard.widget.heading") }}</h2>
        </div>
        <Sparkles class="h-5 w-5 text-teal-300" />
      </div>
      <p class="mt-3 text-sm text-slate-300">
        {{ locale.t("dashboard.widget.description") }}
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
        {{ locale.t("dashboard.widget.copy") }}
      </button>
    </article>

    <article class="mt-4 rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/10 via-slate-900 to-indigo-500/10 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-teal-300/80">{{ locale.t("dashboard.widget.architecture") }}</p>
          <h2 class="mt-1 text-xl font-semibold text-white">{{ locale.t("dashboard.widget.production") }}</h2>
        </div>
        <ShieldCheck class="h-5 w-5 text-teal-300" />
      </div>
      <ul class="mt-4 space-y-2 text-sm text-slate-300">
        <li>{{ locale.t("dashboard.widget.arch1") }}</li>
        <li>{{ locale.t("dashboard.widget.arch2") }}</li>
        <li>{{ locale.t("dashboard.widget.arch3") }}</li>
        <li>{{ locale.t("dashboard.widget.arch4") }}</li>
        <li>{{ locale.t("dashboard.widget.arch5") }}</li>
      </ul>
    </article>
  </DashboardFrame>
</template>
