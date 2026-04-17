<script setup lang="ts">
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CalendarDays,
  ClipboardList,
  Globe,
  Inbox,
  LifeBuoy,
  LogOut,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useLocaleStore } from "../../stores/locale";

const props = defineProps<{
  title: string;
  subtitle: string;
  businessName: string;
  loading: boolean;
  error: string;
  success: string;
}>();

const emit = defineEmits<{
  refresh: [];
  logout: [];
}>();

const route = useRoute();
const router = useRouter();
const locale = useLocaleStore();

const navItems = [
  { labelKey: "dashboard.nav.overview", icon: Bot, to: "/dashboard" },
  { labelKey: "dashboard.nav.support", icon: LifeBuoy, to: "/dashboard/support-agent" },
  { labelKey: "dashboard.nav.shifts", icon: Users, to: "/dashboard/shifts" },
  { labelKey: "dashboard.nav.employees", icon: Users, to: "/dashboard/employees" },
  { labelKey: "dashboard.nav.internal", icon: BookOpen, to: "/dashboard/internal-assistant" },
  { labelKey: "dashboard.nav.automations", icon: ClipboardList, to: "/dashboard/automations" },
  { labelKey: "dashboard.nav.reports", icon: CalendarDays, to: "/dashboard/reports" },
  { labelKey: "dashboard.nav.multilingual", icon: Globe, to: "/dashboard/regional" },
  { labelKey: "dashboard.nav.knowledge", icon: BookOpen, to: "/dashboard/knowledge" },
  { labelKey: "dashboard.nav.inbox", icon: Inbox, to: "/dashboard/inbox" },
  { labelKey: "dashboard.nav.bookings", icon: CalendarDays, to: "/dashboard/bookings" },
  { labelKey: "dashboard.nav.widget", icon: Sparkles, to: "/dashboard/widget" },
];

const activePath = computed(() => route.path);
const visibleError = ref("");
const visibleSuccess = ref("");
let errorTimer: number | null = null;
let successTimer: number | null = null;

function clearErrorTimer() {
  if (errorTimer !== null) {
    window.clearTimeout(errorTimer);
    errorTimer = null;
  }
}

function clearSuccessTimer() {
  if (successTimer !== null) {
    window.clearTimeout(successTimer);
    successTimer = null;
  }
}

function dismissError() {
  visibleError.value = "";
  clearErrorTimer();
}

function dismissSuccess() {
  visibleSuccess.value = "";
  clearSuccessTimer();
}

watch(
  () => props.error,
  (next) => {
    if (!next) {
      dismissError();
      return;
    }
    visibleError.value = next;
    clearErrorTimer();
    errorTimer = window.setTimeout(() => {
      visibleError.value = "";
      errorTimer = null;
    }, 5500);
  },
  { immediate: true },
);

watch(
  () => props.success,
  (next) => {
    if (!next) {
      dismissSuccess();
      return;
    }
    visibleSuccess.value = next;
    clearSuccessTimer();
    successTimer = window.setTimeout(() => {
      visibleSuccess.value = "";
      successTimer = null;
    }, 4200);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearErrorTimer();
  clearSuccessTimer();
});

function onLocaleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const next = target.value === "fr-CA" ? "fr-CA" : "en-CA";
  locale.applyLocale(next);
}
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 lg:grid-cols-[270px_1fr] lg:px-6">
      <aside class="rounded-3xl border border-white/10 bg-linear-to-b from-slate-900 to-slate-950 p-4 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.5)] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
        <div class="flex h-full min-h-0 flex-col">
        <div class="flex items-center gap-3 border-b border-white/10 pb-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
            <Bot class="h-5 w-5" />
          </div>
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ locale.t("dashboard.brand") }}</p>
            <p class="text-sm font-semibold text-white">{{ businessName }}</p>
          </div>
        </div>

        <nav class="mt-4 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            :class="
              activePath === item.to
                ? 'bg-teal-500/20 font-medium text-white'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            "
          >
            <component :is="item.icon" class="h-4 w-4" />
            {{ locale.t(item.labelKey) }}
          </RouterLink>
        </nav>

        <div class="mt-6 space-y-2 border-t border-white/10 pt-4">
          <div class="px-3 py-1">
            <select
              class="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              :value="locale.locale"
              @change="onLocaleChange"
            >
              <option value="en-CA">{{ locale.t("locale.english") }}</option>
              <option value="fr-CA">{{ locale.t("locale.french") }}</option>
            </select>
          </div>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white"
            @click="emit('refresh')"
          >
            <RefreshCw class="h-4 w-4" />
            {{ locale.t("dashboard.actions.refresh") }}
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white"
            @click="router.push('/')"
          >
            <ArrowLeft class="h-4 w-4" />
            {{ locale.t("dashboard.actions.backWebsite") }}
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-left text-sm font-medium text-rose-200 hover:bg-rose-500/25"
            @click="emit('logout')"
          >
            <LogOut class="h-4 w-4" />
            {{ locale.t("dashboard.actions.logout") }}
          </button>
        </div>
        </div>
      </aside>

      <main class="space-y-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
        <div class="pointer-events-none fixed right-4 top-4 z-90 flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
          <Transition
            enter-active-class="transition-opacity duration-120 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-120 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="visibleError"
              class="pointer-events-auto rounded-2xl border border-rose-300/20 bg-slate-900/95 px-4 py-3 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.8)] backdrop-blur"
            >
              <div class="flex items-start gap-3">
                <p class="flex-1 text-sm font-medium text-rose-200">
                  {{ visibleError }}
                </p>
                <button
                  type="button"
                  class="rounded-md px-1 text-rose-200/80 transition hover:bg-white/10 hover:text-rose-100"
                  aria-label="Dismiss notification"
                  @click="dismissError"
                >
                  ×
                </button>
              </div>
            </div>
          </Transition>

          <Transition
            enter-active-class="transition-opacity duration-120 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-120 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="visibleSuccess"
              class="pointer-events-auto rounded-2xl border border-emerald-300/20 bg-slate-900/95 px-4 py-3 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.8)] backdrop-blur"
            >
              <div class="flex items-start gap-3">
                <p class="flex-1 text-sm font-medium text-emerald-200">
                  {{ visibleSuccess }}
                </p>
                <button
                  type="button"
                  class="rounded-md px-1 text-emerald-200/80 transition hover:bg-white/10 hover:text-emerald-100"
                  aria-label="Dismiss notification"
                  @click="dismissSuccess"
                >
                  ×
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <header class="rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/90 to-slate-900/60 p-5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.65)] sm:p-6">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ locale.t("dashboard.header") }}</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-white">{{ title }}</h1>
          <p class="mt-1 text-sm text-slate-300">{{ subtitle }}</p>
        </header>

        <div v-if="loading" class="flex min-h-[260px] items-center justify-center rounded-3xl border border-white/10 bg-slate-900/70">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <RefreshCw class="h-4 w-4 animate-spin" />
            {{ locale.t("dashboard.loading") }}
          </div>
        </div>

        <div v-else class="content-stagger">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
