/* ============================================================
   E-LAB — 成員頁共用核心（people.html / alumni.html 共用單一份）
   目的：卡片渲染、就地展開、資料抓取、轉義只存在一份程式碼，
        避免兩頁複製貼上造成「改一處漏一處」的 bug。
   使用：頁面載入本檔後呼叫 ELab.mount({...})，見檔尾說明。
   ============================================================ */
(function (global) {
  'use strict';

  var ENDPOINT = 'https://www.entrepreneurship-lab.com/_functions/people';
  var PROFILE = 'researcher.html?m=';

  /* ---------- 安全：CMS 字串進 DOM 前一律轉義；媒體 ID 走白名單 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mediaId(s) {
    return /^[\w./~-]+$/.test(String(s || '')) ? String(s) : '';
  }
  /* crop："x,y,w,h"（原圖像素座標）＝非破壞性裁切（遠照救近照）；
     格式不符白名單即忽略、退回預設 fill，確保壞資料不會組出壞網址 */
  function photoUrl(id, crop) {
    var pid = mediaId(id);
    if (!pid) return '';
    var m = /^(\d+),(\d+),(\d+),(\d+)$/.exec(String(crop || ''));
    if (m) {
      return 'https://static.wixstatic.com/media/' + pid +
        '/v1/crop/x_' + m[1] + ',y_' + m[2] + ',w_' + m[3] + ',h_' + m[4] + ',q_85/p.jpg';
    }
    return 'https://static.wixstatic.com/media/' + pid + '/v1/fill/w_600,h_750,q_85/p.jpg';
  }

  /* ---------- 卡片 ----------
     SR：連個人頁（對外代表，獨立網址有價值）
     其他：就地展開完整 bio（不跳頁、無獨立網址）        */
  function cardHTML(it) {
    var img = photoUrl(it.photo, it.photoCrop);
    var rl = String(it.role || ''), pg = String(it.program || '');
    var showPg = pg && pg !== 'External' && rl.toUpperCase().indexOf(pg.toUpperCase()) < 0;
    var roleLine = [rl, showPg ? pg : ''].filter(Boolean).join(' · ');
    var isSR = it.role === 'Senior Researcher';

    var isLM = it.role === 'Lab Manager';
    var tag = isSR ? '<span class="card__tag">Senior Researcher</span>'
                   : isLM ? '<span class="card__tag card__tag--lm">Lab Manager</span>'
                   : (it.gradLabel ? '<span class="card__tag card__tag--grad">' + esc(it.gradLabel) + '</span>' : '');
    var figure = '<div class="card__figure' + (img ? '' : ' noimg') + '">' + tag +
      (img ? '<img src="' + img + '" alt="Portrait of ' + esc(it.name) + '" loading="lazy" decoding="async">' : '') + '</div>';
    var head = '<div class="card__name">' + esc(it.name) + '</div>' +
      (roleLine ? '<div class="card__role">' + esc(roleLine) + '</div>' : '');
    /* Lab Manager 為行政聯絡窗口：卡片顯示 email（mailto 可點；其他角色端點不回傳 email）*/
    var mail = (isLM && it.email) ? '<a class="card__mail" href="mailto:' + esc(it.email) +
      '" aria-label="Email ' + esc(it.name) + '">&#9993;&nbsp;' + esc(it.email) + '</a>' : '';
    var blurb = it.blurb ? '<div class="card__blurb">' + esc(it.blurb) + '</div>' : '';

    if (isSR && it.showProfile !== false) {
      return '<a class="card card--sr" href="' + PROFILE + encodeURIComponent(it.id) +
        '" aria-label="View profile of ' + esc(it.name) + '">' + figure +
        '<div class="card__body">' + head + blurb +
        '<div class="card__cta">View profile <span class="arr">&#8594;</span></div></div></a>';
    }

    var paras = String(it.bio || '').split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var hl = String(it.highlights || '').split(/\s*[;·]\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    /* show_profile=false ＝「不公開此人詳細資料」：既不給個人頁連結，也不可就地展開
       （否則等於換個方式把完整 bio 攤開，違反該欄位的原意）*/
    var hasMore = it.showProfile !== false && (paras.length > 0 || hl.length > 0);
    var full = hasMore ? '<div class="card__full">' +
      paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      (hl.length ? '<div class="card__hl"><span class="card__hl-k">Highlights</span>' +
        hl.map(function (h) { return '<div class="card__hl-i">' + esc(h) + '</div>'; }).join('') + '</div>' : '') +
      '</div>' : '';
    var toggle = hasMore ? '<div class="card__cta">Read more <span class="arr">&#8595;</span></div>' : '';

    return '<div class="card' + (hasMore ? ' card--x' : '') + (isSR ? ' card--sr' : '') + (isLM ? ' card--lm' : '') + '"' +
      (hasMore ? ' role="button" tabindex="0" aria-expanded="false"' : '') + '>' +
      figure + '<div class="card__body">' + head + mail + blurb + full + toggle + '</div></div>';
  }

  /* ---------- 就地展開：點擊或鍵盤；同時只開一張 ---------- */
  function wireExpanders(root) {
    (root || document).querySelectorAll('.card--x').forEach(function (card) {
      if (card.dataset.wired) return;
      card.dataset.wired = '1';
      function setLabel(c, open) {
        var cta = c.querySelector('.card__cta');
        if (cta && cta.firstChild) cta.firstChild.textContent = open ? 'Show less ' : 'Read more ';
      }
      function toggle() {
        var willOpen = !card.classList.contains('open');
        if (willOpen) {
          document.querySelectorAll('.card--x.open').forEach(function (o) {
            o.classList.remove('open'); o.setAttribute('aria-expanded', 'false'); setLabel(o, false);
          });
        }
        card.classList.toggle('open', willOpen);
        card.setAttribute('aria-expanded', String(willOpen));
        setLabel(card, willOpen);
        if (willOpen) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      card.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) return;  /* 卡內連結（如 email）不觸發展開 */
        toggle();
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---------- 進場：捲動逐行顯現 ----------
     同一列卡片在同一批 IO 事件進入視口 → 批內遞延即成「由左向右」；
     下一列捲到才觸發 → 逐行出現。單欄（手機）時同批只有一張，自然逐張。
     出現一次後 unobserve（回捲不重演，找資料的訪客不被動畫拖慢）。 */
  var io = null;
  var STAGGER_MS = 70, STAGGER_CAP = 8;
  function showNow(c) {
    /* 定格顯示：跳過進場過渡但不留殘設定，hover 過渡兩幀後恢復 */
    c.style.transition = 'none';
    c.classList.add('in');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { c.style.transition = ''; });
    });
  }
  function getIO() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (en) { return en.isIntersecting; });
      batch.forEach(function (en, i) {
        io.unobserve(en.target);
        var d = Math.min(i, STAGGER_CAP) * STAGGER_MS;
        if (d) setTimeout(function () { en.target.classList.add('in'); }, d);
        else en.target.classList.add('in');
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -4% 0px' });
    return io;
  }
  /* fadeIn(root, {redraw:true}) ＝ 二段式渲染的第二畫（fallback→live）：
     訪客已看過視口內的內容，該範圍定格顯示不重演，僅視口以下保留捲動觸發 */
  function fadeIn(root, opts) {
    var redraw = !!(opts && opts.redraw);
    var cards = (root || document).querySelectorAll('.card:not(.in)');
    var rm = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in global) || rm) {
      cards.forEach(showNow);
      return;
    }
    if (redraw && io) io.disconnect();   /* 舊 render 的節點已被替換，觀察名單重建 */
    var vh = global.innerHeight || 800;
    cards.forEach(function (c) {
      if (redraw && c.getBoundingClientRect().top < vh) showNow(c);
      else getIO().observe(c);
    });
  }

  /* ---------- 資料 ---------- */
  function normalize(x) {
    return {
      id: x.id, name: x.name, role: x.role, program: x.program, status: x.status,
      blurb: x.blurb, bio: x.bio, highlights: x.highlights, photo: x.photo,
      nationality: x.nationality, gradYear: x.gradYear, gradLabel: x.gradLabel,
      order: x.order, showProfile: x.showProfile, email: x.email, photoCrop: x.photoCrop
    };
  }

  /* ---------- 成員排序（Alex 2026-08-09 拍板的正式規則） ----------
     Lab Manager 永遠第一 → Postdoc Researcher → 博士群（PhD Candidate、
     DBA Candidate、PhD Student 同屬一群，依資深程度）→ Master Students → 其他。
     同群內以 CMS 的 order 表達資深程度（小＝資深，排前）。 */
  var ROLE_RANK = {
    'Lab Manager': 0,
    'Postdoc Researcher': 1,
    'PhD Candidate': 2, 'DBA Candidate': 2, 'PhD Student': 2,
    'Master Student': 3
  };
  function roleRank(role) {
    return (role in ROLE_RANK) ? ROLE_RANK[role] : 4;
  }
  function sortMembers(list) {
    return list.slice().sort(function (a, b) {
      var r = roleRank(a.role) - roleRank(b.role);
      return r !== 0 ? r : ((a.order || 999) - (b.order || 999));
    });
  }

  /* mount({status, fallback, render})
     - status  : 'current' | 'alumni'（要顯示的族群）
     - fallback: 端點不可用時的內建名單（已是 normalize 後的格式）
     - render  : function(list) 由各頁決定版面（分區／分年份）
     先以 fallback 畫一次（頁面立即有內容），端點成功再以即時資料重畫。 */
  function mount(opts) {
    /* endpoint 可覆寫：供本機以假資料做邊界情境測試（?mock=xxx.json）*/
    var url = opts.endpoint || ENDPOINT;
    var drew = false;
    var draw = function (list) {
      var redraw = drew;           /* 第二次呼叫＝fallback→live 重畫 */
      drew = true;
      opts.render(list);
      wireExpanders();
      fadeIn(null, { redraw: redraw });
    };
    if (opts.fallback && opts.fallback.length) {
      /* 暫存畫面（fallback）不掃光：live 重畫會打斷掃到一半的動畫，
         故 html.presweep 抑制之，待資料定案（成功或失敗）才解除、掃一次 */
      document.documentElement.classList.add('presweep');
      draw(opts.fallback);
    }
    var settle = function (ok) {
      document.documentElement.classList.remove('presweep');
      return ok;
    };

    return fetch(url, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.items)) { if (!drew) draw([]); return false; }
        var live = d.items.filter(function (x) { return x.status === opts.status; }).map(normalize);
        /* 端點成功回應即採用——不設「至少 N 筆」門檻：
           實驗室縮編到 4 人、或某年只有少數校友時，門檻會讓頁面永遠停在舊資料。
           唯一例外：live 為空但已有 fallback 畫面時保留 fallback，避免畫面突然清空。*/
        if (live.length === 0 && opts.fallback && opts.fallback.length) return false;
        draw(live);
        return true;
      })
      .catch(function () { if (!drew) draw([]); return false; })   /* 無 fallback 時仍要 render，讓頁面顯示空狀態而非全白 */
      .then(settle);
  }

  global.ELab = {
    esc: esc, mediaId: mediaId, photoUrl: photoUrl,
    cardHTML: cardHTML, wireExpanders: wireExpanders, fadeIn: fadeIn,
    sortMembers: sortMembers, mount: mount, ENDPOINT: ENDPOINT, PROFILE: PROFILE
  };
})(window);
