
import { iframeGenerator } from './iframe';
import { proxyGenerator } from './proxy';

/**
 * js沙盒，用于防止子应用污染父应用全局变量
 */
export class Sandbox {
  constructor(wallworld, mainHostPath, urlElement, appHostPath, appRoutePath) {
    this.wallworld = wallworld;
    this.mainHostPath = mainHostPath;
    this.appHostPath = appHostPath;
    this.appRoutePath = appRoutePath;
    this.iframe = iframeGenerator(this, mainHostPath, appHostPath, appRoutePath);
    const { proxyWindow, proxyDocument, proxyLocation } = proxyGenerator(
      this.iframe,
      urlElement,
      mainHostPath,
      appHostPath
    );
    this.proxy = proxyWindow;
    this.proxyDocument = proxyDocument;
    this.proxyLocation = proxyLocation;
  }
}

