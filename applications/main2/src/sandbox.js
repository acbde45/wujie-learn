/**
 * 缓存创建过的沙盒
 */
export const sandboxCache = new Map();

/**
 * js沙盒，用于防止子应用污染父应用全局变量
 */
export class Wallworld {
  constructor({ name, url}) {
    this.id = name;
    this.url = url;
  }

  active() {
    this.shadowRoot.innerHTML = `Hello ${this.id}!`;
  }

  inactive() {
    this.shadowRoot.innerHTML = '';
  }
}
