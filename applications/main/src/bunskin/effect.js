import { getExternalScripts, getExternalStyleSheets } from "./entry";
import {
  getSandboxById,
  rawAppendChild,
  rawElementContains,
  rawElementRemoveChild,
  rawHeadInsertBefore,
  rawBodyInsertBefore,
  rawDocumentQuerySelector,
  rawAddEventListener,
  rawRemoveEventListener,
} from "./common";
import { isHijackingTag, getCurUrl } from "./utils";
import { patchElementEffect } from "./iframe";
import { getPatchStyleElements } from './shadow';

function findScriptElementFromIframe(rawElement, wujieId) {
  const wujieTag = getTagFromScript(rawElement);
  const sandbox = getWujieById(wujieId);
  const { iframe } = sandbox;
  const targetScript = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_HEAD__.querySelector(
    `script[${WUJIE_SCRIPT_ID}='${wujieTag}']`
  );
  if (targetScript === null) {
    warn(WUJIE_TIPS_NO_SCRIPT, `<script ${WUJIE_SCRIPT_ID}='${wujieTag}'/>`);
  }
  return { targetScript, iframe };
}

function rewriteContains(opts) {
  return function contains(other) {
    const element = other;
    const { rawElementContains, wujieId } = opts;
    if (element && isScriptElement(element)) {
      const { targetScript } = findScriptElementFromIframe(element, wujieId);
      return targetScript !== null;
    }
    return rawElementContains(element);
  };
}

function rewriteRemoveChild(opts) {
  return function removeChild(child) {
    const element = child;
    const { rawElementRemoveChild, wujieId } = opts;
    if (element && isScriptElement(element)) {
      const { targetScript, iframe } = findScriptElementFromIframe(element, wujieId);
      if (targetScript !== null) {
        return iframe.contentWindow.__WUJIE_RAW_DOCUMENT_HEAD__.removeChild(targetScript);
      }
      return null;
    }
    return rawElementRemoveChild(element);
  };
}

/**
 * 记录head和body的事件，等重新渲染复用head和body时需要清空事件
 */
function patchEventListener(element) {
  const listenerMap = new Map();
  element._cacheListeners = listenerMap;

  element.addEventListener = (type, listener, options) => {
    const listeners = listenerMap.get(type) || [];
    listenerMap.set(type, [...listeners, listener]);
    return rawAddEventListener.call(element, type, listener, options);
  };

  element.removeEventListener = (type, listener, options) => {
    const typeListeners = listenerMap.get(type);
    const index = typeListeners?.indexOf(listener);
    if (typeListeners?.length && index !== -1) {
      typeListeners.splice(index, 1);
    }
    return rawRemoveEventListener.call(element, type, listener, options);
  };
}


/**
 * 样式元素的css变量处理，每个stylesheetElement单独节流
 */
function handleStylesheetElementPatch(stylesheetElement, sandbox) {
  if (!stylesheetElement.innerHTML || sandbox.degrade) return;
  const patcher = () => {
    const [hostStyleSheetElement, fontStyleSheetElement] = getPatchStyleElements([stylesheetElement.sheet]);
    if (hostStyleSheetElement) {
      sandbox.shadowRoot.head.appendChild(hostStyleSheetElement);
    }
    if (fontStyleSheetElement) {
      sandbox.shadowRoot.host.appendChild(fontStyleSheetElement);
    }
    stylesheetElement._patcher = undefined;
  };
  if (stylesheetElement._patcher) {
    clearTimeout(stylesheetElement._patcher);
  }
  stylesheetElement._patcher = setTimeout(patcher, 50);
}

/**
 * 劫持处理样式元素的属性
 */
function patchStylesheetElement(stylesheetElement, sandbox, curUrl) {
  if (stylesheetElement._hasPatchStyle) return;
  const innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  const innerTextDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerText");
  const textContentDesc = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  const RawInsertRule = stylesheetElement.sheet?.insertRule;
  // 这个地方将cssRule加到innerHTML中去，防止子应用切换之后丢失
  function patchSheetInsertRule() {
    if (!RawInsertRule) return;
    stylesheetElement.sheet.insertRule = (rule, index) => {
      innerHTMLDesc ? (stylesheetElement.innerHTML += rule) : (stylesheetElement.innerText += rule);
      return RawInsertRule.call(stylesheetElement.sheet, rule, index);
    };
  }
  patchSheetInsertRule();

  if (innerHTMLDesc) {
    Object.defineProperties(stylesheetElement, {
      innerHTML: {
        get: function () {
          return innerHTMLDesc.get.call(stylesheetElement);
        },
        set: function (code) {
          innerHTMLDesc.set.call(stylesheetElement, cssLoader(code, "", curUrl));
          nextTick(() => handleStylesheetElementPatch(this, sandbox));
        },
      },
    });
  }

  Object.defineProperties(stylesheetElement, {
    innerText: {
      get: function () {
        return innerTextDesc.get.call(stylesheetElement);
      },
      set: function (code) {
        innerTextDesc.set.call(stylesheetElement, cssLoader(code, "", curUrl));
        nextTick(() => handleStylesheetElementPatch(this, sandbox));
      },
    },
    textContent: {
      get: function () {
        return textContentDesc.get.call(stylesheetElement);
      },
      set: function (code) {
        textContentDesc.set.call(stylesheetElement, cssLoader(code, "", curUrl));
        nextTick(() => handleStylesheetElementPatch(this, sandbox));
      },
    },
    appendChild: {
      value: function (node) {
        nextTick(() => handleStylesheetElementPatch(this, sandbox));
        if (node.nodeType === Node.TEXT_NODE) {
          const res = rawAppendChild.call(
            stylesheetElement,
            stylesheetElement.ownerDocument.createTextNode(cssLoader(node.textContent, "", curUrl))
          );
          // 当appendChild之后，样式元素的sheet对象发生改变，要重新patch
          patchSheetInsertRule();
          return res;
        } else return rawAppendChild(node);
      },
    },
    _hasPatchStyle: { get: () => true },
  });
}

let dynamicScriptExecStack = Promise.resolve();
function rewriteAppendOrInsertChild(opts) {
  return function appendChildOrInsertBefore(newChild, refChild) {
    let element = newChild;
    const { rawDOMAppendOrInsertBefore, wujieId } = opts;
    const sandbox = getSandboxById(wujieId);

    const { iframe, proxyLocation } = sandbox;

    if (!isHijackingTag(element.tagName) || !wujieId) {
      const res = rawDOMAppendOrInsertBefore.call(this, element, refChild);
      patchElementEffect(element, iframe.contentWindow);
      return res;
    }

    const iframeDocument = iframe.contentDocument;
    const curUrl = getCurUrl(proxyLocation);

    // TODO 过滤可以开放
    if (element.tagName) {
      switch (element.tagName?.toUpperCase()) {
        case "LINK": {
          const { href, rel, type } = element;
          const styleFlag = rel === "stylesheet" || type === "text/css" || href.endsWith(".css");
          // 非 stylesheet 不做处理
          if (!styleFlag) {
            const res = rawDOMAppendOrInsertBefore.call(this, element, refChild);
            return res;
          }
          // 排除css
          if (href) {
            getExternalStyleSheets([{ src: href }]).forEach(({ src, contentPromise }) =>
              contentPromise.then(
                (content) => {
                  const rawAttrs = parseTagAttributes(element.outerHTML);
                  // 记录js插入样式，子应用重新激活时恢复
                  const stylesheetElement = iframeDocument.createElement("style");
                  stylesheetElement.innerHTML = content;
                  setAttrsToElement(stylesheetElement, rawAttrs);
                  rawDOMAppendOrInsertBefore.call(this, stylesheetElement, refChild);
                  // 处理样式补丁
                  handleStylesheetElementPatch(stylesheetElement, sandbox);
                  manualInvokeElementEvent(element, "load");
                  element = null;
                },
                () => {
                  manualInvokeElementEvent(element, "error");
                  element = null;
                }
              )
            );
          }

          const comment = iframeDocument.createComment(`dynamic link ${href} replaced by wujie`);
          return rawDOMAppendOrInsertBefore.call(this, comment, refChild);
        }
        case "STYLE": {
          const stylesheetElement = newChild;
          const content = stylesheetElement.innerHTML;
          content && (stylesheetElement.innerHTML = content);
          const res = rawDOMAppendOrInsertBefore.call(this, element, refChild);
          // 处理样式补丁
          patchStylesheetElement(stylesheetElement, sandbox, curUrl);
          handleStylesheetElementPatch(stylesheetElement, sandbox);
          return res;
        }
        case "SCRIPT": {
          setTagToScript(element);
          const { src, text, type, crossOrigin } = element;
          // 排除js
          if (src) {
            const execScript = (scriptResult) => {
              // 假如子应用被连续渲染两次，两次渲染会导致处理流程的交叉污染
              if (sandbox.iframe === null) return warn(WUJIE_TIPS_REPEAT_RENDER);
              const onload = () => {
                manualInvokeElementEvent(element, "load");
                element = null;
              };
              insertScriptToIframe({ ...scriptResult, onload }, sandbox.iframe.contentWindow, element);
            };
            const scriptOptions = {
              src,
              module: type === "module",
              crossorigin: crossOrigin !== null,
              crossoriginType: crossOrigin || "",
              attrs: parseTagAttributes(element.outerHTML),
            };
            getExternalScripts([scriptOptions]).forEach((scriptResult) => {
              dynamicScriptExecStack = dynamicScriptExecStack.then(() =>
                scriptResult.contentPromise.then(
                  (content) => {
                    if (sandbox.execQueue === null) return warn(WUJIE_TIPS_REPEAT_RENDER);
                    const execQueueLength = sandbox.execQueue?.length;
                    sandbox.execQueue.push(() =>
                      fiber
                        ? requestIdleCallback(() => {
                            execScript({ ...scriptResult, content });
                          })
                        : execScript({ ...scriptResult, content })
                    );
                    // 同步脚本如果都执行完了，需要手动触发执行
                    if (!execQueueLength) sandbox.execQueue.shift()();
                  },
                  () => {
                    manualInvokeElementEvent(element, "error");
                    element = null;
                  }
                )
              );
            });
          } else {
            const execQueueLength = sandbox.execQueue?.length;
            sandbox.execQueue.push(() =>
              fiber
                ? requestIdleCallback(() => {
                    insertScriptToIframe(
                      { src: null, content: text, attrs: parseTagAttributes(element.outerHTML) },
                      sandbox.iframe.contentWindow,
                      element
                    );
                  })
                : insertScriptToIframe(
                    { src: null, content: text, attrs: parseTagAttributes(element.outerHTML) },
                    sandbox.iframe.contentWindow,
                    element
                  )
            );
            if (!execQueueLength) sandbox.execQueue.shift()();
          }
          // inline script never trigger the onload and onerror event
          const comment = iframeDocument.createComment(`dynamic script ${src} replaced by wujie`);
          return rawDOMAppendOrInsertBefore.call(this, comment, refChild);
        }
        // 修正子应用内部iframe的window.parent指向
        case "IFRAME": {
          // 嵌套的子应用的js-iframe需要插入子应用的js-iframe内部
          if (element.getAttribute(WUJIE_DATA_FLAG) === "") {
            return rawAppendChild.call(rawDocumentQuerySelector.call(this.ownerDocument, "html"), element);
          }
          const res = rawDOMAppendOrInsertBefore.call(this, element, refChild);
          return res;
        }
        default:
      }
    }
  };
}

/**
 * patch head and body in render
 * intercept appendChild and insertBefore
 */
export function patchRenderEffect(render, id) {
  patchEventListener(render.head);
  patchEventListener(render.body);

  render.head.appendChild = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawAppendChild,
    wujieId: id,
  });
  render.head.insertBefore = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawHeadInsertBefore,
    wujieId: id,
  });
  render.head.removeChild = rewriteRemoveChild({
    rawElementRemoveChild: rawElementRemoveChild.bind(render.head),
    wujieId: id,
  });
  render.head.contains = rewriteContains({
    rawElementContains: rawElementContains.bind(render.head),
    wujieId: id,
  });
  render.contains = rewriteContains({
    rawElementContains: rawElementContains.bind(render),
    wujieId: id,
  });
  render.body.appendChild = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawAppendChild,
    wujieId: id,
  });
  render.body.insertBefore = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawBodyInsertBefore,
    wujieId: id,
  });
}
