const HTML_COMMENT_REGEX = /<!--([\s\S]*?)-->/g;
const ALL_SCRIPT_REGEX = /(<script[\s\S]*?>)[\s\S]*?<\/script>/gi;
const SCRIPT_IGNORE_REGEX = /<script(\s+|\s+.+\s+)ignore(\s*|\s+.*|=.*)>/is;
const SCRIPT_MODULE_REGEX = /.*\stype=('|")?module('|")?\s*.*/;
const CROSS_ORIGIN_REGEX = /.*\scrossorigin=?('|")?(use-credentials|anonymous)?('|")?/i;
const SCRIPT_NO_MODULE_REGEX = /.*\snomodule\s*.*/;
const SCRIPT_TYPE_REGEX = /.*\stype=('|")?([^>'"\s]+)/;
const SCRIPT_SRC_REGEX = /.*\ssrc=('|")?([^>'"\s]+)/;
const SCRIPT_TAG_REGEX = /<(script)\s+((?!type=('|")text\/ng-template\3).)*?>.*?<\/\1>/is;
const SCRIPT_ENTRY_REGEX = /.*\sentry\s*.*/;
const SCRIPT_ASYNC_REGEX = /.*\sasync\s*.*/;
const DEFER_ASYNC_REGEX = /.*\sdefer\s*.*/;

function isModuleScriptSupported() {
  const s = window.document.createElement("script");
  return "noModule" in s;
}

function isValidJavaScriptType(type) {
  const handleTypes = [
    "text/javascript",
    "module",
    "application/javascript",
    "text/ecmascript",
    "application/ecmascript",
  ];
  return !type || handleTypes.indexOf(type) !== -1;
}

function hasProtocol(url) {
  return url.startsWith("//") || url.startsWith("http://") || url.startsWith("https://");
}

function getEntirePath(path, baseURI) {
  return new URL(path, baseURI).toString();
}

/**
 * 解析标签的属性
 * @param scriptOuterHTML script 标签的 outerHTML
 * @returns 返回一个对象，包含 script 标签的所有属性
 */
export function parseTagAttributes(TagOuterHTML) {
  const pattern = /<[-\w]+\s+([^>]*)>/i;
  const matches = pattern.exec(TagOuterHTML);

  if (!matches) {
    return {};
  }

  const attributesString = matches[1];
  const attributesPattern = /([^\s=]+)\s*=\s*(['"])(.*?)\2/g;
  const attributesObject = {};

  let attributeMatches;
  while ((attributeMatches = attributesPattern.exec(attributesString)) !== null) {
    const attributeName = attributeMatches[1];
    const attributeValue = attributeMatches[3];
    attributesObject[attributeName] = attributeValue;
  }

  return attributesObject;
}

export const genScriptReplaceSymbol = (scriptSrc, type = "") =>
  `<!-- ${type} script ${scriptSrc} replaced by wujie -->`;
export const inlineScriptReplaceSymbol = "<!-- inline scripts replaced by wujie -->";
export const genIgnoreAssetReplaceSymbol = (url) => `<!-- ignore asset ${url || "file"} replaced by wujie -->`;
export const genModuleScriptReplaceSymbol = (scriptSrc, moduleSupport) =>
  `<!-- ${moduleSupport ? "nomodule" : "module"} script ${scriptSrc} ignored by wujie -->`;

export function processTpl(tpl, baseURI) {
  const scripts = [];
  let entry = null;
  const moduleSupport = isModuleScriptSupported();
  const template = tpl

    /*
     remove html comment first
     */
    .replace(HTML_COMMENT_REGEX, "")
    .replace(ALL_SCRIPT_REGEX, (match, scriptTag) => {
      const scriptIgnore = scriptTag.match(SCRIPT_IGNORE_REGEX);
      const isModuleScript = !!scriptTag.match(SCRIPT_MODULE_REGEX);
      const isCrossOriginScript = scriptTag.match(CROSS_ORIGIN_REGEX);
      const crossOriginType = isCrossOriginScript?.[2] || "";
      const moduleScriptIgnore =
        (moduleSupport && !!scriptTag.match(SCRIPT_NO_MODULE_REGEX)) || (!moduleSupport && isModuleScript);
      // in order to keep the exec order of all javascripts

      const matchedScriptTypeMatch = scriptTag.match(SCRIPT_TYPE_REGEX);
      const matchedScriptType = matchedScriptTypeMatch && matchedScriptTypeMatch[2];
      if (!isValidJavaScriptType(matchedScriptType)) {
        return match;
      }

      // if it is a external script
      if (SCRIPT_TAG_REGEX.test(match) && scriptTag.match(SCRIPT_SRC_REGEX)) {
        /*
         collect scripts and replace the ref
         */

        const matchedScriptEntry = scriptTag.match(SCRIPT_ENTRY_REGEX);
        const matchedScriptSrcMatch = scriptTag.match(SCRIPT_SRC_REGEX);
        let matchedScriptSrc = matchedScriptSrcMatch && matchedScriptSrcMatch[2];

        if (entry && matchedScriptEntry) {
          throw new SyntaxError("You should not set multiply entry script!");
        } else {
          // append the domain while the script not have an protocol prefix
          if (matchedScriptSrc && !hasProtocol(matchedScriptSrc)) {
            matchedScriptSrc = getEntirePath(matchedScriptSrc, baseURI);
          }

          entry = entry || (matchedScriptEntry && matchedScriptSrc);
        }

        if (scriptIgnore) {
          return genIgnoreAssetReplaceSymbol(matchedScriptSrc || "js file");
        }

        if (moduleScriptIgnore) {
          return genModuleScriptReplaceSymbol(matchedScriptSrc || "js file", moduleSupport);
        }

        if (matchedScriptSrc) {
          const isAsyncScript = !!scriptTag.match(SCRIPT_ASYNC_REGEX);
          const isDeferScript = !!scriptTag.match(DEFER_ASYNC_REGEX);
          scripts.push(
            isAsyncScript || isDeferScript
              ? {
                  async: isAsyncScript,
                  defer: isDeferScript,
                  src: matchedScriptSrc,
                  module: isModuleScript,
                  crossorigin: !!isCrossOriginScript,
                  crossoriginType: crossOriginType,
                  attrs: parseTagAttributes(match),
                }
              : {
                  src: matchedScriptSrc,
                  module: isModuleScript,
                  crossorigin: !!isCrossOriginScript,
                  crossoriginType: crossOriginType,
                  attrs: parseTagAttributes(match),
                }
          );
          return genScriptReplaceSymbol(
            matchedScriptSrc,
            (isAsyncScript && "async") || (isDeferScript && "defer") || ""
          );
        }

        return match;
      } else {
        if (scriptIgnore) {
          return genIgnoreAssetReplaceSymbol("js file");
        }

        if (moduleScriptIgnore) {
          return genModuleScriptReplaceSymbol("js file", moduleSupport);
        }

        // if it is an inline script
        const code = getInlineCode(match);

        // remove script blocks when all of these lines are comments.
        const isPureCommentBlock = code.split(/[\r\n]+/).every((line) => !line.trim() || line.trim().startsWith("//"));

        if (!isPureCommentBlock && code) {
          scripts.push({
            src: "",
            content: code,
            module: isModuleScript,
            crossorigin: !!isCrossOriginScript,
            crossoriginType: crossOriginType,
            attrs: parseTagAttributes(match),
          });
        }

        return inlineScriptReplaceSymbol;
      }
    });

  let tplResult = {
    scripts,
  };

  return tplResult;
}
