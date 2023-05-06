import { WUJIE_TIPS_NO_URL, WUJIE_TIPS_STOP_APP_DETAIL, WUJIE_TIPS_STOP_APP } from "./constant";

export function isFunction(value) {
  return typeof value === "function";
}

export function isHijackingTag(tagName) {
  return (
    tagName?.toUpperCase() === "LINK" ||
    tagName?.toUpperCase() === "STYLE" ||
    tagName?.toUpperCase() === "SCRIPT" ||
    tagName?.toUpperCase() === "IFRAME"
  );
}

export function warn(msg, data) {
  console?.warn(`[wujie warn]: ${msg}`, data);
}

export function error(msg, data) {
  console?.error(`[wujie error]: ${msg}`, data);
}

export function anchorElementGenerator(url) {
  const element = window.document.createElement("a");
  element.href = url;
  element.href = element.href; // hack ie
  return element;
}

export function appRouteParse(url) {
  if (!url) {
    error(WUJIE_TIPS_NO_URL);
    throw new Error();
  }
  const urlElement = anchorElementGenerator(url);
  const appHostPath = urlElement.protocol + "//" + urlElement.host;
  let appRoutePath = urlElement.pathname + urlElement.search + urlElement.hash;
  if (!appRoutePath.startsWith("/")) appRoutePath = "/" + appRoutePath; // hack ie
  return { urlElement, appHostPath, appRoutePath };
}


/**
 * in safari
 * typeof document.all === 'undefined' // true
 * typeof document.all === 'function' // true
 * We need to discriminate safari for better performance
 */
const naughtySafari = typeof document.all === "function" && typeof document.all === "undefined";
const callableFnCacheMap = new WeakMap();
export const isCallable = (fn) => {
  if (callableFnCacheMap.has(fn)) {
    return true;
  }

  const callable = naughtySafari ? typeof fn === "function" && typeof fn !== "undefined" : typeof fn === "function";
  if (callable) {
    callableFnCacheMap.set(fn, callable);
  }
  return callable;
};

const boundedMap = new WeakMap();
export function isBoundedFunction(fn) {
  if (boundedMap.has(fn)) {
    return boundedMap.get(fn);
  }
  const bounded = fn.name.indexOf("bound ") === 0 && !fn.hasOwnProperty("prototype");
  boundedMap.set(fn, bounded);
  return bounded;
}

const fnRegexCheckCacheMap = new WeakMap();
export function isConstructable(fn) {
  const hasPrototypeMethods =
    fn.prototype && fn.prototype.constructor === fn && Object.getOwnPropertyNames(fn.prototype).length > 1;

  if (hasPrototypeMethods) return true;

  if (fnRegexCheckCacheMap.has(fn)) {
    return fnRegexCheckCacheMap.get(fn);
  }

  let constructable = hasPrototypeMethods;
  if (!constructable) {
    const fnString = fn.toString();
    const constructableFunctionRegex = /^function\b\s[A-Z].*/;
    const classRegex = /^class\b/;
    constructable = constructableFunctionRegex.test(fnString) || classRegex.test(fnString);
  }

  fnRegexCheckCacheMap.set(fn, constructable);
  return constructable;
}

const setFnCacheMap = new WeakMap();
export function checkProxyFunction(value) {
  if (isCallable(value) && !isBoundedFunction(value) && !isConstructable(value)) {
    if (!setFnCacheMap.has(value)) {
      setFnCacheMap.set(value, value);
    }
  }
}

export function getTargetValue(target, p) {
  const value = target[p];
  if (setFnCacheMap.has(value)) {
    return setFnCacheMap.get(value);
  }
  if (isCallable(value) && !isBoundedFunction(value) && !isConstructable(value)) {
    const boundValue = Function.prototype.bind.call(value, target);
    setFnCacheMap.set(value, boundValue);

    for (const key in value) {
      boundValue[key] = value[key];
    }
    if (value.hasOwnProperty("prototype") && !boundValue.hasOwnProperty("prototype")) {
      // https://github.com/kuitos/kuitos.github.io/issues/47
      Object.defineProperty(boundValue, "prototype", { value: value.prototype, enumerable: false, writable: true });
    }
    return boundValue;
  }
  return value;
}

export function setAttrsToElement(element, attrs) {
  Object.keys(attrs).forEach((name) => {
    element.setAttribute(name, attrs[name]);
  });
}

export function getAnchorElementQueryMap(anchorElement) {
  const queryList = anchorElement.search.replace("?", "").split("&");
  const queryMap = {};
  queryList.forEach((query) => {
    const [key, value] = query.split("=");
    if (key && value) queryMap[key] = value;
  });
  return queryMap;
}

export function getAbsolutePath(url, base, hash) {
  try {
    // 为空值无需处理
    if (url) {
      // 需要处理hash的场景
      if (hash && url.startsWith("#")) return url;
      return new URL(url, base).href;
    } else return url;
  } catch {
    return url;
  }
}

export function getCurUrl(proxyLocation) {
  const location = proxyLocation;
  return location.protocol + "//" + location.host + location.pathname;
}

/**
 * 获取需要同步的url
 */
export function getSyncUrl(id, prefix) {
  let winUrlElement = anchorElementGenerator(window.location.href);
  const queryMap = getAnchorElementQueryMap(winUrlElement);
  winUrlElement = null;
  const syncUrl = window.decodeURIComponent(queryMap[id] || "");
  const validShortPath = syncUrl.match(/^{([^}]*)}/)?.[1];
  if (prefix && validShortPath) {
    return syncUrl.replace(`{${validShortPath}}`, prefix[validShortPath]);
  }
  return syncUrl;
}

/**
 * 当前url的查询参数中是否有给定的id
 */
export function isMatchSyncQueryById(id) {
  const queryMap = getAnchorElementQueryMap(anchorElementGenerator(window.location.href));
  return Object.keys(queryMap).includes(id);
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

export function getContainer(container) {
  return typeof container === "string" ? document.querySelector(container) : container;
}

/**
 * 事件触发器
 */
export function eventTrigger(el, eventName, detail) {
  let event;
  if (typeof window.CustomEvent === "function") {
    event = new CustomEvent(eventName, { detail });
  } else {
    event = document.createEvent("CustomEvent");
    event.initCustomEvent(eventName, true, false, detail);
  }
  el.dispatchEvent(event);
}

export function stopMainAppRun() {
  warn(WUJIE_TIPS_STOP_APP_DETAIL);
  throw new Error(WUJIE_TIPS_STOP_APP);
}
