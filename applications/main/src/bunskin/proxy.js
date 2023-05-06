import { stopMainAppRun, getTargetValue } from "./utils";
import { patchElementEffect } from "./iframe";
import { documentProxyProperties } from "./common";

/**
 * window、document、location代理
 */
export function proxyGenerator(iframe, urlElement, mainHostPath, appHostPath) {
  const proxyWindow = new Proxy(iframe.contentWindow, {
    get: (target, p) => {
      // location进行劫持
      if (p === "location") {
        return target.__WUJIE.proxyLocation;
      }
      // 判断自身
      if (p === "self" || (p === "window" && Object.getOwnPropertyDescriptor(window, "window").get)) {
        return target.__WUJIE.proxy;
      }
      // 不要绑定this
      if (p === "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__" || p === "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__") {
        return target[p];
      }
      // 修正this指针指向
      return getTargetValue(target, p);
    },
  });

  // proxy document
  const proxyDocument = new Proxy(
    {},
    {
      get: function (_fakeDocument, propKey) {
        const document = window.document;
        const { shadowRoot, proxyLocation } = iframe.contentWindow.__WUJIE;
        // iframe初始化完成后，webcomponent还未挂在上去，此时运行了主应用代码，必须中止
        if (!shadowRoot) stopMainAppRun();
        const rawCreateElement = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_CREATE_ELEMENT__;
        const rawCreateTextNode = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_CREATE_TEXT_NODE__;
        // need fix
        if (propKey === "createElement" || propKey === "createTextNode") {
          return new Proxy(document[propKey], {
            apply(_createElement, _ctx, args) {
              const rawCreateMethod = propKey === "createElement" ? rawCreateElement : rawCreateTextNode;
              const element = rawCreateMethod.apply(iframe.contentDocument, args);
              patchElementEffect(element, iframe.contentWindow);
              return element;
            },
          });
        }
        if (propKey === "documentURI" || propKey === "URL") {
          return proxyLocation.href;
        }

        // from shadowRoot
        if (
          propKey === "getElementsByTagName" ||
          propKey === "getElementsByClassName" ||
          propKey === "getElementsByName"
        ) {
          return new Proxy(shadowRoot.querySelectorAll, {
            apply(querySelectorAll, _ctx, args) {
              let arg = args[0];
              if (_ctx !== iframe.contentDocument) {
                return _ctx[propKey].apply(_ctx, args);
              }

              if (propKey === "getElementsByTagName" && arg === "script") {
                return iframe.contentDocument.scripts;
              }
              if (propKey === "getElementsByClassName") arg = "." + arg;
              if (propKey === "getElementsByName") arg = `[name="${arg}"]`;
              return querySelectorAll.call(shadowRoot, arg);
            },
          });
        }
        if (propKey === "getElementById") {
          return new Proxy(shadowRoot.querySelector, {
            // case document.querySelector.call
            apply(target, ctx, args) {
              if (ctx !== iframe.contentDocument) {
                return ctx[propKey]?.apply(ctx, args);
              }
              return (
                target.call(shadowRoot, `[id="${args[0]}"]`) ||
                iframe.contentWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__.call(
                  iframe.contentWindow.document,
                  `#${args[0]}`
                )
              );
            },
          });
        }
        if (propKey === "querySelector" || propKey === "querySelectorAll") {
          const rawPropMap = {
            querySelector: "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__",
            querySelectorAll: "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__",
          };
          return new Proxy(shadowRoot[propKey], {
            apply(target, ctx, args) {
              if (ctx !== iframe.contentDocument) {
                return ctx[propKey]?.apply(ctx, args);
              }
              // 二选一，优先shadowDom，除非采用array合并，排除base，防止对router造成影响
              return (
                target.apply(shadowRoot, args) ||
                (args[0] === "base"
                  ? null
                  : iframe.contentWindow[rawPropMap[propKey]].call(iframe.contentWindow.document, args[0]))
              );
            },
          });
        }
        if (propKey === "documentElement" || propKey === "scrollingElement") return shadowRoot.firstElementChild;
        if (propKey === "forms") return shadowRoot.querySelectorAll("form");
        if (propKey === "images") return shadowRoot.querySelectorAll("img");
        if (propKey === "links") return shadowRoot.querySelectorAll("a");
        const { ownerProperties, shadowProperties, shadowMethods, documentProperties, documentMethods } =
          documentProxyProperties;
        if (ownerProperties.concat(shadowProperties).includes(propKey.toString())) {
          if (propKey === "activeElement" && shadowRoot.activeElement === null) return shadowRoot.body;
          return shadowRoot[propKey];
        }
        if (shadowMethods.includes(propKey.toString())) {
          return getTargetValue(shadowRoot, propKey) ?? getTargetValue(document, propKey);
        }
        // from window.document
        if (documentProperties.includes(propKey.toString())) {
          return document[propKey];
        }
        if (documentMethods.includes(propKey.toString())) {
          return getTargetValue(document, propKey);
        }
      },
    }
  );

  // proxy location
  const proxyLocation = new Proxy(
    {},
    {
      get: function (_fakeLocation, propKey) {
        const location = iframe.contentWindow.location;
        if (
          propKey === "host" ||
          propKey === "hostname" ||
          propKey === "protocol" ||
          propKey === "port" ||
          propKey === "origin"
        ) {
          return urlElement[propKey];
        }
        if (propKey === "href") {
          return location[propKey].replace(mainHostPath, appHostPath);
        }
        if (propKey === "reload") {
          warn(WUJIE_TIPS_RELOAD_DISABLED);
          return () => null;
        }
        if (propKey === "replace") {
          return new Proxy(location[propKey], {
            apply(replace, _ctx, args) {
              return replace.call(location, args[0]?.replace(appHostPath, mainHostPath));
            },
          });
        }
        return getTargetValue(location, propKey);
      },
      set: function (_fakeLocation, propKey, value) {
        // 如果是跳转链接的话重开一个iframe
        if (propKey === "href") {
          return locationHrefSet(iframe, value, appHostPath);
        }
        iframe.contentWindow.location[propKey] = value;
        return true;
      },
      ownKeys: function () {
        return Object.keys(iframe.contentWindow.location).filter((key) => key !== "reload");
      },
      getOwnPropertyDescriptor: function (_target, key) {
        return { enumerable: true, configurable: true, value: this[key] };
      },
    }
  );
  return { proxyWindow, proxyDocument, proxyLocation };
}
