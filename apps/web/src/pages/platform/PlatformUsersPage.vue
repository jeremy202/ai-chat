<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { setAuthToken, platformApi, type PlatformManagedUser, type UserRole } from "../../services/api";
import PlatformShell from "../../components/platform/PlatformShell.vue";
import { useAuthStore } from "../../stores/auth";
import { useRouter } from "vue-router";

const router = useRouter();
const authStore = useAuthStore();
const users = ref<PlatformManagedUser[]>([]);
const loading = ref(false);
const error = ref("");
const query = ref("");
const createForm = reactive({
  businessId: "",
  name: "",
  email: "",
  password: "",
  role: "ADMIN" as UserRole,
});

async function loadUsers() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await platformApi.getUsers(query.value);
    users.value = data.users;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to load platform users.";
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  try {
    await platformApi.createUser(createForm);
    createForm.name = "";
    createForm.email = "";
    createForm.password = "";
    await loadUsers();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to create user.";
  }
}

async function toggleActive(user: PlatformManagedUser) {
  try {
    await platformApi.updateUser(user.id, { active: !user.active });
    await loadUsers();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to update user state.";
  }
}

async function changeRole(user: PlatformManagedUser, role: UserRole) {
  try {
    await platformApi.updateUser(user.id, { role });
    await loadUsers();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to update user role.";
  }
}

function onRoleSelectionChange(user: PlatformManagedUser, event: Event) {
  const value = (event.target as HTMLSelectElement).value as UserRole;
  void changeRole(user, value);
}

async function impersonate(user: PlatformManagedUser) {
  try {
    const { data } = await platformApi.impersonate(user.id);
    authStore.setSession(data);
    setAuthToken(data.token);
    await router.push("/dashboard");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to impersonate user.";
  }
}

onMounted(loadUsers);
</script>

<template>
  <PlatformShell title="Users" subtitle="Manage tenant users, status, roles, and impersonation.">
    <p v-if="error" class="mb-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{{ error }}</p>
    <article class="dashboard-card p-4">
      <div class="grid gap-2 md:grid-cols-[1fr_auto]">
        <input v-model="query" class="dashboard-input" placeholder="Search users by name or email" />
        <button class="dashboard-button-secondary" @click="loadUsers">{{ loading ? "Loading..." : "Search" }}</button>
      </div>
      <div class="mt-3 grid gap-2 md:grid-cols-5">
        <input v-model="createForm.businessId" class="dashboard-input" placeholder="Business ID" />
        <input v-model="createForm.name" class="dashboard-input" placeholder="Name" />
        <input v-model="createForm.email" class="dashboard-input" placeholder="Email" />
        <input v-model="createForm.password" class="dashboard-input" placeholder="Password" />
        <select v-model="createForm.role" class="dashboard-input">
          <option value="OWNER">OWNER</option>
          <option value="ADMIN">ADMIN</option>
          <option value="AGENT">AGENT</option>
        </select>
      </div>
      <button class="dashboard-button-primary mt-3" @click="createUser">Create user</button>
    </article>

    <section class="mt-4 grid gap-3">
      <article v-for="user in users" :key="user.id" class="dashboard-subcard p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="font-semibold text-white">{{ user.name }} ({{ user.role }})</p>
            <p class="text-xs text-slate-400">{{ user.email }} · {{ user.business.name }} ({{ user.business.status }})</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <select class="dashboard-input py-1.5" :value="user.role" @change="onRoleSelectionChange(user, $event)">
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="AGENT">AGENT</option>
            </select>
            <button class="dashboard-button-secondary" @click="toggleActive(user)">{{ user.active ? "Deactivate" : "Activate" }}</button>
            <button class="dashboard-button-primary" @click="impersonate(user)">Impersonate</button>
          </div>
        </div>
      </article>
    </section>
  </PlatformShell>
</template>
