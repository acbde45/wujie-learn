import { Plugin, createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import Wujie from "./wujie-vue3";

createApp(App)
  .use(Wujie as unknown as Plugin)
  .mount("#app");
