<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PlatformShell from "../../components/platform/PlatformShell.vue";
import {
  platformApi,
  type PlatformAnalyticsSummary,
  type PlatformBusiness,
  type PlatformManagedUser,
} from "../../services/api";

const summary = ref<PlatformAnalyticsSummary | null>(null);
const users = ref<PlatformManagedUser[]>([]);
const businesses = ref<PlatformBusiness[]>([]);
const loading = ref(false);
const error = ref("");

async function loadSummary() {
  loading.value = true;
  error.value = "";
  try {
    const [{ data: analyticsData }, { data: usersData }, { data: businessesData }] = await Promise.all([
      platformApi.getAnalytics(),
      platformApi.getUsers(),
      platformApi.getBusinesses(),
    ]);
    summary.value = analyticsData.summary;
    users.value = usersData.users;
    businesses.value = businessesData.businesses;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to load platform overview.";
  } finally {
    loading.value = false;
  }
}

const activeBusinesses = computed(() =>
  businesses.value.filter((business) => business.status === "ACTIVE"),
);
const suspendedBusinesses = computed(() =>
  businesses.value.filter((business) => business.status === "SUSPENDED"),
);
const activeUsers = computed(() => users.value.filter((user) => user.active));
const inactiveUsers = computed(() => users.value.filter((user) => !user.active));
const ownerUsers = computed(() => users.value.filter((user) => user.role === "OWNER"));
const attentionBusinesses = computed(() =>
  businesses.value.filter(
    (business) => business.subscriptionStatus === "PAST_DUE" || business.subscriptionStatus === "CANCELED",
  ),
);

const newestUsers = computed(() =>
  [...users.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5),
);

const newestBusinesses = computed(() =>
  [...businesses.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5),
);

const systemHealth = computed(() => {
  if (!summary.value) {
    return 0;
  }
  const suspendedPenalty = suspendedBusinesses.value.length * 8;
  const inactivePenalty = inactiveUsers.value.length * 2;
  return Math.max(52, Math.min(99, 100 - suspendedPenalty - inactivePenalty));
});

const healthState = computed(() => {
  if (systemHealth.value >= 90) return "Strong";
  if (systemHealth.value >= 75) return "Stable";
  return "Needs attention";
});

const conversationPerBusiness = computed(() => {
  if (!summary.value?.businesses) return 0;
  return Math.round(summary.value.conversations / Math.max(summary.value.businesses, 1));
});

const bookingPerBusiness = computed(() => {
  if (!summary.value?.businesses) return 0;
  return Math.round(summary.value.bookings / Math.max(summary.value.businesses, 1));
});

onMounted(loadSummary);
</script>

<template>
  <PlatformShell title="Overview" subtitle="Live command center for tenant growth, health, and support operations.">
    <p v-if="error" class="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{{ error }}</p>

    <section class="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
      <article class="dashboard-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Platform health score</p>
            <p class="mt-1 text-4xl font-semibold text-white">{{ loading ? "..." : `${systemHealth}%` }}</p>
            <p class="text-sm text-slate-300">{{ healthState }} across active tenants and user access.</p>
          </div>
          <button class="dashboard-button-secondary" @click="loadSummary">{{ loading ? "Refreshing..." : "Refresh data" }}</button>
        </div>
        <div class="mt-4 h-2.5 w-full rounded-full bg-white/10">
          <div
            class="h-2.5 rounded-full bg-linear-to-r from-teal-400 to-cyan-300 transition-all"
            :style="{ width: `${systemHealth}%` }"
          />
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div class="dashboard-subcard p-3">
            <p class="text-xs text-slate-400">Conversations / business</p>
            <p class="mt-1 text-2xl font-semibold text-white">{{ loading ? "..." : conversationPerBusiness }}</p>
          </div>
          <div class="dashboard-subcard p-3">
            <p class="text-xs text-slate-400">Bookings / business</p>
            <p class="mt-1 text-2xl font-semibold text-white">{{ loading ? "..." : bookingPerBusiness }}</p>
          </div>
          <div class="dashboard-subcard p-3">
            <p class="text-xs text-slate-400">Owners assigned</p>
            <p class="mt-1 text-2xl font-semibold text-white">{{ loading ? "..." : ownerUsers.length }}</p>
          </div>
        </div>
      </article>

      <article class="dashboard-card p-5">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Priority queue</p>
        <div class="mt-3 grid gap-2 text-sm">
          <div class="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-rose-200">
            <span class="font-semibold">{{ attentionBusinesses.length }}</span> businesses need subscription follow-up.
          </div>
          <div class="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-200">
            <span class="font-semibold">{{ suspendedBusinesses.length }}</span> suspended businesses awaiting review.
          </div>
          <div class="rounded-xl border border-sky-300/30 bg-sky-500/10 px-3 py-2 text-sky-200">
            <span class="font-semibold">{{ inactiveUsers.length }}</span> inactive user accounts available for cleanup.
          </div>
        </div>
      </article>
    </section>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <article
        v-for="item in [
          { label: 'Businesses', value: summary?.businesses ?? 0, hint: `${activeBusinesses.length} active` },
          { label: 'Suspended', value: summary?.suspendedBusinesses ?? 0, hint: `${suspendedBusinesses.length} in queue` },
          { label: 'Users', value: summary?.users ?? 0, hint: `${activeUsers.length} active users` },
          { label: 'Conversations', value: summary?.conversations ?? 0, hint: 'Cross-tenant total' },
          { label: 'Bookings', value: summary?.bookings ?? 0, hint: 'Captured leads' },
        ]"
        :key="item.label"
        class="dashboard-card p-4"
      >
        <p class="text-xs text-slate-400">{{ item.label }}</p>
        <p class="mt-1 text-3xl font-semibold text-white">{{ loading ? "..." : item.value }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ item.hint }}</p>
      </article>
    </div>

    <section class="mt-4 grid gap-4 xl:grid-cols-2">
      <article class="dashboard-card p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-white">Recent user activity</p>
          <RouterLink class="dashboard-button-secondary" to="/platform/users">Manage users</RouterLink>
        </div>
        <div class="mt-3 grid gap-2">
          <div v-for="user in newestUsers" :key="user.id" class="dashboard-subcard p-3">
            <p class="text-sm font-semibold text-white">{{ user.name }} · {{ user.role }}</p>
            <p class="text-xs text-slate-400">
              {{ user.email }} · {{ user.business.name }} · {{ user.active ? "Active" : "Inactive" }}
            </p>
          </div>
          <p v-if="!newestUsers.length" class="text-sm text-slate-400">No user activity available yet.</p>
        </div>
      </article>

      <article class="dashboard-card p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-white">Recent business activity</p>
          <RouterLink class="dashboard-button-secondary" to="/platform/businesses">Manage businesses</RouterLink>
        </div>
        <div class="mt-3 grid gap-2">
          <div v-for="business in newestBusinesses" :key="business.id" class="dashboard-subcard p-3">
            <p class="text-sm font-semibold text-white">{{ business.name }} ({{ business.slug }})</p>
            <p class="text-xs text-slate-400">
              {{ business.subscriptionPlan }} · {{ business.subscriptionStatus }} · {{ business.status }}
            </p>
          </div>
          <p v-if="!newestBusinesses.length" class="text-sm text-slate-400">No business activity available yet.</p>
        </div>
      </article>
    </section>

    <article class="dashboard-card mt-4 p-4">
      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Operations checklist</p>
      <div class="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
        <p>- Review new users and verify role assignment policy.</p>
        <p>- Resolve subscription status issues before tenant support escalation.</p>
        <p>- Use impersonation only for validated support incidents.</p>
      </div>
    </article>
  </PlatformShell>
</template>
