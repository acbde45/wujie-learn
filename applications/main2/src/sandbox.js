/**
 * js沙盒，用于防止子应用污染父应用全局变量
 */
export class Sandbox {
  constructor(wallworld, mainHostPath, appHostPath, appRouteParh) {
    this.wallworld = wallworld;
    this.mainHostPath = mainHostPath;
    this.appHostPath = appHostPath;
    this.appRouteParh = appRouteParh;
    this.createIframe();
  }

  createIframe() {
    const iframe = window.document.createElement("iframe");
    const attrs = { src: this.mainHostPath, name: this.wallworld.id, style: "display:none" };
    for (let key in attrs) {
      iframe.setAttribute(key, attrs[key]);
    }
    window.document.body.appendChild(iframe);
    this.iframe = iframe;
    injectGlobalVarsToWindow(iframe.contentWindow, this.wallworld);
    // iframe准备完成需要在处理副作用之后
    let resolve;
    this.iframeReady = new Promise(r => resolve = r);
    stopIframeLoading(iframe.contentWindow).then(() => {
      if (!iframe.contentWindow.__POWERED_BY_WALLWORLD__) {
        injectGlobalVarsToWindow(iframe.contentWindow, this.wallworld);
      }
      const iframeDocument = iframe.contentWindow.document;
      const newDoc = window.document.implementation.createHTMLDocument("");
      const newDocumentElement = iframeDocument.importNode(newDoc.documentElement, true);
      iframeDocument.documentElement
        ? iframeDocument.replaceChild(newDocumentElement, iframeDocument.documentElement)
        : iframeDocument.appendChild(newDocumentElement);
      const baseElement = iframeDocument.createElement("base");
      baseElement.setAttribute("href", this.appHostPath + this.appRouteParh);
      iframeDocument.head.appendChild(baseElement);
      // 处理iframe的副作用，指向shadowRoot
      resolve();
    });
  }
}

/**
 * 往iframe的window对象里注入全局变量
 */
function injectGlobalVarsToWindow(iframeWindow, wallworld) {
  iframeWindow.__POWERED_BY_WALLWORLD__ = true;
  iframeWindow.__WALLWORLD = wallworld;
}

/**
 * 阻止iframe加载
 */
function stopIframeLoading(iframeWindow) {
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
