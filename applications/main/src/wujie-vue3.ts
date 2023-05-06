// @ts-nocheck
import { startApp as rawStartApp, destroyApp } from "./bunskin";
import { h, defineComponent } from "vue";

const wujieVueOptions = {
  name: "WujieVue",
  props: {
    width: { type: String, default: "" },
    height: { type: String, default: "" },
    name: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  data() {
    return {
      startAppQueue: Promise.resolve(),
    };
  },
  mounted() {
    this.execStartApp();
    this.$watch(
      () => this.name + this.url,
      () => this.execStartApp()
    );
  },
  methods: {
    handleEmit(event: string, ...args: any[]) {
      this.$emit(event, ...args);
    },
    async startApp() {
      try {
        await rawStartApp({
          name: this.name,
          url: this.url,
          el: this.$refs.wujie,
        });
      } catch (error) {
        console.log(error);
      }
    },
    execStartApp() {
      this.startAppQueue = this.startAppQueue.then(this.startApp);
    },
    destroy() {
      destroyApp(this.name);
    },
  },
  render() {
    return h("div", {
      style: {
        width: this.width,
        height: this.height,
      },
      ref: "wujie",
    });
  },
};

const WujieVue = defineComponent(wujieVueOptions);

WujieVue.install = function (app) {
  app.component("WujieVue", WujieVue);
};

export default WujieVue;
