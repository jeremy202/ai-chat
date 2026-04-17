(function conciergeBootstrap() {
  var existing = document.getElementById('ai-concierge-assistant-widget-launcher');
  if (existing) return;

  function resolveScriptTag() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var candidate = scripts[i];
      var src = candidate && candidate.getAttribute && candidate.getAttribute('src');
      if (!src) continue;
      if (src.indexOf('widget.js') !== -1 || src.indexOf('/widget.js') !== -1) {
        return candidate;
      }
    }
    return null;
  }

  var script = resolveScriptTag();
  var businessSlug =
    (script && (script.getAttribute('data-business') || script.getAttribute('data-business-slug'))) ||
    (script && script.dataset && (script.dataset.business || script.dataset.businessSlug)) ||
    'demo-hospitality-business';
  var baseUrl =
    (script && (script.getAttribute('data-host') || script.getAttribute('data-base-url'))) ||
    (script && script.src && (function () { try { return new URL(script.src).origin; } catch (_) { return script.src.replace(/\/widget\.js.*$/, ''); } })()) ||
    window.location.origin;
  var apiBase =
    (script && script.getAttribute('data-api')) ||
    (script && script.dataset && script.dataset.api) ||
    baseUrl.replace(/\/$/, '') + '/api';
  var position =
    (script && script.getAttribute('data-position')) ||
    (script && script.dataset && script.dataset.position) ||
    'bottom-right';
  var theme =
    (script && script.getAttribute('data-theme')) ||
    (script && script.dataset && script.dataset.theme) ||
    '#0F766E';

  var offsetSide = position.indexOf('left') !== -1 ? 'left' : 'right';
  var launcher = document.createElement('button');
  launcher.id = 'ai-concierge-assistant-widget-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open AI Concierge Assistant');
  launcher.innerHTML = '<span style="font-size:18px;line-height:1;">&#10022;</span><span>Ask our concierge</span>';

  Object.assign(launcher.style, {
    position: 'fixed',
    bottom: '24px',
    zIndex: '2147483646',
    border: '0',
    borderRadius: '999px',
    background: theme,
    color: '#ffffff',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
    cursor: 'pointer',
  });
  launcher.style[offsetSide] = '24px';

  var iframe = document.createElement('iframe');
  iframe.title = 'AI Concierge Assistant';
  iframe.allow = 'clipboard-write';
  iframe.src =
    baseUrl.replace(/\/$/, '') +
    '/widget/' +
    encodeURIComponent(businessSlug) +
    '?apiBase=' +
    encodeURIComponent(apiBase.replace(/\/$/, ''));

  Object.assign(iframe.style, {
    position: 'fixed',
    bottom: '88px',
    width: 'min(420px, calc(100vw - 32px))',
    height: 'min(720px, calc(100vh - 128px))',
    border: '0',
    borderRadius: '24px',
    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.28)',
    overflow: 'hidden',
    zIndex: '2147483645',
    backgroundColor: '#ffffff',
    display: 'none',
  });
  iframe.style[offsetSide] = '24px';

  function isOpen() {
    return iframe.style.display !== 'none';
  }

  function openWidget() {
    iframe.style.display = 'block';
    launcher.style.transform = 'scale(0.98)';
  }

  function closeWidget() {
    iframe.style.display = 'none';
    launcher.style.transform = 'scale(1)';
  }

  launcher.addEventListener('click', function () {
    if (isOpen()) {
      closeWidget();
    } else {
      openWidget();
    }
  });

  window.addEventListener('message', function (event) {
    if (event.source !== iframe.contentWindow) return;
    if (event.data && event.data.type === 'AI_CONCIERGE_CLOSE_WIDGET') {
      closeWidget();
    }
  });

  function mount() {
    if (!document.body) return;

    var host = document.createElement('div');
    host.id = 'ai-concierge-assistant-widget-host';
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483644';

    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : null;
    if (shadow) {
      var wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.inset = '0';
      wrapper.style.pointerEvents = 'none';
      wrapper.appendChild(iframe);
      wrapper.appendChild(launcher);
      launcher.style.pointerEvents = 'auto';
      iframe.style.pointerEvents = 'auto';
      shadow.appendChild(wrapper);
      document.body.appendChild(host);
      return;
    }

    launcher.style.pointerEvents = 'auto';
    iframe.style.pointerEvents = 'auto';
    document.body.appendChild(launcher);
    document.body.appendChild(iframe);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
