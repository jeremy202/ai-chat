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
    .slice(0, 3),
);

const recentActivity = computed(() => {
  const userActivity = newestUsers.value.map((user) => ({
    id: `user-${user.id}`,
    title: `${user.name} (${user.role})`,
    detail: `${user.business.name} · ${user.active ? "Active" : "Inactive"}`,
    kind: "User",
  }));

  const businessActivity = newestBusinesses.value.map((business) => ({
    id: `business-${business.id}`,
    title: `${business.name} (${business.slug})`,
    detail: `${business.subscriptionPlan} · ${business.subscriptionStatus}`,
    kind: "Business",
  }));

  return [...userActivity, ...businessActivity].slice(0, 6);
});

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
  <PlatformShell title="Overview" subtitle="Clean snapshot of platform health, KPIs, and latest activity.">
    <p v-if="error" class="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{{ error }}</p>

    <section class="mb-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
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
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
            {{ loading ? "..." : `${conversationPerBusiness} conv/business` }}
          </span>
          <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
            {{ loading ? "..." : `${bookingPerBusiness} bookings/business` }}
          </span>
          <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
            {{ loading ? "..." : `${ownerUsers.length} owners assigned` }}
          </span>
        </div>
      </article>

      <article class="dashboard-card p-5">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Needs attention</p>
        <div class="mt-3 grid gap-2 text-sm">
          <p class="dashboard-subcard p-3 text-rose-200">
            <span class="font-semibold">{{ attentionBusinesses.length }}</span> subscription follow-ups
          </p>
          <p class="dashboard-subcard p-3 text-amber-200">
            <span class="font-semibold">{{ suspendedBusinesses.length }}</span> suspended businesses
          </p>
          <p class="dashboard-subcard p-3 text-sky-200">
            <span class="font-semibold">{{ inactiveUsers.length }}</span> inactive users
          </p>
        </div>
      </article>
    </section>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="item in [
          { label: 'Businesses', value: summary?.businesses ?? 0, hint: `${activeBusinesses.length} active` },
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

    <article class="dashboard-card mt-4 p-4">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-semibold text-white">Recent activity</p>
        <div class="flex gap-2">
          <RouterLink class="dashboard-button-secondary" to="/platform/users">Users</RouterLink>
          <RouterLink class="dashboard-button-secondary" to="/platform/businesses">Businesses</RouterLink>
        </div>
      </div>
      <div class="mt-3 grid gap-2">
        <div v-for="activity in recentActivity" :key="activity.id" class="dashboard-subcard p-3">
          <p class="text-sm font-semibold text-white">{{ activity.title }}</p>
          <p class="text-xs text-slate-400">{{ activity.kind }} · {{ activity.detail }}</p>
        </div>
        <p v-if="!recentActivity.length" class="text-sm text-slate-400">No activity available yet.</p>
      </div>
    </article>
  </PlatformShell>
</template>
