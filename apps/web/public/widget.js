(function conciergeBootstrap() {
  var existing = document.getElementById('ai-concierge-assistant-widget-launcher');
  if (existing) return;

  var script = document.currentScript;
  var businessSlug =
    (script && (script.getAttribute('data-business') || script.getAttribute('data-business-slug'))) ||
    (script && script.dataset && (script.dataset.business || script.dataset.businessSlug)) ||
    'demo-hospitality-business';
  var baseUrl =
    (script && (script.getAttribute('data-host') || script.getAttribute('data-base-url'))) ||
    (script && script.src && script.src.replace(/\/widget\.js.*$/, '')) ||
    window.location.origin;
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
  iframe.src = baseUrl.replace(/\/$/, '') + '/widget/' + encodeURIComponent(businessSlug);

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
    if (event.data && event.data.type === 'AI_CONCIERGE_CLOSE_WIDGET') {
      closeWidget();
    }
  });

  document.body.appendChild(launcher);
  document.body.appendChild(iframe);
})();
