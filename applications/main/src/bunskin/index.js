import { getSandboxById } from './common';
import { WuJie } from './sandbox';
import { importHTML } from './entry';
import { isFunction, stopMainAppRun } from './utils';
import { processAppForHrefJump } from './sync';
import { defineWujieWebComponent } from './shadow';

/**
 * 强制中断主应用运行
 * wujie.__WUJIE 如果为true说明当前运行环境是子应用
 * window.__POWERED_BY_WUJIE__ 如果为false说明子应用还没初始化完成
 * 上述条件同时成立说明主应用代码在iframe的loading阶段混入进来了，必须中断执行
 */
if (window.__WUJIE && !window.__POWERED_BY_WUJIE__) {
  stopMainAppRun();
}

// 处理子应用链接跳转
processAppForHrefJump();

// 定义webComponent容器
defineWujieWebComponent();

export async function startApp(options) {
  const { name, url, el } = options;
  const snadbox = getSandboxById(name);
  if (snadbox) {
    const iframeWindow = sandbox.iframe.contentWindow;
    if (isFunction(iframeWindow.__WUJIE_MOUNT)) {
      /**
       * 子应用切换会触发webcomponent的disconnectedCallback调用sandbox.unmount进行实例销毁
       * 此处是防止没有销毁webcomponent时调用startApp的情况，需要手动调用unmount
       */
      sandbox.unmount();
      await sandbox.active({ url, el });
      // 有渲染函数
      iframeWindow.__WUJIE_MOUNT();
      sandbox.mountFlag = true;
      return sandbox.destroy;
    } else {
      // 没有渲染函数
      sandbox.destroy();
    }
  }
  const newSandbox = new WuJie({ name, url });
  const { getExternalScripts } = await importHTML({
    url,
  });
  await newSandbox.active({ url, el });
  await newSandbox.start(getExternalScripts);
  return newSandbox.destroy;
}

export function destroyApp(id) {
  const sandbox = getSandboxById(id);
  if (sandbox) {
    sandbox.destroy();
  }
}
