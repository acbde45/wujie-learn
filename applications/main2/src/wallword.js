import { Sandbox } from "./sandbox";
import { appRouteParse } from "./utils";

/**
 * 缓存创建过的wallworld实例
 */
export const wallworldCache = new Map();

/**
 * 用于管理沙盒的激活和失活
 */
export class Wallworld {
  constructor({ name, url }) {
    this.id = name;
    this.url = url;
    this.mainHostPath = window.location.protocol + "//" + window.location.host;
    const { appHostPath, appRoutePath } = appRouteParse(url);
    this.appHostPath = appHostPath;
    this.appRoutePath = appRoutePath;
    this.sandbox = new Sandbox(this, this.mainHostPath, this.appHostPath, this.appRoutePath);
    importHtml(name, url).then(({ scripts }) => {
      this.sandbox.iframeReady.then(() => {
        // 逐个插入scripts标签到head中
        scripts.forEach(({ src }) => {
          const scriptTag = document.createElement("script");
          scriptTag.src = new URL(src, appHostPath).toString();
          scriptTag.setAttribute('type', 'module');
          this.sandbox.iframe.contentDocument.head.appendChild(scriptTag);
        });
      });
    });
  }

  active() {
  }

  inactive() {
  }

  async mount() {
    const iframeWindow = this.sandbox.iframe.contentWindow;
    if (iframeWindow.__WALLWORLD_MOUNT) {
      await this.sandbox.iframeReady;
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
      this.head = headTag;
      iframeWindow.__WALLWORLD_MOUNT(appTag);
    }
  }
}

/**
 * 分析html，获取外链的js
 */
function importHtml(name, url) {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  fetch(url)
    .then((res) => {
      // 判断状态是否大于400，如果大于400，认为是失败，返回空字符串，并给出警告
      if (res.status >= 400) {
        console.warn(`获取子应用${name}失败`, res);
        return;
      }
      return res.text();
    })
    .catch((err) => {
      console.warn(`获取子应用${name}失败`, err);
    })
    .then((html) => {
      if (!html) {
        resolve({ scripts: [] });
        return;
      }
      // 从html中获取所有的script标签
      const scriptReg = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
      const scriptList = html.match(scriptReg);
      // 从script标签集合中逐个获取src属性
      const srcReg = /src=[\'\"]?([^\'\"]*)[\'\"]?/i;
      const srcList = scriptList.map((script) => {
        const src = script.match(srcReg);
        return src && src[1];
      });
      resolve({ scripts: srcList.map((src) => ({ src })) });
    });
  return promise;
}
