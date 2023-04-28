import processTpl, {
  ScriptObject,
  ScriptBaseObject,
  StyleObject,
} from "./template";
import { defaultGetPublicPath, getInlineCode, requestIdleCallback, error } from "./utils";
import {
  WUJIE_TIPS_NO_FETCH,
  WUJIE_TIPS_SCRIPT_ERROR_REQUESTED,
  WUJIE_TIPS_CSS_ERROR_REQUESTED,
  WUJIE_TIPS_HTML_ERROR_REQUESTED,
} from "./constant";
import { getEffectLoaders, isMatchUrl } from "./plugin";
import { plugin, loadErrorHandler } from "./index";

export type ScriptResultList = (ScriptBaseObject & { contentPromise: Promise<string> })[];
export type StyleResultList = { src: string; contentPromise: Promise<string>; ignore?: boolean }[];

interface htmlParseResult {
  assetPublicPath: string;

  getExternalScripts(): ScriptResultList;
}

type ImportEntryOpts = {
  fetch?: typeof window.fetch;
  fiber?: boolean;
  plugins?: Array<plugin>;
  loadError?: loadErrorHandler;
};

const styleCache = {};
const scriptCache = {};
const embedHTMLCache = {};

if (!window.fetch) {
  error(WUJIE_TIPS_NO_FETCH);
  throw new Error();
}
const defaultFetch = window.fetch.bind(window);

const isInlineCode = (code: string) => code.startsWith("<");

const fetchAssets = (
  src: string,
  cache: Object,
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  cssFlag?: boolean,
  loadError?: loadErrorHandler
) =>
  cache[src] ||
  (cache[src] = fetch(src)
    .then((response) => {
      // usually browser treats 4xx and 5xx response of script loading as an error and will fire a script error event
      // https://stackoverflow.com/questions/5625420/what-http-headers-responses-trigger-the-onerror-handler-on-a-script-tag/5625603
      if (response.status >= 400) {
        cache[src] = null;
        if (cssFlag) {
          error(WUJIE_TIPS_CSS_ERROR_REQUESTED, { src, response });
          loadError?.(src, new Error(WUJIE_TIPS_CSS_ERROR_REQUESTED));
          return "";
        } else {
          error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED, { src, response });
          loadError?.(src, new Error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED));
          throw new Error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED);
        }
      }
      return response.text();
    })
    .catch((e) => {
      cache[src] = null;
      if (cssFlag) {
        error(WUJIE_TIPS_CSS_ERROR_REQUESTED, src);
        loadError?.(src, e);
        return "";
      } else {
        error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED, src);
        loadError?.(src, e);
        return "";
      }
    }));

// for prefetch
export function getExternalStyleSheets(
  styles: StyleObject[],
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> = defaultFetch,
  loadError: loadErrorHandler
): StyleResultList {
  return styles.map(({ src, content, ignore }) => {
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
        ignore,
        contentPromise: ignore ? Promise.resolve("") : fetchAssets(src, styleCache, fetch, true, loadError),
      };
    }
  });
}

// for prefetch
export function getExternalScripts(
  scripts: ScriptObject[],
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> = defaultFetch,
  loadError: loadErrorHandler,
  fiber: boolean
): ScriptResultList {
  // module should be requested in iframe
  return scripts.map((script) => {
    const { src, async, defer, module, ignore } = script;
    let contentPromise = null;
    // async
    if ((async || defer) && src && !module) {
      contentPromise = new Promise((resolve, reject) =>
        fiber
          ? requestIdleCallback(() => fetchAssets(src, scriptCache, fetch, false, loadError).then(resolve, reject))
          : fetchAssets(src, scriptCache, fetch, false, loadError).then(resolve, reject)
      );
      // module || ignore
    } else if ((module && src) || ignore) {
      contentPromise = Promise.resolve("");
      // inline
    } else if (!src) {
      contentPromise = Promise.resolve(script.content);
      // outline
    } else {
      contentPromise = fetchAssets(src, scriptCache, fetch, false, loadError);
    }
    // refer https://html.spec.whatwg.org/multipage/scripting.html#attr-script-defer
    if (module && !async) script.defer = true;
    return { ...script, contentPromise };
  });
}

export default function importHTML(params: {
  url: string;
  html?: string;
  opts: ImportEntryOpts;
}): Promise<htmlParseResult> {
  const { url, opts, html } = params;
  const fetch = opts.fetch ?? defaultFetch;
  const fiber = opts.fiber ?? true;
  const { plugins, loadError } = opts;
  const jsExcludes = getEffectLoaders("jsExcludes", plugins);
  const jsIgnores = getEffectLoaders("jsIgnores", plugins);
  const getPublicPath = defaultGetPublicPath;

  const getHtmlParseResult = (url, html) =>
    (html
      ? Promise.resolve(html)
      : fetch(url)
          .then((response) => {
            if (response.status >= 400) {
              error(WUJIE_TIPS_HTML_ERROR_REQUESTED, { url, response });
              loadError?.(url, new Error(WUJIE_TIPS_HTML_ERROR_REQUESTED));
              return "";
            }
            return response.text();
          })
          .catch((e) => {
            embedHTMLCache[url] = null;
            loadError?.(url, e);
            return Promise.reject(e);
          })
    ).then((html) => {
      const assetPublicPath = getPublicPath(url);
      const { scripts } = processTpl(html, assetPublicPath);
      return {
        assetPublicPath,
        getExternalScripts: () =>
          getExternalScripts(
            scripts
              .filter((script) => !script.src || !isMatchUrl(script.src, jsExcludes))
              .map((script) => ({ ...script, ignore: script.src && isMatchUrl(script.src, jsIgnores) })),
            fetch,
            loadError,
            fiber
          ),
      };
    });

  return embedHTMLCache[url] || (embedHTMLCache[url] = getHtmlParseResult(url, html));
}
