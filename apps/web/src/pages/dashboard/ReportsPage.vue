<script setup lang="ts">
import { BarChart3, RefreshCw } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { adminApi } from "../../services/api";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();
const period = ref<"daily" | "weekly">("daily");
const summary = ref<{
  period: string;
  from: string;
  to: string;
  totalConversations: number;
  humanHandoffs: number;
  qualifiedLeads: number;
  bookingsCaptured: number;
  bookingStatuses: Record<string, number>;
} | null>(null);
const loadingSummary = ref(false);

async function loadSummary() {
  loadingSummary.value = true;
  try {
    const { data } = await adminApi.getReportSummary(period.value);
    summary.value = data.summary;
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to load report summary.";
  } finally {
    loadingSummary.value = false;
  }
}

onMounted(async () => {
  const ok = await dashboard.initialize(router);
  if (!ok) return;
  await loadSummary();
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.reports.title')"
    :subtitle="locale.t('dashboard.reports.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="loadSummary"
    @logout="dashboard.logout(router)"
  >
    <article class="dashboard-card">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <BarChart3 class="h-5 w-5 text-teal-300" />
          <p class="text-sm text-slate-300">{{ locale.t("dashboard.reports.performance") }}</p>
        </div>
        <div class="flex items-center gap-2">
          <select v-model="period" class="dashboard-input rounded-lg py-1.5">
            <option value="daily">{{ locale.t("dashboard.reports.daily") }}</option>
            <option value="weekly">{{ locale.t("dashboard.reports.weekly") }}</option>
          </select>
          <button class="dashboard-button-secondary" @click="loadSummary">
            <RefreshCw class="h-3.5 w-3.5" />
            {{ locale.t("dashboard.actions.refresh") }}
          </button>
        </div>
      </div>

      <div v-if="loadingSummary" class="mt-4 text-sm text-slate-400">{{ locale.t("dashboard.reports.loading") }}</div>
      <div v-else-if="summary" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="dashboard-subcard">
          <p class="text-xs text-slate-400">{{ locale.t("dashboard.reports.conversations") }}</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary.totalConversations }}</p>
        </div>
        <div class="dashboard-subcard">
          <p class="text-xs text-slate-400">{{ locale.t("dashboard.reports.handoffs") }}</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary.humanHandoffs }}</p>
        </div>
        <div class="dashboard-subcard">
          <p class="text-xs text-slate-400">{{ locale.t("dashboard.reports.qualified") }}</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary.qualifiedLeads }}</p>
        </div>
        <div class="dashboard-subcard">
          <p class="text-xs text-slate-400">{{ locale.t("dashboard.reports.bookings") }}</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary.bookingsCaptured }}</p>
        </div>
      </div>
    </article>
  </DashboardFrame>
</template>
