import {
  windowProxyProperties,
  windowRegWhiteList,
  appWindowOnEvent,
  appDocumentAddEventListenerEvents,
  appDocumentOnEvents,
  mainDocumentAddEventListenerEvents,
  mainAndAppAddEventListenerEvents,
  documentProxyProperties,
  appWindowAddEventListenerEvents,
} from "./constant";
import {
  rawAddEventListener,
  rawRemoveEventListener,
  rawWindowAddEventListener,
  rawWindowRemoveEventListener,
  rawAppendChild,
  rawDocumentQuerySelector,
} from "./common";
import { isConstructable } from './proxy';
import { warn, getAbsolutePath, anchorElementGenerator } from "../utils";


/**
 * 往iframe的window对象里注入全局变量
 */
function injectGlobalVarsToWindow(iframeWindow, wallworld) {
  iframeWindow.__POWERED_BY_WALLWORLD__ = true;
  iframeWindow.__WALLWORLD = wallworld;
  iframeWindow.__WALLWORLD_RAW_WINDOW__ = iframeWindow;
}

export function iframeGenerator(sandbox, mainHostPath, appHostPath, appRoutePath) {
  const iframe = window.document.createElement("iframe");
  const attrs = { src: mainHostPath, name: sandbox.wallworld.id, style: "display:none" };
  for (let key in attrs) {
    iframe.setAttribute(key, attrs[key]);
  }
  window.document.body.appendChild(iframe);
  const iframeWindow = iframe.contentWindow;
  injectGlobalVarsToWindow(iframeWindow, sandbox.wallworld);
  // iframe准备完成需要在处理副作用之后
  let resolve;
  sandbox.iframeReady = new Promise((r) => (resolve = r));
  stopIframeLoading(iframeWindow).then(() => {
    if (!iframeWindow.__POWERED_BY_WALLWORLD__) {
      injectGlobalVarsToWindow(iframeWindow, sandbox.wallworld);
    }
    const iframeDocument = iframeWindow.document;
    const newDoc = window.document.implementation.createHTMLDocument("");
    const newDocumentElement = iframeDocument.importNode(newDoc.documentElement, true);
    iframeDocument.documentElement
      ? iframeDocument.replaceChild(newDocumentElement, iframeDocument.documentElement)
      : iframeDocument.appendChild(newDocumentElement);
    const baseElement = iframeDocument.createElement("base");
    baseElement.setAttribute("href", appHostPath + appRoutePath);
    iframeDocument.head.appendChild(baseElement);
    // 保存原始的方法
    iframeWindow.__WALLWORLD_RAW_DOCUMENT_HEAD__ = iframeDocument.head;
    iframeWindow.__WALLWORLD_RAW_DOCUMENT_QUERY_SELECTOR__ = iframeWindow.Document.prototype.querySelector;
    iframeWindow.__WALLWORLD_RAW_DOCUMENT_QUERY_SELECTOR_ALL__ = iframeWindow.Document.prototype.querySelectorAll;
    iframeWindow.__WALLWORLD_RAW_DOCUMENT_CREATE_ELEMENT__ = iframeWindow.Document.prototype.createElement;
    iframeWindow.__WALLWORLD_RAW_DOCUMENT_CREATE_TEXT_NODE__ = iframeWindow.Document.prototype.createTextNode;
    // 处理iframe的副作用，指向shadowRoot
    patchIframeHistory(iframeWindow, appHostPath, mainHostPath);
    patchIframeEvents(iframeWindow);
    syncIframeUrlToWindow(iframeWindow, mainHostPath, appRoutePath);
    patchWindowEffect(iframeWindow);
    patchDocumentEffect(iframeWindow);
    patchNodeEffect(iframeWindow);
    patchRelativeUrlEffect(iframeWindow);
    // 同步父应用的路由
    iframeWindow.history.replaceState(null, "", mainHostPath + appRoutePath);
    window.history.replaceState(null, "", mainHostPath + appRoutePath);
    resolve();
  });
  return iframe;
}

/**
 * 劫持元素原型对相对地址的赋值转绝对地址
 * @param iframeWindow
 */
export function fixElementCtrSrcOrHref(iframeWindow, elementCtr, attr) {
  // patch setAttribute
  const rawElementSetAttribute = iframeWindow.Element.prototype.setAttribute;
  elementCtr.prototype.setAttribute = function (name, value) {
    let targetValue = value;
    if (name === attr) targetValue = getAbsolutePath(value, this.baseURI || "", true);
    rawElementSetAttribute.call(this, name, targetValue);
  };
  // patch href get and set
  const rawAnchorElementHrefDescriptor = Object.getOwnPropertyDescriptor(elementCtr.prototype, attr);
  const { enumerable, configurable, get, set } = rawAnchorElementHrefDescriptor;
  Object.defineProperty(elementCtr.prototype, attr, {
    enumerable,
    configurable,
    get: function () {
      return get.call(this);
    },
    set: function (href) {
      set.call(this, getAbsolutePath(href, this.baseURI, true));
    },
  });
  // TODO: innerHTML的处理
}

/**
 * 修复资源元素的相对路径问题
 * @param iframeWindow
 */
function patchRelativeUrlEffect(iframeWindow) {
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLImageElement, "src");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLAnchorElement, "href");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLSourceElement, "src");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLLinkElement, "href");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLScriptElement, "src");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLMediaElement, "src");
}

/**
 * patch Node effect
 * 1、处理 getRootNode
 * 2、处理 appendChild、insertBefore，当插入的节点为 svg 时，createElement 的 patch 会被去除，需要重新 patch
 * @param iframeWindow
 */
function patchNodeEffect(iframeWindow) {
  const rawGetRootNode = iframeWindow.Node.prototype.getRootNode;
  const rawAppendChild = iframeWindow.Node.prototype.appendChild;
  const rawInsertRule = iframeWindow.Node.prototype.insertBefore;
  iframeWindow.Node.prototype.getRootNode = function (options) {
    const rootNode = rawGetRootNode.call(this, options);
    if (rootNode === iframeWindow.__WALLWORLD.shadowRoot) return iframeWindow.document;
    else return rootNode;
  };
  iframeWindow.Node.prototype.appendChild = function (node) {
    const res = rawAppendChild.call(this, node);
    patchElementEffect(node, iframeWindow);
    return res;
  };
  iframeWindow.Node.prototype.insertBefore = function (node, child) {
    const res = rawInsertRule.call(this, node, child);
    patchElementEffect(node, iframeWindow);
    return res;
  };
}

/**
 * patch document effect
 * @param iframeWindow
 */
// TODO 继续改进
function patchDocumentEffect(iframeWindow) {
  const wallworld = iframeWindow.__WALLWORLD;
  const sandbox = wallworld.sandbox;

  /**
   * 处理 addEventListener和removeEventListener
   * 由于这个劫持导致 handler 的this发生改变，所以需要handler.bind(document)
   * 但是这样会导致removeEventListener无法正常工作，因为handler => handler.bind(document)
   * 这个地方保存callback = handler.bind(document) 方便removeEventListener
   */
  const handlerCallbackMap = new WeakMap();
  const handlerTypeMap = new WeakMap();
  iframeWindow.Document.prototype.addEventListener = function (type, handler, options) {
    let callback = handlerCallbackMap.get(handler);
    const typeList = handlerTypeMap.get(handler);
    // 设置 handlerCallbackMap
    if (!callback && handler) {
      callback = typeof handler === "function" ? handler.bind(this) : handler;
      handlerCallbackMap.set(handler, callback);
    }
    // 设置 handlerTypeMap
    if (typeList) {
      if (!typeList.includes(type)) typeList.push(type);
    } else {
      handlerTypeMap.set(handler, [type]);
    }

    if (appDocumentAddEventListenerEvents.includes(type)) {
      return rawAddEventListener.call(this, type, callback, options);
    }
    if (mainDocumentAddEventListenerEvents.includes(type))
      return window.document.addEventListener(type, callback, options);
    if (mainAndAppAddEventListenerEvents.includes(type)) {
      window.document.addEventListener(type, callback, options);
      wallworld.shadowRoot.addEventListener(type, callback, options);
      return;
    }
    wallworld.shadowRoot.addEventListener(type, callback, options);
  };
  iframeWindow.Document.prototype.removeEventListener = function (type, handler, options) {
    const callback = handlerCallbackMap.get(handler);
    const typeList = handlerTypeMap.get(handler);
    if (callback) {
      if (typeList?.includes(type)) {
        typeList.splice(typeList.indexOf(type), 1);
        if (!typeList.length) {
          handlerCallbackMap.delete(handler);
          handlerTypeMap.delete(handler);
        }
      }

      if (appDocumentAddEventListenerEvents.includes(type)) {
        return rawRemoveEventListener.call(this, type, callback, options);
      }
      if (mainDocumentAddEventListenerEvents.includes(type)) {
        return window.document.removeEventListener(type, callback, options);
      }
      if (mainAndAppAddEventListenerEvents.includes(type)) {
        window.document.removeEventListener(type, callback, options);
        wallworld.shadowRoot.removeEventListener(type, callback, options);
        return;
      }
      wallworld.shadowRoot.removeEventListener(type, callback, options);
    }
  };
  // 处理onEvent
  const elementOnEvents = Object.keys(iframeWindow.HTMLElement.prototype).filter((ele) => /^on/.test(ele));
  const documentOnEvent = Object.keys(iframeWindow.Document.prototype)
    .filter((ele) => /^on/.test(ele))
    .filter((ele) => !appDocumentOnEvents.includes(ele));
  elementOnEvents
    .filter((e) => documentOnEvent.includes(e))
    .forEach((e) => {
      const descriptor = Object.getOwnPropertyDescriptor(iframeWindow.Document.prototype, e) || {
        enumerable: true,
        writable: true,
      };
      try {
        Object.defineProperty(iframeWindow.Document.prototype, e, {
          enumerable: descriptor.enumerable,
          configurable: true,
          get: () => wallworld.shadowRoot.firstElementChild[e],
          set:
            descriptor.writable || descriptor.set
              ? (handler) => {
                  const val = typeof handler === "function" ? handler.bind(iframeWindow.document) : handler;
                  wallworld.shadowRoot.firstElementChild[e] = val;
                }
              : undefined,
        });
      } catch (e) {
        warn(e.message);
      }
    });
  // 处理属性get
  const {
    ownerProperties,
    modifyProperties,
    shadowProperties,
    shadowMethods,
    documentProperties,
    documentMethods,
    documentEvents,
  } = documentProxyProperties;
  modifyProperties.concat(shadowProperties, shadowMethods, documentProperties, documentMethods).forEach((propKey) => {
    const descriptor = Object.getOwnPropertyDescriptor(iframeWindow.Document.prototype, propKey) || {
      enumerable: true,
      writable: true,
    };
    try {
      Object.defineProperty(iframeWindow.Document.prototype, propKey, {
        enumerable: descriptor.enumerable,
        configurable: true,
        get: () => sandbox.proxyDocument[propKey],
        set: undefined,
      });
    } catch (e) {
      warn(e.message);
    }
  });
  // 处理document专属事件
  // TODO 内存泄露
  documentEvents.forEach((propKey) => {
    const descriptor = Object.getOwnPropertyDescriptor(iframeWindow.Document.prototype, propKey) || {
      enumerable: true,
      writable: true,
    };
    try {
      Object.defineProperty(iframeWindow.Document.prototype, propKey, {
        enumerable: descriptor.enumerable,
        configurable: true,
        get: () => window.document[propKey],
        set:
          descriptor.writable || descriptor.set
            ? (handler) => {
                window.document[propKey] =
                  typeof handler === "function" ? handler.bind(iframeWindow.document) : handler;
              }
            : undefined,
      });
    } catch (e) {
      warn(e.message);
    }
  });
  // process owner property
  ownerProperties.forEach((propKey) => {
    Object.defineProperty(iframeWindow.document, propKey, {
      enumerable: true,
      configurable: true,
      get: () => sandbox.proxyDocument[propKey],
      set: undefined,
    });
  });
}

/**
 * patch iframe window effect
 * @param iframeWindow
 */
// TODO 继续改进
function patchWindowEffect(iframeWindow) {
  // 属性处理函数
  function processWindowProperty(key) {
    const value = iframeWindow[key];
    try {
      if (typeof value === "function" && !isConstructable(value)) {
        iframeWindow[key] = window[key].bind(window);
      } else {
        iframeWindow[key] = window[key];
      }
      return true;
    } catch (e) {
      warn(e.message);
      return false;
    }
  }
  Object.getOwnPropertyNames(iframeWindow).forEach((key) => {
    // 特殊处理
    if (key === "getSelection") {
      Object.defineProperty(iframeWindow, key, {
        get: () => iframeWindow.document[key],
      });
      return;
    }
    // 单独属性
    if (windowProxyProperties.includes(key)) {
      processWindowProperty(key);
      return;
    }
    // 正则匹配，可以一次处理多个
    windowRegWhiteList.some((reg) => {
      if (reg.test(key) && key in iframeWindow.parent) {
        return processWindowProperty(key);
      }
      return false;
    });
  });
  // onEvent set
  const windowOnEvents = Object.getOwnPropertyNames(window)
    .filter((p) => /^on/.test(p))
    .filter((e) => !appWindowOnEvent.includes(e));

  // 走主应用window
  windowOnEvents.forEach((e) => {
    const descriptor = Object.getOwnPropertyDescriptor(iframeWindow, e) || {
      enumerable: true,
      writable: true,
    };
    try {
      Object.defineProperty(iframeWindow, e, {
        enumerable: descriptor.enumerable,
        configurable: true,
        get: () => window[e],
        set:
          descriptor.writable || descriptor.set
            ? (handler) => {
                window[e] = typeof handler === "function" ? handler.bind(iframeWindow) : handler;
              }
            : undefined,
      });
    } catch (e) {
      warn(e.message);
    }
  });
}

export function patchElementEffect(element, iframeWindow) {
  const proxyLocation = iframeWindow.__WALLWORLD.sandbox.proxyLocation;
  if (element._hasPatch) return;
  Object.defineProperties(element, {
    baseURI: {
      configurable: true,
      get: () => proxyLocation.protocol + "//" + proxyLocation.host + proxyLocation.pathname,
      set: undefined,
    },
    ownerDocument: {
      configurable: true,
      get: () => iframeWindow.document,
    },
    _hasPatch: { get: () => true },
  });
}


/**
 * 子应用前进后退，同步路由到主应用
 * @param iframeWindow
 */
export function syncIframeUrlToWindow(iframeWindow, mainHostPath, appRoutePath) {
  iframeWindow.addEventListener("hashchange", () => window.history.replaceState(null, "", mainHostPath + appRoutePath));
  iframeWindow.addEventListener("popstate", () => {
    window.history.replaceState(null, "", mainHostPath + appRoutePath);
  });
}

/**
 * 修改window对象的事件监听，只有路由事件采用iframe的事件
 */
function patchIframeEvents(iframeWindow) {
  iframeWindow.addEventListener = function addEventListener(type, listener, options) {
    if (appWindowAddEventListenerEvents.includes(type)) {
      return rawWindowAddEventListener.call(iframeWindow, type, listener, options);
    }
    // 在子应用嵌套场景使用window.window获取真实window
    rawWindowAddEventListener.call(window.__WALLWORLD_RAW_WINDOW__ || window, type, listener, options);
  };

  iframeWindow.removeEventListener = function removeEventListener(type, listener, options) {
    if (appWindowAddEventListenerEvents.includes(type)) {
      return rawWindowRemoveEventListener.call(iframeWindow, type, listener, options);
    }
    rawWindowRemoveEventListener.call(window.__WALLWORLD_RAW_WINDOW__ || window, type, listener, options);
  };
}

/**
 * 对iframe的history的pushState和replaceState进行修改
 * 将从location劫持后的数据修改回来，防止跨域错误
 * 同步路由到主应用
 * @param iframeWindow
 * @param appHostPath 子应用的 host path
 * @param mainHostPath 主应用的 host path
 */
function patchIframeHistory(iframeWindow, appHostPath, mainHostPath) {
  const history = iframeWindow.history;
  const rawHistoryPushState = history.pushState;
  const rawHistoryReplaceState = history.replaceState;
  history.pushState = function (data, title, url) {
    const baseUrl =
      mainHostPath + iframeWindow.location.pathname + iframeWindow.location.search + iframeWindow.location.hash;
    const mainUrl = getAbsolutePath(url?.replace(appHostPath, ""), baseUrl);
    const ignoreFlag = url === undefined;

    rawHistoryPushState.call(history, data, title, ignoreFlag ? undefined : mainUrl);
    if (ignoreFlag) return;
    updateBase(iframeWindow, appHostPath, mainHostPath);
    syncUrlToWindow(iframeWindow);
  };
  history.replaceState = function (data, title, url) {
    const baseUrl =
      mainHostPath + iframeWindow.location.pathname + iframeWindow.location.search + iframeWindow.location.hash;
    const mainUrl = getAbsolutePath(url?.replace(appHostPath, ""), baseUrl);
    const ignoreFlag = url === undefined;

    rawHistoryReplaceState.call(history, data, title, ignoreFlag ? undefined : mainUrl);
    if (ignoreFlag) return;
    updateBase(iframeWindow, appHostPath, mainHostPath);
    syncUrlToWindow(iframeWindow);
  };
}

/**
 * 同步子应用路由到主应用路由
 */
export function syncUrlToWindow(iframeWindow) {
  let winUrlElement = anchorElementGenerator(window.location.href);
  winUrlElement.pathname = iframeWindow.location.pathname;
  winUrlElement.search = iframeWindow.location.search;
  winUrlElement.hash = iframeWindow.location.hash;
  if (winUrlElement.href !== window.location.href) {
    window.history.replaceState(null, "", winUrlElement.href);
  }
  winUrlElement = null;
}

/**
 * 动态的修改iframe的base地址
 * @param iframeWindow
 * @param url
 * @param appHostPath
 * @param mainHostPath
 */
function updateBase(iframeWindow, appHostPath, mainHostPath) {
  const baseUrl = new URL(iframeWindow.location.href?.replace(mainHostPath, ""), appHostPath);
  const baseElement = rawDocumentQuerySelector.call(iframeWindow.document, "base");
  if (baseElement) baseElement.setAttribute("href", appHostPath + baseUrl.pathname);
}

/**
 * 阻止iframe加载
 */
export function stopIframeLoading(iframeWindow) {
  const oldDoc = iframeWindow.document;
  return new Promise((resolve) => {
    function loop() {
      setTimeout(() => {
        let newDoc = null;
        try {
          newDoc = iframeWindow.document;
        } catch (err) {
          newDoc = null;
        }
        // wait for document ready
        if (!newDoc || newDoc == oldDoc) {
          loop();
        } else {
          iframeWindow.stop ? iframeWindow.stop() : iframeWindow.document.execCommand("Stop");
          resolve();
        }
      }, 1);
    }
    loop();
  });
}
