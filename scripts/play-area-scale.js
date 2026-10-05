var H5P = H5P || {};

H5P.AlphabetWheel = H5P.AlphabetWheel || {};

/**
 * Play area 16:9 — explicit height in px, fluid width, proportional fontSize.
 */
H5P.AlphabetWheel.PlayArea = (function () {
  var BASE_WIDTH = 640;
  var ASPECT_RATIO = 16 / 9;
  var BASE_HEIGHT = Math.round(BASE_WIDTH / ASPECT_RATIO);
  var BASE_FONT_SIZE = 16;
  var MIN_SCALE = 0.35;
  var MAX_SCALE = 1;

  function getDesignSize() {
    return {
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      ratio: ASPECT_RATIO,
      baseWidth: BASE_WIDTH,
      baseHeight: BASE_HEIGHT,
      baseFontSize: BASE_FONT_SIZE
    };
  }

  function getScale(width, height) {
    var scaleW = (!width || width <= 0) ? 1 : width / BASE_WIDTH;
    var scaleH = (!height || height <= 0) ? Number.POSITIVE_INFINITY : height / BASE_HEIGHT;
    var scale = Math.min(scaleW, scaleH);

    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  }

  function getScaledFontSize(width, height) {
    return BASE_FONT_SIZE * getScale(width, height);
  }

  /**
   * @param {number} width
   * @param {number} [maxHeightPx]
   * @returns {number}
   */
  function getExplicitHeight(width, maxHeightPx) {
    if (!width || width <= 0) {
      return BASE_HEIGHT;
    }

    var height = width / ASPECT_RATIO;

    if (maxHeightPx > 0 && height > maxHeightPx) {
      return Math.round(maxHeightPx);
    }

    return Math.round(height);
  }

  function getMeasureWidth(playAreaElement) {
    var parent;
    var frame;
    var parentWidth = 0;
    var frameWidth = 0;

    if (!playAreaElement) {
      return 0;
    }

    parent = playAreaElement.parentElement;
    frame = window.frameElement;

    if (parent) {
      parent.getBoundingClientRect();
      parentWidth = parent.clientWidth;
    }

    if (frame) {
      frame.getBoundingClientRect();
      frameWidth = frame.clientWidth;
    }

    if (frameWidth > 0) {
      if (parentWidth > 0) {
        return Math.min(parentWidth, frameWidth);
      }

      return frameWidth;
    }

    if (parentWidth > 0) {
      return parentWidth;
    }

    playAreaElement.getBoundingClientRect();

    return playAreaElement.clientWidth;
  }

  function getMeasureViewportHeight(playAreaElement) {
    var frame = window.frameElement;
    var frameHeight = 0;
    var viewHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    if (frame) {
      frame.getBoundingClientRect();
      frameHeight = frame.clientHeight;
    }

    if (frameHeight > 0 && viewHeight > 0) {
      return Math.min(frameHeight, viewHeight);
    }

    if (frameHeight > 0) {
      return frameHeight;
    }

    return viewHeight;
  }

  function isFullscreenContext(playAreaElement) {
    var node;
    var frame;
    var host;
    var root = document.documentElement;
    var body = document.body;

    if (document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement) {
      return true;
    }

    if ((root && (root.classList.contains('h5p-fullscreen') || root.classList.contains('h5p-semi-fullscreen'))) ||
        (body && (body.classList.contains('h5p-fullscreen') || body.classList.contains('h5p-semi-fullscreen')))) {
      return true;
    }

    node = playAreaElement;

    while (node) {
      if (node.classList &&
          (node.classList.contains('h5p-fullscreen') || node.classList.contains('h5p-semi-fullscreen'))) {
        return true;
      }

      node = node.parentElement;
    }

    frame = window.frameElement;

    if (frame) {
      host = frame.parentElement;

      while (host) {
        if (host.classList &&
            (host.classList.contains('h5p-fullscreen') || host.classList.contains('h5p-semi-fullscreen'))) {
          return true;
        }

        host = host.parentElement;
      }
    }

    return false;
  }

  function getPlayAreaMaxHeight(playAreaElement, width) {
    var viewportHeight;
    var naturalHeight;

    if (!width || width <= 0 || !isFullscreenContext(playAreaElement)) {
      return 0;
    }

    viewportHeight = getMeasureViewportHeight(playAreaElement);

    if (!viewportHeight || viewportHeight <= 0) {
      return 0;
    }

    naturalHeight = width / ASPECT_RATIO;

    if (naturalHeight <= viewportHeight) {
      return 0;
    }

    return viewportHeight;
  }

  /**
   * @param {HTMLElement} rootElement
   * @returns {{width: number, height: number, scale: number, fontSize: number, maxHeightPx: number, heightPx: string, widthPx: string}}
   */
  function getLayoutDimensions(rootElement) {
    var width = getMeasureWidth(rootElement);
    var layoutWidth;
    var maxHeightPx;
    var height;
    var heightForScale;
    var scale;

    if (!width || width <= 0) {
      width = BASE_WIDTH;
    }

    maxHeightPx = getPlayAreaMaxHeight(rootElement, width);
    layoutWidth = width;

    if (maxHeightPx > 0 && layoutWidth / maxHeightPx > ASPECT_RATIO) {
      layoutWidth = maxHeightPx * ASPECT_RATIO;
    }

    height = getExplicitHeight(layoutWidth, maxHeightPx);
    heightForScale = maxHeightPx > 0 ? maxHeightPx : 0;
    scale = getScale(layoutWidth, heightForScale);

    return {
      width: layoutWidth,
      height: height,
      scale: scale,
      fontSize: getScaledFontSize(layoutWidth, heightForScale),
      maxHeightPx: maxHeightPx,
      heightPx: height + 'px',
      widthPx: (maxHeightPx > 0 && layoutWidth < width) ?
        (Math.round(layoutWidth) + 'px') :
        '100%'
    };
  }

  return {
    BASE_WIDTH: BASE_WIDTH,
    BASE_HEIGHT: BASE_HEIGHT,
    ASPECT_RATIO: ASPECT_RATIO,
    BASE_FONT_SIZE: BASE_FONT_SIZE,
    MIN_SCALE: MIN_SCALE,
    MAX_SCALE: MAX_SCALE,
    getDesignSize: getDesignSize,
    getScale: getScale,
    getScaledFontSize: getScaledFontSize,
    getExplicitHeight: getExplicitHeight,
    getMeasureWidth: getMeasureWidth,
    getMeasureViewportHeight: getMeasureViewportHeight,
    isFullscreenContext: isFullscreenContext,
    getPlayAreaMaxHeight: getPlayAreaMaxHeight,
    getLayoutDimensions: getLayoutDimensions
  };
})();
