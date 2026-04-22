<script setup lang="ts">
import { onMounted, ref } from "vue";
import PlatformShell from "../../components/platform/PlatformShell.vue";
import { platformApi, type PlatformAnalyticsSummary } from "../../services/api";

const summary = ref<PlatformAnalyticsSummary | null>(null);
const loading = ref(false);
const error = ref("");

async function loadAnalytics() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await platformApi.getAnalytics();
    summary.value = data.summary;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to load analytics.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadAnalytics);
</script>

<template>
  <PlatformShell title="Analytics" subtitle="Global activity totals across the full platform.">
    <p v-if="error" class="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{{ error }}</p>
    <article class="dashboard-card p-4">
      <button class="dashboard-button-secondary" @click="loadAnalytics">{{ loading ? "Refreshing..." : "Refresh" }}</button>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div class="dashboard-subcard p-3">
          <p class="text-xs text-slate-400">Businesses</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary?.businesses ?? 0 }}</p>
        </div>
        <div class="dashboard-subcard p-3">
          <p class="text-xs text-slate-400">Suspended</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary?.suspendedBusinesses ?? 0 }}</p>
        </div>
        <div class="dashboard-subcard p-3">
          <p class="text-xs text-slate-400">Users</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary?.users ?? 0 }}</p>
        </div>
        <div class="dashboard-subcard p-3">
          <p class="text-xs text-slate-400">Conversations</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary?.conversations ?? 0 }}</p>
        </div>
        <div class="dashboard-subcard p-3">
          <p class="text-xs text-slate-400">Bookings</p>
          <p class="mt-1 text-2xl font-semibold text-white">{{ summary?.bookings ?? 0 }}</p>
        </div>
      </div>
    </article>
  </PlatformShell>
</template>
