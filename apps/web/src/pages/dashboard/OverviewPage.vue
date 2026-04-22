<script setup lang="ts">
import { CalendarDays, ShieldCheck, Sparkles } from "lucide-vue-next";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

onMounted(async () => {
  await dashboard.initialize(router, { sections: ["overview", "conversations", "bookings"] });
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.overview.title')"
    :subtitle="locale.t('dashboard.overview.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.loadData({ sections: ['overview', 'conversations', 'bookings'] })"
    @logout="dashboard.logout(router)"
  >
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="card in dashboard.cards"
        :key="card.label"
        class="dashboard-card p-5"
      >
        <p class="text-sm text-slate-400">{{ card.label }}</p>
        <p class="mt-2 text-3xl font-semibold text-white">{{ card.value }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ card.helper }}</p>
      </article>
    </section>

    <section class="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
      <article class="dashboard-card p-5">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ locale.t("dashboard.overview.conversationOps") }}</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div class="dashboard-subcard p-3">
            <p class="text-sm text-slate-400">{{ locale.t("dashboard.overview.openNow") }}</p>
            <p class="mt-1 text-2xl font-semibold text-white">{{ dashboard.openConversations }}</p>
          </div>
          <div class="dashboard-subcard p-3">
            <p class="text-sm text-slate-400">{{ locale.t("dashboard.overview.humanHandoff") }}</p>
            <p class="mt-1 text-2xl font-semibold text-white">{{ dashboard.humanHandoffConversations }}</p>
          </div>
        </div>
      </article>

      <article class="dashboard-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ locale.t("dashboard.overview.bookingPipeline") }}</p>
          <CalendarDays class="h-4 w-4 text-teal-300" />
        </div>
        <div class="mt-3 space-y-3">
          <div
            v-for="status in dashboard.bookingStatusSummary"
            :key="status.status"
            class="dashboard-subcard p-3"
          >
            <div class="flex items-center justify-between text-sm">
              <p class="text-slate-300">{{ status.status }}</p>
              <p class="font-semibold text-white">{{ status.count }}</p>
            </div>
            <div class="mt-2 h-2 rounded-full bg-slate-800">
              <div
                class="h-2 rounded-full bg-teal-400"
                :style="{ width: `${Math.max(8, (status.count / Math.max(1, dashboard.bookings.length)) * 100)}%` }"
              />
            </div>
          </div>
          <p v-if="dashboard.bookingStatusSummary.length === 0" class="text-sm text-slate-400">{{ locale.t("dashboard.overview.noStatuses") }}</p>
        </div>
      </article>

      <article class="rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/10 via-slate-900 to-indigo-500/10 p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-300">{{ locale.t("dashboard.overview.systemProfile") }}</p>
          <ShieldCheck class="h-4 w-4 text-teal-300" />
        </div>
        <ul class="mt-3 space-y-2 text-sm text-slate-300">
          <li>{{ locale.t("dashboard.overview.profile1") }}</li>
          <li>{{ locale.t("dashboard.overview.profile2") }}</li>
          <li>{{ locale.t("dashboard.overview.profile3") }}</li>
          <li>{{ locale.t("dashboard.overview.profile4") }}</li>
        </ul>
        <div class="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <Sparkles class="mb-2 h-4 w-4 text-teal-300" />
          {{ locale.t("dashboard.overview.sidebarTip") }}
        </div>
      </article>
    </section>
  </DashboardFrame>
</template>
