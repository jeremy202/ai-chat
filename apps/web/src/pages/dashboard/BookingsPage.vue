<script setup lang="ts">
import { CalendarDays } from "lucide-vue-next";
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
    :title="locale.t('dashboard.bookings.title')"
    :subtitle="locale.t('dashboard.bookings.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.loadData"
    @logout="dashboard.logout(router)"
  >
    <article class="dashboard-card">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-slate-400">{{ locale.t("dashboard.bookings.kicker") }}</p>
          <h2 class="mt-1 text-xl font-semibold text-white">{{ locale.t("dashboard.bookings.heading") }}</h2>
        </div>
        <CalendarDays class="h-5 w-5 text-teal-300" />
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="status in dashboard.bookingStatusSummary"
          :key="status.status"
          class="dashboard-subcard p-3"
        >
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ status.status }}</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ status.count }}</p>
        </div>
      </div>

      <div class="mt-5 space-y-3">
        <article
          v-for="booking in dashboard.recentBookings"
          :key="booking.id"
          class="dashboard-subcard"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-white">
                {{ booking.guestName ?? booking.conversation?.visitorName ?? locale.t("dashboard.common.guestLead") }}
              </p>
              <p class="mt-1 text-xs text-slate-400">
                {{ booking.email ?? booking.conversation?.visitorEmail ?? locale.t("dashboard.bookings.noEmail") }}
              </p>
            </div>
            <span class="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200">{{ booking.status }}</span>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
            <p>{{ locale.t("dashboard.bookings.arrival") }}: <span class="text-slate-200">{{ dashboard.formatDate(booking.arrivalDate) }}</span></p>
            <p>{{ locale.t("dashboard.bookings.departure") }}: <span class="text-slate-200">{{ dashboard.formatDate(booking.departureDate) }}</span></p>
          </div>
          <p class="mt-2 text-xs text-slate-400">
            {{ locale.t("dashboard.bookings.guests") }}: {{ booking.guests ?? locale.t("dashboard.bookings.unknown") }} · {{ locale.t("dashboard.bookings.room") }}: {{ booking.roomType ?? locale.t("dashboard.bookings.flexible") }}
          </p>
        </article>
      </div>
    </article>
  </DashboardFrame>
</template>
