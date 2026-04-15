import { createRouter, createWebHistory } from "vue-router";
import DashboardPage from "@/pages/DashboardPage.vue";
import HomePage from "@/pages/HomePage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import SignupPage from "@/pages/SignupPage.vue";
import WidgetEmbedPage from "@/pages/WidgetEmbedPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage,
    },
    {
      path: "/login",
      name: "login",
      component: LoginPage,
    },
    {
      path: "/signup",
      name: "signup",
      component: SignupPage,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/widget/:slug",
      name: "widget",
      component: WidgetEmbedPage,
    },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }

  const token = localStorage.getItem("ai-concierge-token");
  if (!token) {
    return { name: "login" };
  }

  return true;
});

export default router;
