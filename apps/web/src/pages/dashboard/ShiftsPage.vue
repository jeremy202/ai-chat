<script setup lang="ts">
import { LoaderCircle, Users } from "lucide-vue-next";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { adminApi, type EmployeeEntry, type ShiftEntry } from "../../services/api";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

const shifts = ref<ShiftEntry[]>([]);
const employees = ref<EmployeeEntry[]>([]);
const isSaving = ref(false);
const form = reactive({
  teamMember: "",
  role: "",
  start: "",
  end: "",
  notes: "",
});

async function loadShifts() {
  try {
    const { data } = await adminApi.getShifts();
    shifts.value = data.shifts;
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to load shifts.";
  }
}

async function loadEmployees() {
  try {
    const { data } = await adminApi.getEmployees();
    employees.value = data.employees.filter((employee) => employee.active);
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to load employees.";
  }
}

async function createShift() {
  if (!form.teamMember || !form.role || !form.start || !form.end) return;
  if (new Date(form.end).getTime() <= new Date(form.start).getTime()) {
    dashboard.error = "Shift end time must be after start time.";
    return;
  }
  isSaving.value = true;
  try {
    await adminApi.createShift({
      teamMember: form.teamMember,
      role: form.role,
      start: new Date(form.start).toISOString(),
      end: new Date(form.end).toISOString(),
      notes: form.notes || undefined,
    });
    form.teamMember = "";
    form.role = "";
    form.start = "";
    form.end = "";
    form.notes = "";
    await loadShifts();
    dashboard.success = "Shift added.";
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to create shift.";
  } finally {
    isSaving.value = false;
  }
}

function onTeamMemberChange() {
  const selected = employees.value.find((employee) => employee.fullName === form.teamMember);
  if (!selected) return;
  const primaryRole = selected.roles[0];
  if (primaryRole) {
    form.role = primaryRole;
  }
}

onMounted(async () => {
  const ok = await dashboard.initialize(router);
  if (!ok) return;
  await Promise.all([loadShifts(), loadEmployees()]);
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.shifts.title')"
    :subtitle="locale.t('dashboard.shifts.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="loadShifts"
    @logout="dashboard.logout(router)"
  >
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-center gap-3">
        <Users class="h-5 w-5 text-teal-300" />
        <p class="text-sm text-slate-300">{{ locale.t("dashboard.shifts.helper") }}</p>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <select
          v-model="form.teamMember"
          class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
          @change="onTeamMemberChange"
        >
          <option value="" disabled>{{ locale.t("dashboard.shifts.teamMember") }}</option>
          <option v-for="employee in employees" :key="employee.id" :value="employee.fullName">
            {{ employee.fullName }}
          </option>
        </select>
        <input v-model="form.role" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" :placeholder="locale.t('dashboard.shifts.role')" />
        <input v-model="form.start" type="datetime-local" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input v-model="form.end" type="datetime-local" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>
      <textarea v-model="form.notes" rows="2" class="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" :placeholder="locale.t('dashboard.shifts.notes')" />
      <button class="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400" :disabled="isSaving" @click="createShift">
        <LoaderCircle v-if="isSaving" class="h-4 w-4 animate-spin" />
        {{ locale.t("dashboard.shifts.add") }}
      </button>
    </article>

    <section class="mt-4 grid gap-3">
      <article v-for="shift in shifts" :key="shift.id" class="rounded-xl border border-white/10 bg-white/5 p-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-white">{{ shift.teamMember }} — {{ shift.role }}</p>
          <p class="text-xs text-slate-400">{{ dashboard.formatDate(shift.start) }}</p>
        </div>
        <p class="mt-1 text-xs text-slate-300">
          {{ new Date(shift.start).toLocaleString() }} -> {{ new Date(shift.end).toLocaleString() }}
        </p>
        <p v-if="shift.notes" class="mt-2 text-xs text-slate-400">{{ shift.notes }}</p>
      </article>
    </section>
  </DashboardFrame>
</template>
