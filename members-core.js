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
  function photoUrl(id) {
    var pid = mediaId(id);
    return pid ? 'https://static.wixstatic.com/media/' + pid + '/v1/fill/w_600,h_750,q_85/p.jpg' : '';
  }

  /* ---------- 卡片 ----------
     SR：連個人頁（對外代表，獨立網址有價值）
     其他：就地展開完整 bio（不跳頁、無獨立網址）        */
  function cardHTML(it) {
    var img = photoUrl(it.photo);
    var rl = String(it.role || ''), pg = String(it.program || '');
    var showPg = pg && pg !== 'External' && rl.toUpperCase().indexOf(pg.toUpperCase()) < 0;
    var roleLine = [rl, showPg ? pg : ''].filter(Boolean).join(' · ');
    var isSR = it.role === 'Senior Researcher';

    var tag = isSR ? '<span class="card__tag">Senior Researcher</span>'
                   : (it.gradLabel ? '<span class="card__tag card__tag--grad">' + esc(it.gradLabel) + '</span>' : '');
    var figure = '<div class="card__figure' + (img ? '' : ' noimg') + '">' + tag +
      (img ? '<img src="' + img + '" alt="Portrait of ' + esc(it.name) + '" loading="lazy" decoding="async">' : '') + '</div>';
    var head = '<div class="card__name">' + esc(it.name) + '</div>' +
      (roleLine ? '<div class="card__role">' + esc(roleLine) + '</div>' : '');
    var blurb = it.blurb ? '<div class="card__blurb">' + esc(it.blurb) + '</div>' : '';

    if (isSR && it.showProfile !== false) {
      return '<a class="card" href="' + PROFILE + encodeURIComponent(it.id) +
        '" aria-label="View profile of ' + esc(it.name) + '">' + figure +
        '<div class="card__body">' + head + blurb +
        '<div class="card__cta">View profile <span class="arr">&#8594;</span></div></div></a>';
    }

    var paras = String(it.bio || '').split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var hl = String(it.highlights || '').split(/\s*[;·]\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    var hasMore = paras.length > 0 || hl.length > 0;
    var full = hasMore ? '<div class="card__full">' +
      paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      (hl.length ? '<div class="card__hl"><span class="card__hl-k">Highlights</span>' +
        hl.map(function (h) { return '<div class="card__hl-i">' + esc(h) + '</div>'; }).join('') + '</div>' : '') +
      '</div>' : '';
    var toggle = hasMore ? '<div class="card__cta">Read more <span class="arr">&#8595;</span></div>' : '';

    return '<div class="card' + (hasMore ? ' card--x' : '') + '"' +
      (hasMore ? ' role="button" tabindex="0" aria-expanded="false"' : '') + '>' +
      figure + '<div class="card__body">' + head + blurb + full + toggle + '</div></div>';
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
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---------- 進場淡入 ---------- */
  function fadeIn(root) {
    requestAnimationFrame(function () {
      (root || document).querySelectorAll('.card:not(.in)').forEach(function (c, i) {
        setTimeout(function () { c.classList.add('in'); }, Math.min(i, 12) * 55);
      });
    });
  }

  /* ---------- 資料 ---------- */
  function normalize(x) {
    return {
      id: x.id, name: x.name, role: x.role, program: x.program, status: x.status,
      blurb: x.blurb, bio: x.bio, highlights: x.highlights, photo: x.photo,
      nationality: x.nationality, gradYear: x.gradYear, gradLabel: x.gradLabel,
      order: x.order, showProfile: x.showProfile
    };
  }

  /* mount({status, fallback, render})
     - status  : 'current' | 'alumni'（要顯示的族群）
     - fallback: 端點不可用時的內建名單（已是 normalize 後的格式）
     - render  : function(list) 由各頁決定版面（分區／分年份）
     先以 fallback 畫一次（頁面立即有內容），端點成功再以即時資料重畫。 */
  function mount(opts) {
    var draw = function (list) {
      opts.render(list);
      wireExpanders();
      fadeIn();
    };
    if (opts.fallback && opts.fallback.length) draw(opts.fallback);

    return fetch(ENDPOINT, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.items)) return false;
        var live = d.items.filter(function (x) { return x.status === opts.status; }).map(normalize);
        /* 至少 5 筆才採用，避免端點半殘時開天窗 */
        if (live.length < 5) return false;
        draw(live);
        return true;
      })
      .catch(function () { return false; });
  }

  global.ELab = {
    esc: esc, mediaId: mediaId, photoUrl: photoUrl,
    cardHTML: cardHTML, wireExpanders: wireExpanders, fadeIn: fadeIn,
    mount: mount, ENDPOINT: ENDPOINT, PROFILE: PROFILE
  };
})(window);
