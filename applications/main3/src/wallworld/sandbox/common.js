// 保存原型方法
// 子应用的Document.prototype已经被改写了
export const rawElementAppendChild = HTMLElement.prototype.appendChild;
export const rawElementRemoveChild = HTMLElement.prototype.removeChild;
export const rawElementContains = HTMLElement.prototype.contains;
export const rawHeadInsertBefore = HTMLHeadElement.prototype.insertBefore;
export const rawBodyInsertBefore = HTMLBodyElement.prototype.insertBefore;
export const rawAddEventListener = Node.prototype.addEventListener;
export const rawRemoveEventListener = Node.prototype.removeEventListener;
export const rawWindowAddEventListener = window.addEventListener;
export const rawWindowRemoveEventListener = window.removeEventListener;
export const rawAppendChild = Node.prototype.appendChild;
export const rawDocumentQuerySelector = window.__POWERED_BY_WALLWORLD__
  ? window.__WALLWORLD_RAW_DOCUMENT_QUERY_SELECTOR__
  : Document.prototype.querySelector;
