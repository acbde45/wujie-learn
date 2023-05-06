import { WUJIE_APP_ID, WUJIE_IFRAME_CLASS, LOADING_DATA_FLAG, WUJIE_SHADE_STYLE } from './constant';
import { getContainer } from './utils';
import { rawElementRemoveChild, rawElementAppendChild, getSandboxById, relativeElementTagAttrMap } from './common';
import { patchElementEffect } from './iframe';
import { patchRenderEffect  } from './effect';

const cssSelectorMap = {
  ":root": ":host",
};

/**
 * 清除Element所有节点
 */
export function clearChild(root) {
  // 清除内容
  while (root?.firstChild) {
    rawElementRemoveChild.call(root, root.firstChild);
  }
}

/**
 * 定义 wujie webComponent，将shadow包裹并获得dom装载和卸载的生命周期
 */
export function defineWujieWebComponent() {
  const customElements = window.customElements;
  if (customElements && !customElements?.get("wujie-app")) {
    class WujieApp extends HTMLElement {
      connectedCallback() {
        if (this.shadowRoot) return;
        const shadowRoot = this;
        const sandbox = getSandboxById(this.getAttribute(WUJIE_APP_ID));
        patchElementEffect(shadowRoot, sandbox.iframe.contentWindow);
        sandbox.shadowRoot = shadowRoot;
      }

      disconnectedCallback() {
        const sandbox = getSandboxById(this.getAttribute(WUJIE_APP_ID));
        sandbox?.unmount();
      }
    }
    customElements?.define("wujie-app", WujieApp);
  }
}

export function createWujieWebComponent(id) {
  const contentElement = window.document.createElement("wujie-app");
  contentElement.setAttribute(WUJIE_APP_ID, id);
  contentElement.classList.add(WUJIE_IFRAME_CLASS);
  return contentElement;
}

/**
 * 将template渲染成html元素
 */
function renderTemplateToHtml(iframeWindow, template) {
  const sandbox = iframeWindow.__WUJIE;
  const { head, body, alive, execFlag } = sandbox;
  const document = iframeWindow.document;
  let html = document.createElement("html");
  html.innerHTML = template;
  // 组件多次渲染，head和body必须一直使用同一个来应对被缓存的场景
  if (!alive && execFlag) {
    html = replaceHeadAndBody(html, head, body);
  } else {
    sandbox.head = html.querySelector("head");
    sandbox.body = html.querySelector("body");
  }
  const ElementIterator = document.createTreeWalker(html, NodeFilter.SHOW_ELEMENT, null, false);
  let nextElement = ElementIterator.currentNode;
  while (nextElement) {
    patchElementEffect(nextElement, iframeWindow);
    const relativeAttr = relativeElementTagAttrMap[nextElement.tagName];
    const url = nextElement[relativeAttr];
    if (relativeAttr) nextElement.setAttribute(relativeAttr, getAbsolutePath(url, nextElement.baseURI || ""));
    nextElement = ElementIterator.nextNode();
  }
  if (!html.querySelector("head")) {
    const head = document.createElement("head");
    html.appendChild(head);
  }
  if (!html.querySelector("body")) {
    const body = document.createElement("body");
    html.appendChild(body);
  }
  return html;
}

/**
 * 将template渲染到shadowRoot
 */
export async function renderTemplateToShadowRoot(
  shadowRoot,
  iframeWindow,
) {
  const html = document.createElement("div");
  // change ownerDocument
  shadowRoot.appendChild(html);
  const shade = document.createElement("div");
  shade.setAttribute("style", WUJIE_SHADE_STYLE);
  html.insertBefore(shade, html.firstChild);
  shadowRoot.head = document.querySelector("head");
  shadowRoot.body = document.querySelector("body");

  // 修复 html parentNode
  Object.defineProperty(shadowRoot.firstChild, "parentNode", {
    enumerable: true,
    configurable: true,
    get: () => iframeWindow.document,
  });

  patchRenderEffect(shadowRoot, iframeWindow.__WUJIE.id, false);
}

/**
 * 将准备好的内容插入容器
 */
export function renderElementToContainer(element, selectorOrElement) {
  const container = getContainer(selectorOrElement);
  if (container && !container.contains(element)) {
    // 有 loading 无需清理，已经清理过了
    if (!container.querySelector(`div[${LOADING_DATA_FLAG}]`)) {
      // 清除内容
      clearChild(container);
    }
    // 插入元素
    if (element) {
      rawElementAppendChild.call(container, element);
    }
  }
  return container;
}

/**
 * 获取修复好的样式元素
 * 主要是针对对root样式和font-face样式
 */
export function getPatchStyleElements(rootStyleSheets) {
  const rootCssRules = [];
  const fontCssRules = [];
  const rootStyleReg = /:root/g;

  // 找出root的cssRules
  for (let i = 0; i < rootStyleSheets.length; i++) {
    const cssRules = rootStyleSheets[i]?.cssRules ?? [];
    for (let j = 0; j < cssRules.length; j++) {
      const cssRuleText = cssRules[j].cssText;
      // 如果是root的cssRule
      if (rootStyleReg.test(cssRuleText)) {
        rootCssRules.push(cssRuleText.replace(rootStyleReg, (match) => cssSelectorMap[match]));
      }
      // 如果是font-face的cssRule
      if (cssRules[j].type === CSSRule.FONT_FACE_RULE) {
        fontCssRules.push(cssRuleText);
      }
    }
  }

  let rootStyleSheetElement = null;
  let fontStyleSheetElement = null;

  // 复制到host上
  if (rootCssRules.length) {
    rootStyleSheetElement = window.document.createElement("style");
    rootStyleSheetElement.innerHTML = rootCssRules.join("");
  }

  if (fontCssRules.length) {
    fontStyleSheetElement = window.document.createElement("style");
    fontStyleSheetElement.innerHTML = fontCssRules.join("");
  }

  return [rootStyleSheetElement, fontStyleSheetElement];
}
