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
  return { appHostPath, appRoutePath };
}
