import { processTpl } from "./template";
import { WUJIE_TIPS_HTML_ERROR_REQUESTED } from "./constant";
import { error } from "./utils";

const scriptCache = {};
const embedHTMLCache = {};

export function getPublicPath(entry) {
  if (typeof entry === "object") {
    return "/";
  }
  try {
    const { origin, pathname } = new URL(entry, location.href);
    const paths = pathname.split("/");
    // 移除最后一个元素
    paths.pop();
    return `${origin}${paths.join("/")}/`;
  } catch (e) {
    console.warn(e);
    return "";
  }
}

const fetchAssets = (src, cache, cssFlag) =>
  cache[src] ||
  (cache[src] = fetch(src)
    .then((response) => {
      // usually browser treats 4xx and 5xx response of script loading as an error and will fire a script error event
      // https://stackoverflow.com/questions/5625420/what-http-headers-responses-trigger-the-onerror-handler-on-a-script-tag/5625603
      if (response.status >= 400) {
        cache[src] = null;
        if (cssFlag) {
          error(WUJIE_TIPS_CSS_ERROR_REQUESTED, { src, response });
          return "";
        } else {
          error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED, { src, response });
          throw new Error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED);
        }
      }
      return response.text();
    })
    .catch((e) => {
      cache[src] = null;
      if (cssFlag) {
        error(WUJIE_TIPS_CSS_ERROR_REQUESTED, src);
        return "";
      } else {
        error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED, src);
        return "";
      }
    }));

// for prefetch
export function getExternalStyleSheets(styles) {
  return styles.map(({ src, content }) => {
    // 内联
    if (content) {
      return { src: "", contentPromise: Promise.resolve(content) };
    } else if (isInlineCode(src)) {
      // if it is inline style
      return { src: "", contentPromise: Promise.resolve(getInlineCode(src)) };
    } else {
      // external styles
      return {
        src,
        contentPromise: fetchAssets(src, styleCache, fetch, true, loadError),
      };
    }
  });
}

// for prefetch
export function getExternalScripts(scripts) {
  // module should be requested in iframe
  return scripts.map((script) => {
    const { src, async, defer, module } = script;
    let contentPromise = null;
    // async
    if ((async || defer) && src && !module) {
      contentPromise = new Promise((resolve, reject) =>
        fiber
          ? requestIdleCallback(() => fetchAssets(src, scriptCache, false).then(resolve, reject))
          : fetchAssets(src, scriptCache, false).then(resolve, reject)
      );
      // module || ignore
    } else if (module && src) {
      contentPromise = Promise.resolve("");
      // inline
    } else if (!src) {
      contentPromise = Promise.resolve(script.content);
      // outline
    } else {
      contentPromise = fetchAssets(src, scriptCache, fetch, false);
    }
    // refer https://html.spec.whatwg.org/multipage/scripting.html#attr-script-defer
    if (module && !async) script.defer = true;
    return { ...script, contentPromise };
  });
}

export function importHTML(params) {
  const { url } = params;

  const getHtmlParseResult = (url) =>
    fetch(url)
      .then((response) => {
        if (response.status >= 400) {
          error(WUJIE_TIPS_HTML_ERROR_REQUESTED, { url, response });
          return "";
        }
        return response.text();
      })
      .catch((e) => {
        embedHTMLCache[url] = null;
        return Promise.reject(e);
      })
      .then((html) => {
        const assetPublicPath = getPublicPath(url);
        const { scripts } = processTpl(html, assetPublicPath);
        return {
          assetPublicPath,
          getExternalScripts: () => getExternalScripts(scripts),
        };
      });

  return embedHTMLCache[url] || (embedHTMLCache[url] = getHtmlParseResult(url));
}
