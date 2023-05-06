import { iframeGenerator, insertScriptToIframe } from "./iframe";
import { proxyGenerator } from "./proxy";
import { appRouteParse, isFunction, eventTrigger } from "./utils";
import { idToSandboxCacheMap, addSandboxCacheWithWujie, rawDocumentQuerySelector } from "./common";
import { syncUrlToIframe, syncUrlToWindow } from "./sync";
import { renderElementToContainer, createWujieWebComponent, renderTemplateToShadowRoot } from './shadow';

export class WuJie {
  async active(options) {
    const { url, el } = options;
    this.url = url;
    this.hrefFlag = false;
    this.activeFlag = true;
    // wait iframe init
    await this.iframeReady;
    const iframeWindow = this.iframe.contentWindow;
    iframeWindow.fetch = fetch;
    this.fetch = fetch;

    // 处理子应用路由同步
    if (this.execFlag) {
      // 当保活模式下子应用重新激活时，只需要将子应用路径同步回主应用
      syncUrlToWindow(iframeWindow);
    } else {
      // 先将url同步回iframe，然后再同步回浏览器url
      syncUrlToIframe(iframeWindow);
      syncUrlToWindow(iframeWindow);
    }
    if (this.shadowRoot) {
      /*
       document.addEventListener was transfer to shadowRoot.addEventListener
       react 16 SyntheticEvent will remember document event for avoid repeat listen
       shadowRoot have to dispatchEvent for react 16 so can't be destroyed
       this may lead memory leak risk
       */
      this.el = renderElementToContainer(this.shadowRoot.host, el);
    } else {
      // 预执行无容器，暂时插入iframe内部触发Web Component的connect
      const iframeBody = rawDocumentQuerySelector.call(iframeWindow.document, "body");
      this.el = renderElementToContainer(createWujieWebComponent(this.id), el ?? iframeBody);
    }

    await renderTemplateToShadowRoot(this.shadowRoot, iframeWindow);
    // inject shadowRoot to app
    this.provide.shadowRoot = this.shadowRoot;
  }

  async start(getExternalScripts) {
    this.execFlag = true;
    // 执行脚本
    const scriptResultList = await getExternalScripts();
    // 假如已经被销毁了
    if (!this.iframe) return;
    const iframeWindow = this.iframe.contentWindow;
    // 标志位，执行代码前设置
    iframeWindow.__POWERED_BY_WUJIE__ = true;
    // 同步代码
    const syncScriptResultList = [];
    // async代码无需保证顺序，所以不用放入执行队列
    const asyncScriptResultList = [];
    // defer代码需要保证顺序并且DOMContentLoaded前完成，这里统一放置同步脚本后执行
    const deferScriptResultList = [];
    scriptResultList.forEach((scriptResult) => {
      if (scriptResult.defer) deferScriptResultList.push(scriptResult);
      else if (scriptResult.async) asyncScriptResultList.push(scriptResult);
      else syncScriptResultList.push(scriptResult);
    });

    // 同步代码
    syncScriptResultList.concat(deferScriptResultList).forEach((scriptResult) => {
      this.execQueue.push(() =>
        scriptResult.contentPromise.then((content) =>
          this.fiber
            ? requestIdleCallback(() => insertScriptToIframe({ ...scriptResult, content }, iframeWindow))
            : insertScriptToIframe({ ...scriptResult, content }, iframeWindow)
        )
      );
    });

    // 异步代码
    asyncScriptResultList.forEach((scriptResult) => {
      scriptResult.contentPromise.then((content) => {
        this.fiber
          ? requestIdleCallback(() => insertScriptToIframe({ ...scriptResult, content }, iframeWindow))
          : insertScriptToIframe({ ...scriptResult, content }, iframeWindow);
      });
    });

    //框架主动调用mount方法
    this.execQueue.push(this.fiber ? () => requestIdleCallback(() => this.mount()) : () => this.mount());

    //触发 DOMContentLoaded 事件
    const domContentLoadedTrigger = () => {
      eventTrigger(iframeWindow.document, "DOMContentLoaded");
      eventTrigger(iframeWindow, "DOMContentLoaded");
      this.execQueue.shift()?.();
    };
    this.execQueue.push(this.fiber ? () => requestIdleCallback(domContentLoadedTrigger) : domContentLoadedTrigger);

    //触发 loaded 事件
    const domLoadedTrigger = () => {
      eventTrigger(iframeWindow.document, "readystatechange");
      eventTrigger(iframeWindow, "load");
      this.execQueue.shift()?.();
    };
    this.execQueue.push(this.fiber ? () => requestIdleCallback(domLoadedTrigger) : domLoadedTrigger);
    this.execQueue.shift()();

    // 所有的execQueue队列执行完毕，start才算结束，保证串行的执行子应用
    return new Promise((resolve) => {
      this.execQueue.push(() => {
        resolve();
        this.execQueue.shift()?.();
      });
    });
  }

  /**
   * 框架主动发起mount，如果子应用是异步渲染实例，比如将生命周__WUJIE_MOUNT放到async函数内
   * 此时如果采用fiber模式渲染（主应用调用mount的时机也是异步不确定的），框架调用mount时可能
   * 子应用的__WUJIE_MOUNT还没有挂载到window，所以这里封装一个mount函数，当子应用是异步渲染
   * 实例时，子应用异步函数里面最后加上window.__WUJIE.mount()来主动调用
   */
  mount() {
    if (this.mountFlag) return;
    if (isFunction(this.iframe.contentWindow.__WUJIE_MOUNT)) {
      this.iframe.contentWindow.__WUJIE_MOUNT();
      this.mountFlag = true;
    }
    if (this.alive) {
      this.lifecycles?.activated?.(this.iframe.contentWindow);
    }
    this.execQueue.shift()?.();
  }

  unmount() {
    this.activeFlag = false;
    // 清理子应用过期的同步参数
    clearInactiveAppUrl();
    if (!this.mountFlag) return;
    if (isFunction(this.iframe.contentWindow.__WUJIE_UNMOUNT) && !this.hrefFlag) {
      this.iframe.contentWindow.__WUJIE_UNMOUNT();
      this.mountFlag = false;
      clearChild(this.shadowRoot);
      // head body需要复用，每次都要清空事件
      removeEventListener(this.head);
      removeEventListener(this.body);
      clearChild(this.head);
      clearChild(this.body);
    }
  }

  destroy() {
    this.shadowRoot = null;
    this.proxy = null;
    this.proxyDocument = null;
    this.proxyLocation = null;
    this.execQueue = null;
    this.provide = null;
    this.execFlag = null;
    this.mountFlag = null;
    this.hrefFlag = null;
    this.document = null;
    this.head = null;
    this.body = null;
    this.elementEventCacheMap = null;
    this.provide = null;
    this.inject = null;
    this.execQueue = null;
    // 清除 dom
    if (this.el) {
      clearChild(this.el);
      this.el = null;
    }
    // 清除 iframe 沙箱
    if (this.iframe) {
      this.iframe.parentNode?.removeChild(this.iframe);
    }
    deleteWujieById(this.id);
  }

  constructor(options) {
    // 传递inject给嵌套子应用
    if (window.__POWERED_BY_WUJIE__) this.inject = window.__WUJIE.inject;
    else {
      this.inject = {
        idToSandboxMap: idToSandboxCacheMap,
        mainHostPath: window.location.protocol + "//" + window.location.host,
      };
    }
    const { name, url } = options;
    this.id = name;
    this.url = url;
    this.provide = {};
    this.execQueue = [];
    // 创建目标地址的解析
    const { urlElement, appHostPath, appRoutePath } = appRouteParse(url);
    const { mainHostPath } = this.inject;
    // 创建iframe
    this.iframe = iframeGenerator(this, mainHostPath, appHostPath, appRoutePath);
    const { proxyWindow, proxyDocument, proxyLocation } = proxyGenerator(
      this.iframe,
      urlElement,
      mainHostPath,
      appHostPath
    );
    this.proxy = proxyWindow;
    this.proxyDocument = proxyDocument;
    this.proxyLocation = proxyLocation;
    this.provide.location = this.proxyLocation;

    addSandboxCacheWithWujie(this.id, this);
  }
}
