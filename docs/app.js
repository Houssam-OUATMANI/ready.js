/**
 * ready.ts Documentation Site - Interactive Island App
 */

document.addEventListener('DOMContentLoaded', () => {
  initCopyButtons();
  initPackageManagerSwitcher();
  initSimulator();
  initSearchModal();
  initScrollSpy();
  initEditorTabs();
});

// Toast notification helper
function showToast(message = 'Copied to clipboard!') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast-island';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// 1. One-click Code Copy
function initCopyButtons() {
  document.querySelectorAll('.copy-btn, .copy-mini-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const codeTarget = btn.getAttribute('data-target');
      let textToCopy = '';

      if (codeTarget) {
        const targetEl = document.querySelector(codeTarget);
        if (targetEl) textToCopy = targetEl.innerText.trim();
      } else {
        const pre = btn.closest('.code-island')?.querySelector('pre');
        if (pre) textToCopy = pre.innerText.trim();
      }

      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          btn.classList.add('copied');
          const originalText = btn.innerHTML;
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Copied!</span>
          `;
          showToast('Snippet copied to clipboard!');
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalText;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy', err);
        }
      }
    });
  });
}

// 2. Package Manager Switcher
function initPackageManagerSwitcher() {
  const pmCommands = {
    bun: 'bun add ready.ts',
    npm: 'npm install ready.ts',
    pnpm: 'pnpm add ready.ts',
    yarn: 'yarn add ready.ts',
    deno: 'deno add npm:ready.ts'
  };

  const installCode = document.getElementById('pm-install-code');
  const heroCode = document.getElementById('hero-pm-code');
  const buttons = document.querySelectorAll('.pm-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pm = btn.getAttribute('data-pm');
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cmd = pmCommands[pm] || pmCommands.bun;
      if (installCode) installCode.textContent = cmd;
      if (heroCode) heroCode.textContent = cmd;
    });
  });
}

// 3. Interactive Live Playground Simulator
function initSimulator() {
  const methodSelect = document.getElementById('sim-method');
  const urlInput = document.getElementById('sim-url');
  const sendBtn = document.getElementById('sim-send-btn');
  const statusBadge = document.getElementById('sim-res-status');
  const timeBadge = document.getElementById('sim-res-time');
  const bodyPreview = document.getElementById('sim-res-body');
  const headersPreview = document.getElementById('sim-res-headers');
  const coercionPreview = document.getElementById('sim-coercion-info');
  const presetSelect = document.getElementById('sim-preset');

  const presets = {
    'user-get': {
      method: 'GET',
      url: '/api/users/42?limit=10',
      handler: (params, query) => {
        const id = Number(params.id);
        const limit = Number(query.limit ?? 10);
        return {
          status: 200,
          data: {
            id,
            limit,
            name: `User #${id}`,
            role: 'Developer',
            active: true
          },
          coercions: [
            { expr: 'c.req.param<number>("id")', raw: `"${params.id}"`, coerced: id, type: typeof id },
            { expr: 'c.req.query<number>("limit")', raw: `"${query.limit}"`, coerced: limit, type: typeof limit }
          ]
        };
      }
    },
    'user-post': {
      method: 'POST',
      url: '/api/users',
      handler: () => {
        return {
          status: 201,
          data: {
            id: 104,
            name: 'Sarah Connor',
            email: 'sarah@skynet-defense.org',
            createdAt: new Date().toISOString()
          },
          coercions: [
            { expr: 'await c.req.body<CreateUserDto>()', raw: '{"name":"Sarah Connor", ...}', coerced: '{ name: "Sarah...", email: "..." }', type: 'object (typed DTO)' }
          ]
        };
      }
    },
    'auth-fail': {
      method: 'GET',
      url: '/api/admin/metrics',
      handler: () => {
        return {
          status: 401,
          data: {
            error: 'Unauthorized',
            message: 'Missing or invalid Authorization header in request context',
            statusCode: 401
          },
          coercions: [
            { expr: 'c.req.header("Authorization")', raw: 'undefined', coerced: 'null', type: 'middleware reject' }
          ]
        };
      }
    },
    'not-found': {
      method: 'GET',
      url: '/api/unknown-endpoint',
      handler: () => {
        return {
          status: 404,
          data: {
            error: 'Not Found',
            message: 'No route matched the Radix Tree pattern',
            path: '/api/unknown-endpoint',
            statusCode: 404
          },
          coercions: [
            { expr: 'app.onNotFound()', raw: '/api/unknown-endpoint', coerced: 'Radix Trie: miss', type: '404' }
          ]
        };
      }
    }
  };

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const selected = presets[presetSelect.value];
      if (selected) {
        if (methodSelect) methodSelect.value = selected.method;
        if (urlInput) urlInput.value = selected.url;
        triggerSimulate();
      }
    });
  }

  function triggerSimulate() {
    const method = methodSelect ? methodSelect.value : 'GET';
    const rawUrl = urlInput ? urlInput.value.trim() : '/api/users/42?limit=10';

    // Simulate network delay & Onion middleware response time
    const fakeLatency = (Math.random() * 0.8 + 0.15).toFixed(2);

    let presetKey = 'user-get';
    if (rawUrl.includes('/admin')) presetKey = 'auth-fail';
    else if (rawUrl.includes('/unknown') || rawUrl.includes('/404')) presetKey = 'not-found';
    else if (method === 'POST') presetKey = 'user-post';

    // Extract dynamic params if URL matches /api/users/:id
    const userMatch = rawUrl.match(/\/api\/users\/([^?]+)/);
    const idParam = userMatch ? userMatch[1] : '42';
    const urlObj = new URL('http://localhost' + (rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl));
    const queryParams = Object.fromEntries(urlObj.searchParams.entries());

    let simResult;
    if (presetKey === 'user-get') {
      simResult = presets['user-get'].handler({ id: idParam }, queryParams);
    } else {
      simResult = presets[presetKey].handler({ id: idParam }, queryParams);
    }

    // Update status badge
    if (statusBadge) {
      statusBadge.textContent = `${simResult.status} ${simResult.status === 200 ? 'OK' : simResult.status === 201 ? 'Created' : simResult.status === 401 ? 'Unauthorized' : 'Not Found'}`;
      statusBadge.className = 'editor-meta-badge';
      if (simResult.status >= 400) {
        statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBadge.style.color = '#ef4444';
        statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      } else {
        statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBadge.style.color = '#10b981';
        statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      }
    }

    if (timeBadge) timeBadge.textContent = `${fakeLatency}ms`;

    if (bodyPreview) {
      bodyPreview.textContent = JSON.stringify(simResult.data, null, 2);
    }

    if (headersPreview) {
      headersPreview.textContent = 
`Content-Type: application/json; charset=utf-8
X-Response-Time: ${fakeLatency}ms
X-Powered-By: ready.ts Micro-Framework (v1.0.3)
Access-Control-Allow-Origin: *`;
    }

    if (coercionPreview) {
      coercionPreview.innerHTML = simResult.coercions.map(c => `
        <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06)">
          <div style="color: var(--accent-cyan); font-weight: 600;">${c.expr}</div>
          <div style="color: var(--text-muted); font-size: 0.76rem;">
            Raw string: <code style="color: var(--syn-string);">${c.raw}</code> ➔ 
            Coerced to: <code style="color: var(--syn-number);">${c.coerced}</code> (${c.type})
          </div>
        </div>
      `).join('');
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', triggerSimulate);
  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerSimulate();
    });
  }

  // Trigger initial preview
  triggerSimulate();
}

// 4. Quick Search Modal (Cmd/Ctrl + K)
function initSearchModal() {
  const modal = document.getElementById('search-modal');
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');
  const openButtons = document.querySelectorAll('.dock-search-btn');

  const searchableIndex = [
    { title: 'Overview & Philosophy', section: '#overview', badge: 'Core' },
    { title: 'Installation (Bun, Node, Deno)', section: '#installation', badge: 'Setup' },
    { title: 'Quick Start Guide', section: '#quickstart', badge: 'Guide' },
    { title: 'Request Object (c.req)', section: '#request', badge: 'API' },
    { title: 'Typed Parameter Coercion: c.req.param<T>()', section: '#request-param', badge: 'Types' },
    { title: 'Query Parsing & Coercion: c.req.query<T>()', section: '#request-query', badge: 'Types' },
    { title: 'Generic JSON Body: c.req.body<T>()', section: '#request-body', badge: 'Types' },
    { title: 'Context Object (c.json, c.status, c.header)', section: '#context', badge: 'API' },
    { title: 'State Sharing: c.set() & c.get()', section: '#context-state', badge: 'Context' },
    { title: 'Radix Tree Routing & Parameters', section: '#routing', badge: 'Router' },
    { title: 'Modular Sub-Applications (app.route)', section: '#subrouting', badge: 'Router' },
    { title: 'Onion Middleware Architecture', section: '#middleware', badge: 'Pipeline' },
    { title: 'Centralized Error Handling (app.onError)', section: '#error-handling', badge: 'Handlers' },
    { title: 'Multi-Runtime Execution (Bun, Node, Deno, Edge)', section: '#runtimes', badge: 'Adapters' },
    { title: 'Interactive Simulator Playground', section: '#simulator', badge: 'Tool' },
    { title: 'Benchmarks & Performance Comparison', section: '#benchmarks', badge: 'Stats' },
    { title: 'Complete Type Exports & TypeScript DX', section: '#types', badge: 'Types' }
  ];

  function openModal() {
    if (!modal) return;
    modal.classList.add('open');
    if (searchInput) {
      searchInput.value = '';
      renderResults('');
      setTimeout(() => searchInput.focus(), 50);
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
  }

  openButtons.forEach(btn => btn.addEventListener('click', openModal));

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (modal?.classList.contains('open')) {
        closeModal();
      } else {
        openModal();
      }
    }
    if (e.key === 'Escape' && modal?.classList.contains('open')) {
      closeModal();
    }
  });

  function renderResults(query) {
    if (!resultsContainer) return;
    const q = query.toLowerCase().trim();
    const filtered = searchableIndex.filter(item => 
      item.title.toLowerCase().includes(q) || item.badge.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 0.9rem;">
          No matching documentation topics found.
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = filtered.map((item, idx) => `
      <a href="${item.section}" class="search-item ${idx === 0 ? 'selected' : ''}" data-target="${item.section}">
        <span class="search-item-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          ${item.title}
        </span>
        <span class="search-item-badge">${item.badge}</span>
      </a>
    `).join('');

    resultsContainer.querySelectorAll('.search-item').forEach(link => {
      link.addEventListener('click', () => {
        closeModal();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderResults(e.target.value);
    });
  }
}

// 5. ScrollSpy for Sidebar & Floating Dock
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const dockLinks = document.querySelectorAll('.dock-nav-link');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 140;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    if (currentId) {
      sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === `#${currentId}`) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      dockLinks.forEach(link => {
        if (link.getAttribute('href') === `#${currentId}`) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
  }, { passive: true });
}

// 6. Interactive Editor Showcase Tabs
function initEditorTabs() {
  const tabs = document.querySelectorAll('.editor-tab');
  const snippets = {
    'server.ts': `<span class="kw">import</span> { Ready } <span class="kw">from</span> <span class="str">"ready.ts"</span>;

<span class="kw">const</span> app = <span class="kw">new</span> <span class="typ">Ready</span>();

<span class="cmt">// Global onion middleware</span>
app.<span class="fn">use</span>(<span class="kw">async</span> (c, next) => {
  <span class="kw">const</span> start = performance.<span class="fn">now</span>();
  <span class="kw">await</span> <span class="fn">next</span>();
  <span class="kw">const</span> ms = (performance.<span class="fn">now</span>() - start).<span class="fn">toFixed</span>(<span class="num">2</span>);
  c.<span class="fn">header</span>(<span class="str">"X-Response-Time"</span>, <span class="str">\`\${ms}ms\`</span>);
});

<span class="cmt">// GET route with typed auto-coercion</span>
app.<span class="fn">get</span>(<span class="str">"/api/users/:id"</span>, (c) => {
  <span class="kw">const</span> id = c.req.<span class="fn">param</span>&lt;<span class="typ">number</span>&gt;(<span class="str">"id"</span>);       <span class="cmt">// 42 (number)</span>
  <span class="kw">const</span> limit = c.req.<span class="fn">query</span>&lt;<span class="typ">number</span>&gt;(<span class="str">"limit"</span>) ?? <span class="num">10</span>;

  <span class="kw">return</span> c.<span class="fn">json</span>({ id, limit, name: <span class="str">\`User #\${id}\`</span> });
});

<span class="cmt">// Multi-runtime server startup</span>
<span class="kw">await</span> app.<span class="fn">listen</span>({ port: <span class="num">3000</span> });`,

    'routes.ts': `<span class="kw">import</span> { Ready } <span class="kw">from</span> <span class="str">"ready.ts"</span>;

<span class="cmt">// Modular sub-router</span>
<span class="kw">export const</span> authRouter = <span class="kw">new</span> <span class="typ">Ready</span>();

authRouter.<span class="fn">post</span>(<span class="str">"/login"</span>, <span class="kw">async</span> (c) => {
  <span class="kw">const</span> creds = <span class="kw">await</span> c.req.<span class="fn">body</span>&lt;<span class="typ">Credentials</span>&gt;();
  <span class="kw">return</span> c.<span class="fn">json</span>({ token: <span class="str">"jwt-sec-token"</span> });
});

authRouter.<span class="fn">post</span>(<span class="str">"/logout"</span>, (c) => {
  <span class="kw">return</span> c.<span class="fn">json</span>({ ok: <span class="num">true</span> });
});

<span class="cmt">// Mount to parent app</span>
<span class="cmt">// app.route("/api/auth", authRouter);</span>`,

    'middleware.ts': `<span class="kw">import</span> { Ready, <span class="kw">type</span> <span class="typ">Middleware</span> } <span class="kw">from</span> <span class="str">"ready.ts"</span>;

<span class="cmt">// Path-scoped JWT guard</span>
<span class="kw">export const</span> jwtAuth: <span class="typ">Middleware</span> = <span class="kw">async</span> (c, next) => {
  <span class="kw">const</span> auth = c.req.<span class="fn">header</span>(<span class="str">"Authorization"</span>);
  <span class="kw">if</span> (!auth?.<span class="fn">startsWith</span>(<span class="str">"Bearer "</span>)) {
    <span class="kw">return</span> c.<span class="fn">json</span>({ error: <span class="str">"Unauthorized"</span> }, <span class="num">401</span>);
  }
  
  c.<span class="fn">set</span>(<span class="str">"userId"</span>, <span class="num">42</span>); <span class="cmt">// Context state sharing</span>
  <span class="kw">await</span> <span class="fn">next</span>();
};`
  };

  const editorBody = document.getElementById('hero-editor-code');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filename = tab.getAttribute('data-tab');
      if (editorBody && snippets[filename]) {
        editorBody.innerHTML = snippets[filename];
      }
    });
  });
}
