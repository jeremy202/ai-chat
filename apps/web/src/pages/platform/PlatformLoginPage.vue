<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { platformApi } from "../../services/api";
import { useSuperadminStore } from "../../stores/superadmin";

const router = useRouter();
const superadmin = useSuperadminStore();
const form = reactive({
  email: "",
  password: "",
});
const loading = ref(false);
const error = ref("");

async function submit() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await platformApi.login(form);
    superadmin.setSession(data);
    await router.push("/platform");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to login as superadmin.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="app-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
    <section class="glass-card w-full max-w-lg p-8">
      <p class="text-sm font-semibold uppercase tracking-[0.25em] text-teal-300">Platform</p>
      <h1 class="mt-3 text-3xl font-semibold text-white">Superadmin Login</h1>
      <p class="mt-2 text-sm text-slate-300">
        Use your seeded superadmin credentials. If this is your first setup, add
        <code class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">SUPERADMIN_SEED_EMAIL</code> and
        <code class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">SUPERADMIN_SEED_PASSWORD</code>
        in API env, then restart backend once.
      </p>
      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <input v-model="form.email" class="input-field" type="email" placeholder="admin@company.com" />
        <input v-model="form.password" class="input-field" type="password" placeholder="Password" />
        <p v-if="error" class="rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{{ error }}</p>
        <button class="pill-button w-full bg-linear-to-r from-teal-500 to-emerald-500 py-3 text-white" :disabled="loading" type="submit">
          {{ loading ? "Signing in..." : "Sign in" }}
        </button>
      </form>
      <div class="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">After login</p>
        <ul class="mt-2 space-y-1 text-sm text-slate-300">
          <li>- Manage users and roles from <code class="text-xs text-slate-200">/platform/users</code></li>
          <li>- Suspend/activate tenants from <code class="text-xs text-slate-200">/platform/businesses</code></li>
          <li>- Use impersonation for support troubleshooting</li>
        </ul>
      </div>
    </section>
  </div>
</template>
