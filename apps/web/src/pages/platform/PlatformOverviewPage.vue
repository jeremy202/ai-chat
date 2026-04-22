<script setup lang="ts">
import { onMounted, ref } from "vue";
import PlatformShell from "../../components/platform/PlatformShell.vue";
import { platformApi, type PlatformAnalyticsSummary } from "../../services/api";

const summary = ref<PlatformAnalyticsSummary | null>(null);
const loading = ref(false);
const error = ref("");

async function loadSummary() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await platformApi.getAnalytics();
    summary.value = data.summary;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to load platform overview.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadSummary);
</script>

<template>
  <PlatformShell title="Overview" subtitle="Global platform status across all tenants.">
    <p v-if="error" class="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{{ error }}</p>
    <article class="dashboard-card mb-4 p-4">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Superadmin checklist</p>
      <div class="mt-2 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
        <p>- Review user accounts and role assignments</p>
        <p>- Verify tenant status and subscriptions</p>
        <p>- Use impersonation only for support cases</p>
      </div>
    </article>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <article class="dashboard-card p-4" v-for="item in [
        { label: 'Businesses', value: summary?.businesses ?? 0 },
        { label: 'Suspended', value: summary?.suspendedBusinesses ?? 0 },
        { label: 'Users', value: summary?.users ?? 0 },
        { label: 'Conversations', value: summary?.conversations ?? 0 },
        { label: 'Bookings', value: summary?.bookings ?? 0 },
      ]" :key="item.label">
        <p class="text-xs text-slate-400">{{ item.label }}</p>
        <p class="mt-1 text-3xl font-semibold text-white">{{ loading ? "..." : item.value }}</p>
      </article>
    </div>
  </PlatformShell>
</template>
