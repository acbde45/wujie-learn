import { Sandbox } from './sandbox';
import { appRouteParse } from './utils';

/**
 * 缓存创建过的wallworld实例
 */
export const wallworldCache = new Map();

/**
 * 用于管理沙盒的激活和失活
 */
export class Wallworld {
  constructor({ name, url}) {
    this.id = name;
    this.url = url;
    this.mainHostPath = window.location.protocol + '//' + window.location.host;
    const { appHostPath, appRoutePath } = appRouteParse(url);
    this.appHostPath = appHostPath;
    this.appRoutePath = appRoutePath;
    this.sandbox = new Sandbox(this, this.mainHostPath, this.appHostPath, this.appRoutePath);
  }

  active() {
    this.shadowRoot.innerHTML = `Hello ${this.id}!`;
  }

  inactive() {
    this.shadowRoot.innerHTML = '';
  }
}
