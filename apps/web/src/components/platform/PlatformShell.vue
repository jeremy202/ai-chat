<script setup lang="ts">
import { useRouter } from "vue-router";
import { useSuperadminStore } from "../../stores/superadmin";

defineProps<{
  title: string;
  subtitle: string;
}>();

const router = useRouter();
const superadmin = useSuperadminStore();

function logout() {
  superadmin.clearSession();
  router.push("/platform/login");
}
</script>

<template>
  <div class="app-shell min-h-screen px-4 py-8 sm:px-6">
    <div class="mx-auto max-w-7xl">
      <header class="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Platform Superadmin</p>
            <h1 class="mt-1 text-2xl font-semibold text-white">{{ title }}</h1>
            <p class="text-sm text-slate-300">{{ subtitle }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <RouterLink class="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5" to="/platform">Overview</RouterLink>
            <RouterLink class="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5" to="/platform/users">Users</RouterLink>
            <RouterLink class="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5" to="/platform/businesses">Businesses</RouterLink>
            <RouterLink class="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5" to="/platform/analytics">Analytics</RouterLink>
            <button class="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-400" type="button" @click="logout">
              Log out
            </button>
          </div>
        </div>
      </header>

      <slot />
    </div>
  </div>
</template>
