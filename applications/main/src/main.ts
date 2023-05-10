import { Plugin, createApp } from "vue";
import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import App from "./App.vue";
import Wujie from "./wujie-vue3";
import EmptyLayout from "./components/EmptyLayout.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/main/feature1/list" },
  {
    path: "/main",
    component: EmptyLayout,
    children: [
      {
        path: "feature1",
        component: EmptyLayout,
        children: [
          { path: "list", component: () => import("./pages/feature1/list.vue") },
          { path: "detail", component: () => import("./pages/feature1/detail.vue") },
        ],
      },
    ],
  },
  {
    path: "/app1/:path*",
    component: () => import("./pages/app1/index.vue"),
  },
];

createApp(App)
  .use(Wujie as unknown as Plugin)
  .use(createRouter({ history: createWebHistory(), routes }))
  .mount("#app");
