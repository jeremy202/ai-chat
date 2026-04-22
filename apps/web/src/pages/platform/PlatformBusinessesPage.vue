<script setup lang="ts">
import { onMounted, ref } from "vue";
import PlatformShell from "../../components/platform/PlatformShell.vue";
import { platformApi, type PlatformBusiness } from "../../services/api";

const businesses = ref<PlatformBusiness[]>([]);
const loading = ref(false);
const query = ref("");
const error = ref("");

async function loadBusinesses() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await platformApi.getBusinesses(query.value);
    businesses.value = data.businesses;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to load businesses.";
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(business: PlatformBusiness) {
  try {
    await platformApi.updateBusiness(business.id, {
      status: business.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
    });
    await loadBusinesses();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to update business status.";
  }
}

async function updateSubscription(
  business: PlatformBusiness,
  field: "subscriptionPlan" | "subscriptionStatus",
  value: string,
) {
  try {
    await platformApi.updateBusiness(business.id, { [field]: value } as {
      subscriptionPlan?: "FREE" | "PRO" | "ENTERPRISE";
      subscriptionStatus?: "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
    });
    await loadBusinesses();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to update subscription values.";
  }
}

function onSubscriptionPlanChange(business: PlatformBusiness, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  void updateSubscription(business, "subscriptionPlan", value);
}

function onSubscriptionStatusChange(business: PlatformBusiness, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  void updateSubscription(business, "subscriptionStatus", value);
}

onMounted(loadBusinesses);
</script>

<template>
  <PlatformShell title="Businesses" subtitle="Suspend/activate tenants and manage subscription metadata placeholders.">
    <p v-if="error" class="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{{ error }}</p>
    <article class="dashboard-card p-4">
      <div class="grid gap-2 md:grid-cols-[1fr_auto]">
        <input v-model="query" class="dashboard-input" placeholder="Search businesses by name, slug, or email" />
        <button class="dashboard-button-secondary" @click="loadBusinesses">{{ loading ? "Loading..." : "Search" }}</button>
      </div>
    </article>
    <section class="mt-4 grid gap-3">
      <article v-for="business in businesses" :key="business.id" class="dashboard-subcard p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-white">{{ business.name }} ({{ business.slug }})</p>
            <p class="text-xs text-slate-400">{{ business.email }} · {{ business.users[0]?.email ?? "No owner found" }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="business.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'">
              {{ business.status }}
            </span>
            <button class="dashboard-button-secondary" @click="toggleStatus(business)">
              {{ business.status === "ACTIVE" ? "Suspend" : "Activate" }}
            </button>
            <select class="dashboard-input py-1.5" :value="business.subscriptionPlan" @change="onSubscriptionPlanChange(business, $event)">
              <option value="FREE">FREE</option>
              <option value="PRO">PRO</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
            <select class="dashboard-input py-1.5" :value="business.subscriptionStatus" @change="onSubscriptionStatusChange(business, $event)">
              <option value="NONE">NONE</option>
              <option value="TRIALING">TRIALING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELED">CANCELED</option>
            </select>
          </div>
        </div>
      </article>
    </section>
  </PlatformShell>
</template>
