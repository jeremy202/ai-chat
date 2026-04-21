<script setup lang="ts">
import { Globe, LoaderCircle } from "lucide-vue-next";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { adminApi } from "../../services/api";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();
const saving = ref(false);

const form = reactive({
  defaultLanguage: "en-CA" as "en-CA" | "fr-CA",
  additionalLanguages: "fr-CA",
  province: "ON",
  timezone: "America/Toronto",
  currency: "CAD" as "CAD",
});

async function loadRegional() {
  try {
    const { data } = await adminApi.getRegionalSettings();
    form.defaultLanguage = data.settings.defaultLanguage;
    form.additionalLanguages = data.settings.additionalLanguages.join(", ");
    form.province = data.settings.province;
    form.timezone = data.settings.timezone;
    form.currency = data.settings.currency;
    locale.applyLocale(data.settings.defaultLanguage);
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to load regional settings.";
  }
}

async function saveRegional() {
  saving.value = true;
  try {
    await adminApi.updateRegionalSettings({
      defaultLanguage: form.defaultLanguage,
      additionalLanguages: form.additionalLanguages
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      province: form.province,
      timezone: form.timezone,
      currency: "CAD",
    });
    locale.applyLocale(form.defaultLanguage);
    dashboard.success = "Regional settings updated.";
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to update regional settings.";
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const ok = await dashboard.initialize(router);
  if (!ok) return;
  await loadRegional();
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.regional.title')"
    :subtitle="locale.t('dashboard.regional.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="loadRegional"
    @logout="dashboard.logout(router)"
  >
    <article class="dashboard-card">
      <div class="flex items-center gap-3">
        <Globe class="h-5 w-5 text-teal-300" />
        <p class="text-sm text-slate-300">{{ locale.t("dashboard.regional.helper") }}</p>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <select v-model="form.defaultLanguage" class="dashboard-input">
          <option value="en-CA">English (Canada)</option>
          <option value="fr-CA">French (Canada)</option>
        </select>
        <input v-model="form.additionalLanguages" class="dashboard-input" :placeholder="locale.t('dashboard.regional.additional')" />
        <input v-model="form.province" class="dashboard-input" :placeholder="locale.t('dashboard.regional.province')" />
        <input v-model="form.timezone" class="dashboard-input" :placeholder="locale.t('dashboard.regional.timezone')" />
      </div>
      <button class="dashboard-button-primary mt-4" :disabled="saving" @click="saveRegional">
        <LoaderCircle v-if="saving" class="h-4 w-4 animate-spin" />
        {{ locale.t("dashboard.regional.save") }}
      </button>
    </article>
  </DashboardFrame>
</template>
