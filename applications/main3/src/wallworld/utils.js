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
