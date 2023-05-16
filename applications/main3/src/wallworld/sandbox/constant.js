// 需要单独处理的window属性
export const windowProxyProperties = ["getComputedStyle", "visualViewport", "matchMedia", "DOMParser"];

// window白名单
export const windowRegWhiteList = [
  /animationFrame$/i,
  /resizeObserver$|mutationObserver$|intersectionObserver$/i,
  /height$|width$|left$/i,
  /^screen/i,
  /X$|Y$/,
];

// 子应用window.onXXX需要挂载到iframe沙箱上的事件
export const appWindowOnEvent = ["onload", "onbeforeunload", "onunload"];

// 需要挂载到子应用iframe document上的事件
export const appDocumentAddEventListenerEvents = ["DOMContentLoaded", "readystatechange"];
export const appDocumentOnEvents = ["onreadystatechange"];
// 需要挂载到主应用document上的事件
export const mainDocumentAddEventListenerEvents = [
  "fullscreenchange",
  "fullscreenerror",
  "selectionchange",
  "visibilitychange",
  "wheel",
  "keydown",
  "keypress",
  "keyup",
];
// 需要同时挂载到主应用document和shadow上的事件（互斥）
export const mainAndAppAddEventListenerEvents = ["gotpointercapture", "lostpointercapture"];

// 分类document上需要处理的属性，不同类型会进入不同的处理逻辑
export const documentProxyProperties = {
  // 降级场景下需要本地特殊处理的属性
  modifyLocalProperties: ["createElement", "createTextNode", "documentURI", "URL", "getElementsByTagName"],

  // 子应用需要手动修正的属性方法
  modifyProperties: [
    "createElement",
    "createTextNode",
    "documentURI",
    "URL",
    "getElementsByTagName",
    "getElementsByClassName",
    "getElementsByName",
    "getElementById",
    "querySelector",
    "querySelectorAll",
    "documentElement",
    "scrollingElement",
    "forms",
    "images",
    "links",
  ],

  // 需要从shadowRoot中获取的属性
  shadowProperties: [
    "activeElement",
    "childElementCount",
    "children",
    "firstElementChild",
    "firstChild",
    "fullscreenElement",
    "lastElementChild",
    "pictureInPictureElement",
    "pointerLockElement",
    "styleSheets",
  ],

  // 需要从shadowRoot中获取的方法
  shadowMethods: [
    "append",
    "contains",
    "getSelection",
    "elementFromPoint",
    "elementsFromPoint",
    "getAnimations",
    "replaceChildren",
  ],

  // 需要从主应用document中获取的属性
  documentProperties: [
    "characterSet",
    "compatMode",
    "contentType",
    "designMode",
    "dir",
    "doctype",
    "embeds",
    "fullscreenEnabled",
    "hidden",
    "implementation",
    "lastModified",
    "pictureInPictureEnabled",
    "plugins",
    "readyState",
    "referrer",
    "visibilityState",
    "fonts",
  ],

  // 需要从主应用document中获取的方法
  documentMethods: [
    "execCommand",
    "createRange",
    "exitFullscreen",
    "exitPictureInPicture",
    "getElementsByTagNameNS",
    "hasFocus",
    "prepend",
  ],

  // 需要从主应用document中获取的事件
  documentEvents: [
    "onpointerlockchange",
    "onpointerlockerror",
    "onbeforecopy",
    "onbeforecut",
    "onbeforepaste",
    "onfreeze",
    "onresume",
    "onsearch",
    "onfullscreenchange",
    "onfullscreenerror",
    "onsecuritypolicyviolation",
    "onvisibilitychange",
  ],

  // 无需修改原型的属性
  ownerProperties: ["head", "body"],
};

// 子应用window监听需要挂载到iframe沙箱上的事件
export const appWindowAddEventListenerEvents = [
  "hashchange",
  "popstate",
  "DOMContentLoaded",
  "load",
  "beforeunload",
  "unload",
];

