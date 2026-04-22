<script setup lang="ts">
import { LoaderCircle, UserRoundPlus, WandSparkles } from "lucide-vue-next";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { adminApi, type EmployeeEntry } from "../../services/api";

const router = useRouter();
const dashboard = useDashboardOps();

const employees = ref<EmployeeEntry[]>([]);
const loadingEmployees = ref(false);
const savingEmployee = ref(false);
const assigningShift = ref(false);
const assignmentResult = ref("");

const employeeForm = reactive({
  fullName: "",
  email: "",
  phone: "",
  rolesInput: "",
  availabilityInput: "",
  maxHoursPerWeek: "",
  notes: "",
});

const autoAssignForm = reactive({
  role: "",
  start: "",
  end: "",
  notes: "",
});

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadEmployees() {
  loadingEmployees.value = true;
  try {
    const { data } = await adminApi.getEmployees();
    employees.value = data.employees;
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to load employees.";
  } finally {
    loadingEmployees.value = false;
  }
}

async function createEmployee() {
  if (!employeeForm.fullName.trim() || !employeeForm.rolesInput.trim()) return;
  savingEmployee.value = true;
  dashboard.error = "";
  dashboard.success = "";
  try {
    await adminApi.createEmployee({
      fullName: employeeForm.fullName.trim(),
      email: employeeForm.email.trim() || undefined,
      phone: employeeForm.phone.trim() || undefined,
      roles: parseCommaList(employeeForm.rolesInput),
      availability: parseCommaList(employeeForm.availabilityInput),
      maxHoursPerWeek: employeeForm.maxHoursPerWeek
        ? Number(employeeForm.maxHoursPerWeek)
        : undefined,
      notes: employeeForm.notes.trim() || undefined,
      active: true,
    });

    employeeForm.fullName = "";
    employeeForm.email = "";
    employeeForm.phone = "";
    employeeForm.rolesInput = "";
    employeeForm.availabilityInput = "";
    employeeForm.maxHoursPerWeek = "";
    employeeForm.notes = "";

    dashboard.success = "Employee saved.";
    await loadEmployees();
  } catch (error) {
    dashboard.error = error instanceof Error ? error.message : "Unable to save employee.";
  } finally {
    savingEmployee.value = false;
  }
}

async function autoAssignShift() {
  if (!autoAssignForm.role || !autoAssignForm.start || !autoAssignForm.end) return;
  assigningShift.value = true;
  dashboard.error = "";
  dashboard.success = "";
  assignmentResult.value = "";
  try {
    const { data } = await adminApi.autoAssignShift({
      role: autoAssignForm.role.trim(),
      start: new Date(autoAssignForm.start).toISOString(),
      end: new Date(autoAssignForm.end).toISOString(),
      notes: autoAssignForm.notes.trim() || undefined,
    });

    dashboard.success = `Shift auto-assigned to ${data.assignment.employeeName}.`;
    assignmentResult.value = `${data.assignment.reason} Confidence: ${Math.round(data.assignment.confidence * 100)}%.`;
    autoAssignForm.role = "";
    autoAssignForm.start = "";
    autoAssignForm.end = "";
    autoAssignForm.notes = "";
  } catch (error) {
    dashboard.error =
      error instanceof Error ? error.message : "Unable to auto-assign shift.";
  } finally {
    assigningShift.value = false;
  }
}

onMounted(async () => {
  const ok = await dashboard.initialize(router, { skipDataLoad: true });
  if (!ok) return;
  await loadEmployees();
});
</script>

<template>
  <DashboardFrame
    title="Employee Setup & AI Shift Assignment"
    subtitle="Input employee details so AI can assign the best person to each shift."
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="loadEmployees"
    @logout="dashboard.logout(router)"
  >
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-center gap-3">
        <UserRoundPlus class="h-5 w-5 text-teal-300" />
        <p class="text-sm text-slate-300">
          Add each employee with role, availability, and workload preferences.
        </p>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <input v-model="employeeForm.fullName" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Full name" />
        <input v-model="employeeForm.email" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Email (optional)" />
        <input v-model="employeeForm.phone" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Phone (optional)" />
        <input v-model="employeeForm.maxHoursPerWeek" type="number" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Max hours/week (optional)" />
      </div>
      <input
        v-model="employeeForm.rolesInput"
        class="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        placeholder="Roles (comma-separated, e.g. Front Desk, Concierge)"
      />
      <input
        v-model="employeeForm.availabilityInput"
        class="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        placeholder="Availability (comma-separated, e.g. Mon Morning, Tue Evening)"
      />
      <textarea
        v-model="employeeForm.notes"
        rows="2"
        class="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        placeholder="Notes (optional)"
      />
      <button
        class="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        :disabled="savingEmployee"
        @click="createEmployee"
      >
        <LoaderCircle v-if="savingEmployee" class="h-4 w-4 animate-spin" />
        Save Employee
      </button>
    </article>

    <article class="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-center gap-3">
        <WandSparkles class="h-5 w-5 text-teal-300" />
        <p class="text-sm text-slate-300">
          Ask AI to assign a shift automatically from your employee list.
        </p>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <input v-model="autoAssignForm.role" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Role to assign" />
        <input v-model="autoAssignForm.start" type="datetime-local" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input v-model="autoAssignForm.end" type="datetime-local" class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>
      <textarea
        v-model="autoAssignForm.notes"
        rows="2"
        class="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        placeholder="Shift notes (optional)"
      />
      <button
        class="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        :disabled="assigningShift"
        @click="autoAssignShift"
      >
        <LoaderCircle v-if="assigningShift" class="h-4 w-4 animate-spin" />
        Auto-Assign Shift
      </button>
      <p v-if="assignmentResult" class="mt-3 text-xs text-teal-200">{{ assignmentResult }}</p>
    </article>

    <section class="mt-4 grid gap-3">
      <div v-if="loadingEmployees" class="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        Loading employees...
      </div>
      <article v-for="employee in employees" :key="employee.id" class="rounded-xl border border-white/10 bg-white/5 p-4">
        <div class="flex items-center justify-between gap-4">
          <p class="text-sm font-semibold text-white">{{ employee.fullName }}</p>
          <p class="text-xs text-slate-400">
            {{ employee.maxHoursPerWeek ? `${employee.maxHoursPerWeek}h/week` : "No weekly cap" }}
          </p>
        </div>
        <p class="mt-1 text-xs text-slate-300">Roles: {{ employee.roles.join(", ") }}</p>
        <p class="mt-1 text-xs text-slate-300">
          Availability: {{ employee.availability.length ? employee.availability.join(", ") : "Not set" }}
        </p>
      </article>
    </section>
  </DashboardFrame>
</template>
