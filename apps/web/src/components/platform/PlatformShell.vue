<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSuperadminStore } from "../../stores/superadmin";

defineProps<{
  title: string;
  subtitle: string;
}>();

const router = useRouter();
const route = useRoute();
const superadmin = useSuperadminStore();

const navItems = [
  { to: "/platform", label: "Overview", description: "Command center" },
  { to: "/platform/users", label: "Users", description: "Access & roles" },
  { to: "/platform/businesses", label: "Businesses", description: "Tenants & plans" },
  { to: "/platform/analytics", label: "Analytics", description: "Usage metrics" },
];

const currentDate = computed(() =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date()),
);

function isActivePath(path: string) {
  if (path === "/platform") {
    return route.path === path;
  }
  return route.path.startsWith(path);
}

function logout() {
  superadmin.clearSession();
  router.push("/platform/login");
}
</script>

<template>
  <div class="app-shell min-h-screen px-3 py-5 sm:px-6 lg:px-8">
    <div class="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[260px_1fr]">
      <aside class="dashboard-card h-fit p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <p class="text-[11px] uppercase tracking-[0.22em] text-teal-300/90">Platform Superadmin</p>
        <p class="mt-2 text-sm text-slate-300">{{ currentDate }}</p>
        <div class="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p class="text-xs text-slate-400">Signed in as</p>
          <p class="mt-1 font-semibold text-white">{{ superadmin.user?.name ?? "Superadmin" }}</p>
          <p class="truncate text-xs text-slate-400">{{ superadmin.user?.email ?? "No email available" }}</p>
        </div>
        <nav class="mt-4 grid gap-2">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-xl border px-3 py-2 transition"
            :class="
              isActivePath(item.to)
                ? 'border-teal-400/50 bg-teal-500/10'
                : 'border-white/10 bg-white/0 hover:bg-white/5'
            "
          >
            <p class="text-sm font-semibold text-white">{{ item.label }}</p>
            <p class="text-xs text-slate-400">{{ item.description }}</p>
          </RouterLink>
        </nav>
        <button
          class="mt-4 w-full rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
          type="button"
          @click="logout"
        >
          Log out
        </button>
      </aside>

      <section>
        <header class="dashboard-card mb-4 p-4">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Control Room</p>
          <h1 class="mt-1 text-2xl font-semibold text-white">{{ title }}</h1>
          <p class="text-sm text-slate-300">{{ subtitle }}</p>
        </header>
        <slot />
      </section>
    </div>
  </div>
</template>
