import { wallworldCache, Wallworld } from "./wallword";

/**
 * 定义一个web-component，开启shadow dom，并在connectCallback中装载wallworld，disconnectCallback中卸载wallworld
 */
function defineWallworldWebComponent() {
  // 判断是否已经定义过wallworld-web-component
  const customElements = window.customElements;
  if (customElements?.get("wallworld-app")) {
    return; 
  }
  // 定义wallworld-web-component
  class WallworldApp extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
       // 创建head元素用于插入子应用style标签，创建div让子应用挂载
       const shadowRoot = this.shadowRoot;
       const htmlTag = document.createElement("html");
       const headTag = document.createElement("head");
       const bodyTag = document.createElement("body");
       const appTag = document.createElement("div");
       appTag.setAttribute("id", "app");
       htmlTag.appendChild(headTag);
       htmlTag.appendChild(bodyTag);
       bodyTag.appendChild(appTag);
       shadowRoot.appendChild(htmlTag);
       shadowRoot.head = headTag;
       shadowRoot.body = bodyTag;
       shadowRoot.app = appTag;
    }
    connectedCallback() {
      // 获取元素attrs
      const attrs = this.attributes;
      // 从attrs中取出name、url
      const name = attrs?.name?.value;
      const url = attrs?.url?.value;
      // 判断沙盒有没有创建过，如果创建过，直接激活沙盒
      if (wallworldCache.has(name)) {
        wallworldCache.get(name).active();
        return;
      }
      // 创建沙盒
      this.walloword = new Wallworld({ name, url });
      this.walloword.shadowRoot = this.shadowRoot;
      // 激活沙盒
      this.walloword.active();
      // 缓存沙盒
      wallworldCache.set(name, this.walloword);
    }
    disconnectedCallback() {
      // 沙盒失活
      this.walloword.inactive();
    }
  }
  // 注册wallworld-app
  customElements.define("wallworld-app", WallworldApp);
}

defineWallworldWebComponent();
