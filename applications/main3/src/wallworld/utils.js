/**
 * 创建一个AnchorElement
 */
export function anchorElementGenerator(url) {
  const anchorElement = document.createElement("a");
  anchorElement.setAttribute("href", url);
  return anchorElement;
}

/**
 * 解析app的url
 */
export function appRouteParse(url) {
  const urlElement = anchorElementGenerator(url);
  const appHostPath = urlElement.protocol + "//" + urlElement.host;
  const appRoutePath = urlElement.pathname;
  return { urlElement, appHostPath, appRoutePath };
}

export function warn(msg, data) {
  console?.warn(`[wallworld warn]: ${msg}`, data);
}

export function error(msg, data) {
  console?.error(`[wallworld error]: ${msg}`, data);
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
