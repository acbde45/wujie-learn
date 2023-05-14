import { createApp } from "vue";
import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import App from "./App.vue";
import { defineWallworldWebComponent } from "./wallworld";
import EmptyLayout from "./components/EmptyLayout.vue";

// 注册微前端管理组件
defineWallworldWebComponent();

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
  .use(createRouter({ history: createWebHistory(), routes }))
  .mount("#app");
