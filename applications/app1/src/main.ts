import { createApp } from "vue";
import { RouteRecordRaw, createRouter, createWebHistory, RouteLocationNormalizedLoaded, Router } from "vue-router";
import App from "./App.vue";

declare global {
  interface Window {
    // 是否存在无界
    __POWERED_BY_WUJIE__?: boolean;
    // 子应用mount函数
    __WUJIE_MOUNT: () => void;
    // 子应用unmount函数
    __WUJIE_UNMOUNT: () => void;
    // 子应用无界实例
    __WUJIE: { mount: () => void; el: HTMLElement };
    // 子应用沙盒
    $wujie: { props: { route: RouteLocationNormalizedLoaded, router: Router } };
  }

  interface Window {
    // 是否存在父应用
    __POWERED_BY_WALLWORLD__?: boolean;
    // 子应用mount函数
    __WALLWORLD_MOUNT: (el: HTMLElement) => void;
    // 子应用unmount函数
    __WALLWORLD_UNMOUNT: () => void;
    // 子应用无界实例
    __WALLWORLD: { mount: () => void; el: HTMLElement };
    // 子应用沙盒
    $wallworld: { props: { route: RouteLocationNormalizedLoaded, router: Router } };
  }
}

const routes: RouteRecordRaw[] = [
  { path: "/feature1/list", component: () => import("./pages/feature1/list.vue") },
  { path: "/feature1/detail", component: () => import("./pages/feature1/detail.vue") },
];

if (window.__POWERED_BY_WUJIE__) {
  let instance: any;
  window.__WUJIE_MOUNT = () => {
    const router = createRouter({ history: createWebHistory(), routes });
    instance = createApp(App);
    instance.use(router);
    instance.mount("#app");
  };
  window.__WUJIE_UNMOUNT = () => {
    instance.unmount();
  };
  /*
    由于vite是异步加载，而无界可能采用fiber执行机制
    所以mount的调用时机无法确认，框架调用时可能vite
    还没有加载回来，这里采用主动调用防止用没有mount
    无界mount函数内置标记，不用担心重复mount
  */
  window.__WUJIE.mount();
} else if (window.__POWERED_BY_WALLWORLD__) {
  let instance: any;
  window.__WALLWORLD_MOUNT = (el) => {
    const router = createRouter({ history: createWebHistory(), routes });
    instance = createApp(App);
    instance.use(router);
    instance.mount(el);
  };
  window.__WALLWORLD_UNMOUNT = () => {
    instance.unmount();
  };
  /*
    由于vite是异步加载，而无界可能采用fiber执行机制
    所以mount的调用时机无法确认，框架调用时可能vite
    还没有加载回来，这里采用主动调用防止用没有mount
    无界mount函数内置标记，不用担心重复mount
  */
  window.__WALLWORLD.mount();
} else {
  createApp(App)
    .use(createRouter({ history: createWebHistory(), routes }))
    .mount("#app");
}
