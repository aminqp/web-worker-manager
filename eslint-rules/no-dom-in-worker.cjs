/**
 * Custom ESLint rule: no-dom-in-worker
 *
 * Flags usage of browser main-thread-only APIs that are NOT available
 * inside Web Workers (DedicatedWorker, SharedWorker, ServiceWorker).
 *
 * Safe in workers: self, postMessage, fetch, setTimeout, setInterval,
 *   performance, console, crypto, indexedDB, caches, WebSockets, etc.
 *
 * NOT safe in workers: document, window, navigator (partially),
 *   localStorage, sessionStorage, alert/confirm/prompt, DOM constructors,
 *   DOM element methods, history, location (partially), screen, etc.
 */

/** Global identifiers that are unavailable in Web Workers */
const FORBIDDEN_GLOBALS = new Set([
  'document',
  'window',
  'alert',
  'confirm',
  'prompt',
  'localStorage',
  'sessionStorage',
  'history',
  'screen',
  'frames',
  'parent',
  'top',
  'opener',
  'frameElement',
  'getComputedStyle',
  'matchMedia',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'scrollTo',
  'scrollBy',
  'scroll',
  'resizeTo',
  'resizeBy',
  'moveTo',
  'moveBy',
  'focus',
  'blur',
  'print',
  'stop',
  'open',
  'close',
]);

/**
 * DOM constructor names unavailable in workers.
 * e.g. new HTMLElement(), new Document(), new Event() is fine but
 * new HTMLDivElement() is not.
 */
const FORBIDDEN_CONSTRUCTORS = new Set([
  'HTMLElement',
  'HTMLDivElement',
  'HTMLSpanElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'HTMLAnchorElement',
  'HTMLImageElement',
  'HTMLCanvasElement', // regular Canvas; OffscreenCanvas IS allowed
  'HTMLVideoElement',
  'HTMLAudioElement',
  'HTMLTableElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'SVGElement',
  'Document',
  'Window',
  'Navigator',
  'Element',
  'Node',
  'NodeList',
  'HTMLCollection',
  'MutationObserver',
  'IntersectionObserver',
  'ResizeObserver',
  'PerformanceObserver', // available in workers, but flag to be safe
  'XPathResult',
  'Range',
  'Selection',
  'TreeWalker',
  'NodeIterator',
  'DOMParser',
  'XMLSerializer',
  'CSSStyleDeclaration',
  'CSSRule',
  'StyleSheet',
  'MediaQueryList',
  'Screen',
  'History',
  'Location',
  'Storage',
  'Clipboard',
  'Notification', // constructor exists but requires window context
]);

/**
 * Member expressions whose object is a known forbidden global.
 * e.g. document.querySelector, window.location, navigator.geolocation
 */
const FORBIDDEN_MEMBER_OBJECTS = new Set([
  'document',
  'window',
  'localStorage',
  'sessionStorage',
  'history',
  'screen',
  'navigator', // navigator itself is partially available; flag member access
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow browser main-thread-only APIs inside Web Worker files',
      category: 'Web Workers',
      recommended: true,
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers',
    },
    schema: [],
    messages: {
      forbiddenGlobal:
        "'{{name}}' is not available inside Web Workers. " +
        'Web Workers run in a separate thread without access to the main-thread DOM. ' +
        "Use worker-safe alternatives (e.g. 'self', 'postMessage', 'fetch', 'indexedDB') " +
        'or move this logic to the main thread and communicate via messages. ' +
        'See: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers',
      forbiddenConstructor:
        "'new {{name}}(...)' is not available inside Web Workers. " +
        'DOM constructors require a browsing context that workers do not have. ' +
        "If you need to manipulate DOM elements, send a message to the main thread via 'postMessage' and handle it there. " +
        'See: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers',
      forbiddenMember:
        "'{{object}}.{{property}}' is not available inside Web Workers. " +
        "'{{object}}' is a main-thread-only global that does not exist in worker scope. " +
        "Pass required data into the worker via 'postMessage' instead of accessing it directly. " +
        'See: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers',
    },
  },

  create(context) {
    return {
      // Flag standalone identifiers that are forbidden globals
      // e.g. `alert()`, `localStorage` used directly (not as `document.X`)
      Identifier(node) {
        if (!FORBIDDEN_GLOBALS.has(node.name)) return;

        const parent = node.parent;

        // Skip property keys in member expressions / object literals / class methods
        if (
          parent.type === 'MemberExpression' &&
          parent.property === node &&
          !parent.computed
        )
          return;
        if (parent.type === 'Property' && parent.key === node) return;
        if (parent.type === 'MethodDefinition' && parent.key === node) return;

        // Skip when this identifier is the *object* of a MemberExpression that
        // is already in FORBIDDEN_MEMBER_OBJECTS — the MemberExpression handler
        // will report a richer message for that case (e.g. document.querySelector).
        if (
          parent.type === 'MemberExpression' &&
          parent.object === node &&
          FORBIDDEN_MEMBER_OBJECTS.has(node.name)
        ) {
          return;
        }

        context.report({
          node,
          messageId: 'forbiddenGlobal',
          data: { name: node.name },
        });
      },

      // Flag `new ForbiddenConstructor()`
      NewExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'Identifier' &&
          FORBIDDEN_CONSTRUCTORS.has(callee.name)
        ) {
          context.report({
            node,
            messageId: 'forbiddenConstructor',
            data: { name: callee.name },
          });
        }
      },

      // Flag member access on forbidden objects: document.X, window.X, etc.
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          FORBIDDEN_MEMBER_OBJECTS.has(node.object.name)
        ) {
          const property =
            node.property.type === 'Identifier'
              ? node.property.name
              : node.computed
                ? '<computed>'
                : '?';

          context.report({
            node,
            messageId: 'forbiddenMember',
            data: {
              object: node.object.name,
              property,
            },
          });
        }
      },
    };
  },
};
