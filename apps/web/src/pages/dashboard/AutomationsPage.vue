<script setup lang="ts">
import { ClipboardList, LoaderCircle, Play } from "lucide-vue-next";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { adminApi, type AutomationEntry } from "../../services/api";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

const automations = ref<AutomationEntry[]>([]);
const isSaving = ref(false);
const runningId = ref<string | null>(null);
const form = reactive({
  title: "",
  type: "INVOICE_REMINDER" as AutomationEntry["type"],
  schedule: "DAILY" as AutomationEntry["schedule"],
  enabled: true,
});

async function loadAutomations() {
  try {
    const { data } = await adminApi.getAutomations();
    automations.value = data.automations;
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to load automations.";
  }
}

async function createAutomation() {
  if (!form.title.trim()) return;
  isSaving.value = true;
  try {
    await adminApi.createAutomation(form);
    form.title = "";
    await loadAutomations();
    dashboard.success = "Automation created.";
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to create automation.";
  } finally {
    isSaving.value = false;
  }
}

async function runAutomation(id: string) {
  runningId.value = id;
  try {
    await adminApi.runAutomation(id);
    await loadAutomations();
    dashboard.success = "Automation executed.";
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to run automation.";
  } finally {
    runningId.value = null;
  }
}

onMounted(async () => {
  const ok = await dashboard.initialize(router, { skipDataLoad: true });
  if (!ok) return;
  await loadAutomations();
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.automations.title')"
    :subtitle="locale.t('dashboard.automations.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="loadAutomations"
    @logout="dashboard.logout(router)"
  >
    <article class="dashboard-card">
      <div class="flex items-center gap-3">
        <ClipboardList class="h-5 w-5 text-teal-300" />
        <p class="text-sm text-slate-300">{{ locale.t("dashboard.automations.helper") }}</p>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-[1fr_200px_200px]">
        <input v-model="form.title" class="dashboard-input" :placeholder="locale.t('dashboard.automations.titlePlaceholder')" />
        <select v-model="form.type" class="dashboard-input">
          <option value="INVOICE_REMINDER">{{ locale.t("dashboard.automations.invoice") }}</option>
          <option value="INVENTORY_CHECK">{{ locale.t("dashboard.automations.inventory") }}</option>
          <option value="FOLLOW_UP">{{ locale.t("dashboard.automations.followup") }}</option>
          <option value="OTHER">{{ locale.t("dashboard.automations.other") }}</option>
        </select>
        <select v-model="form.schedule" class="dashboard-input">
          <option value="DAILY">{{ locale.t("dashboard.automations.daily") }}</option>
          <option value="WEEKLY">{{ locale.t("dashboard.automations.weekly") }}</option>
          <option value="MONTHLY">{{ locale.t("dashboard.automations.monthly") }}</option>
          <option value="MANUAL">{{ locale.t("dashboard.automations.manual") }}</option>
        </select>
      </div>
      <button class="dashboard-button-primary mt-3" :disabled="isSaving" @click="createAutomation">
        <LoaderCircle v-if="isSaving" class="h-4 w-4 animate-spin" />
        {{ locale.t("dashboard.automations.create") }}
      </button>
    </article>

    <section class="mt-4 grid gap-3">
      <article v-for="item in automations" :key="item.id" class="dashboard-subcard">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-white">{{ item.title }}</p>
            <p class="mt-1 text-xs text-slate-400">{{ item.type }} · {{ item.schedule }}</p>
          </div>
          <button
            class="dashboard-button-secondary rounded-full px-3 py-1"
            :disabled="runningId === item.id"
            @click="runAutomation(item.id)"
          >
            <LoaderCircle v-if="runningId === item.id" class="h-3.5 w-3.5 animate-spin" />
            <Play v-else class="h-3.5 w-3.5" />
            {{ locale.t("dashboard.automations.runNow") }}
          </button>
        </div>
        <p class="mt-2 text-xs text-slate-400">{{ locale.t("dashboard.automations.lastRun") }}: {{ item.lastRunAt ? dashboard.formatDate(item.lastRunAt) : locale.t("dashboard.automations.never") }}</p>
      </article>
    </section>
  </DashboardFrame>
</template>
