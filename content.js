// content.js

let NG_WORDS = [];
let NG_SHOPS = [];
let lastProcessedCount = 0; // Prevent flickering by tracking processed cards count
let enable2Col = false;
let enableCleanTitle = true;
let hideVRChatSection = false;

// Load initial config
chrome.storage.local.get({ ngWords: [], ngShops: [], enable2Col: false, enableCleanTitle: true, hideVRChatSection: false }, (data) => {
  NG_WORDS = data.ngWords || [];
  NG_SHOPS = data.ngShops || [];
  enable2Col = data.enable2Col;
  enableCleanTitle = data.enableCleanTitle;
  hideVRChatSection = data.hideVRChatSection;
  applyBodyClasses();
  hideVRChatRecommendSection();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
});

// Listen for updates from popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.ngWords) NG_WORDS = changes.ngWords.newValue || [];
    if (changes.ngShops) NG_SHOPS = changes.ngShops.newValue || [];
    
    // UI設定が変更された場合は、クリーンな状態を保つためにページをリロードする
    if (changes.enable2Col !== undefined || changes.enableCleanTitle !== undefined || changes.hideVRChatSection !== undefined) {
      window.location.reload();
      return;
    }

    const cards = getItemCards(document.body);
    cards.forEach(c => delete c.dataset.boothFilterProcessed); // Force re-eval
    lastProcessedCount = 0; // Reset count
    processCards(cards);
    sortContainers(cards);
  }
});

function isSearchPage() {
  const path = window.location.pathname;
  const search = window.location.search;
  // 検索結果ページ（/search/... または /items?...）を判定
  return path.includes('/search/') || (path.includes('/items') && search.length > 0);
}

// --- 実装機能 A：URLクエリの自動拡張 ---
function interceptSearch() {
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form) return;

    const isSearchForm = form.matches('form.item-search, form[action*="/search"]');
    if (!isSearchForm) return;

    const input = form.querySelector('input[name="query"], input[type="text"], input[type="search"]');
    if (!input || !input.value.trim()) return;

    e.preventDefault();

    const keyword = input.value.trim();
    
    let basePath = form.getAttribute('action');
    if (!basePath) {
      const langMatch = window.location.pathname.match(/^\/([a-z]{2})\//);
      const lang = langMatch ? langMatch[1] : 'ja';
      basePath = `/${lang}/search/`;
    } else if (!basePath.endsWith('/')) {
      basePath += '/';
    }

    const urlObj = new URL(window.location.origin + basePath + encodeURIComponent(keyword));

    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
      if (key !== 'query' && value) {
        urlObj.searchParams.append(key, value);
      }
    }

    const currentExceptWords = urlObj.searchParams.getAll('except_words[]');
    NG_WORDS.forEach(word => {
      if (!currentExceptWords.includes(word)) {
        urlObj.searchParams.append('except_words[]', word);
      }
    });

    window.location.href = urlObj.toString();
  }, true);
}


// --- 実装機能 B：DOMフィルタリング＆UI操作 ---
function getItemCards(root) {
  const cards = Array.from(root.querySelectorAll('li.item-card, .item-card-wrapper, .l-card'));
  
  const itemLinks = Array.from(root.querySelectorAll('a[href*="/items/"]'));
  itemLinks.forEach(link => {
    // div を除外。カードに近い具体的なクラスやタグのみを対象にする
    const container = link.closest('li, [class*="card"], [class*="wrapper"]');
    if (container && !cards.includes(container) && container !== root && container !== document.body) {
      cards.push(container);
    }
  });
  
  // 重複を除去
  const uniqueCards = [...new Set(cards)];
  // 入れ子構造を解消：他の要素に含まれている要素（内側の要素）を除外して、最上位のカード要素のみを残す
  return uniqueCards.filter(el => !uniqueCards.some(other => other !== el && other.contains(el)));
}

// JSの役割は、遅延読み込みの画像 URLを style.backgroundImage に注入することのみ。
// position: relative 含む全てのレイアウトは content.css に任せる。
function injectThumbnailUrls(card) {
  const thumbnails = card.querySelectorAll('.js-thumbnail-image');
  thumbnails.forEach((thumb) => {
    // 遅延読み込み URLを注入（未設定の場合のみ）
    if (thumb.dataset.original && !thumb.style.backgroundImage) {
      thumb.style.backgroundImage = `url("${thumb.dataset.original}")`;
    }
  });
}

function applyBodyClasses() {
  // 1列レイアウトは検索結果ページのみ適用
  if (enable2Col && isSearchPage()) {
    document.body.classList.add('booth-ext-2col');
    const cards = getItemCards(document.body);
    cards.forEach(card => injectThumbnailUrls(card));
  } else {
    document.body.classList.remove('booth-ext-2col');
    // オフの時は何もしない（BOOTH標準のスクリプトによる背景画像設定を上書き・クリアしない）
  }
  
  if (enableCleanTitle) {
    document.body.classList.add('booth-ext-clean-title');
  } else {
    document.body.classList.remove('booth-ext-clean-title');
  }
}

function cleanTitle(titleEl) {
  if (titleEl.dataset.boothFilterCleaned) return;
  if (titleEl.textContent.trim() === 'Loading...') return;
  
  const originalHTML = titleEl.innerHTML;
  
  // 初期の安全な置換ロジック（spanで囲んでCSSで隠す方式）に戻す
  // これにより、bodyクラスの着脱だけでON/OFFが瞬時に反映される
  const bracketNoiseRegex = /([【\[［(（<〈][^】\]］)）>〉]*?(?:セール中|期間限定|割引|対応)[】\]］)）>〉])/g;
  const symbolNoiseRegex = /([♦♥★✨■])/g;
  
  let newHTML = originalHTML.replace(symbolNoiseRegex, '<span class="booth-ext-noise">$1</span>');
  newHTML = newHTML.replace(bracketNoiseRegex, '<span class="booth-ext-noise">$1</span>');
  
  if (newHTML !== originalHTML) {
    titleEl.innerHTML = newHTML;
  }
  titleEl.dataset.boothFilterCleaned = 'true';
}

function processCards(cards) {
  cards.forEach(card => {
    // 【タイトル抽出】
    let titleEl = card.querySelector('.item-card__title-anchor--multiline, .item-card__title, [class*="title"]');
    
    if (card.dataset.boothFilterProcessed) {
      // 処理済みでもタイトルがLoadingから変わった可能性があるのでクレンジングを再確認
      if (titleEl) cleanTitle(titleEl);
      return;
    }

    let titleText = '';
    let shopText = '';
    let shopId = '';
    let shouldRemove = false;

    // 【タイトル抽出とクレンジング】
    if (titleEl) {
      titleText = titleEl.textContent;
      cleanTitle(titleEl);
    } else {
      const titleLink = Array.from(card.querySelectorAll('a[href*="/items/"]'))
        .find(a => a.textContent.trim().length > 0 && !a.querySelector('img'));
      if (titleLink) titleText = titleLink.textContent;
    }

    // 【ショップ名抽出】(フォローボタン等の混入を防ぐため、純粋な名前の要素を最優先)
    let shopNameEl = card.querySelector('.item-card__shop-name, .user-name, [class*="shop-name"]');
    let shopEl = shopNameEl || card.querySelector('.item-card__shop-info, [class*="shop"]');
    let shopLink = null;
    
    if (shopEl) {
      shopLink = shopEl.tagName === 'A' ? shopEl : shopEl.querySelector('a');
      // クローンを作成して「フォロー」などのボタンやバッジ要素を除去してからテキストを取得
      const clone = (shopNameEl || shopEl).cloneNode(true);
      const garbage = clone.querySelectorAll('button, .follow-button, [class*="follow"], .badge');
      garbage.forEach(el => el.remove());
      shopText = clone.textContent.trim();
    } 
    
    if (!shopLink || !shopText) {
      shopLink = Array.from(card.querySelectorAll('a')).find(a => {
        const href = a.href || '';
        return (href.includes('.booth.pm') || href.includes('/shops/')) && !href.includes('/items/') && a.textContent.trim().length > 0;
      });
      if (shopLink) shopText = shopLink.textContent;
    }

    if (shopLink && shopLink.href) {
      try {
        const url = new URL(shopLink.href);
        if (url.hostname.endsWith('.booth.pm') && url.hostname !== 'booth.pm') {
          shopId = url.hostname.split('.')[0];
        } else if (url.pathname.includes('/shops/')) {
          shopId = url.pathname.split('/').pop();
        }
      } catch (e) {}
    }
    
    const shopIdentifier = shopId || shopText.trim();

    // 未ロード状態の場合は処理を保留
    if (!titleText && !shopIdentifier) {
      return;
    }

    if (titleText) {
      for (const word of NG_WORDS) {
        if (titleText.includes(word)) {
          shouldRemove = true;
          break;
        }
      }
    }

    if (!shouldRemove && shopIdentifier) {
      for (const shop of NG_SHOPS) {
        if (shopIdentifier.includes(shop) || (shopText && shopText.includes(shop))) {
          shouldRemove = true;
          break;
        }
      }
    }

    if (shouldRemove) {
      card.remove();
    } else {
      card.dataset.boothFilterProcessed = 'true';
      card.dataset.boothShopIdentifier = shopIdentifier; // ソート用
      
      const blockTarget = shopText.trim() || shopIdentifier;
      injectQuickMuteButton(card, blockTarget, shopText);
      
      // 2列レイアウト有効時は、URL注入のみ実行（レイアウトはCSSが貴任する）
      if (enable2Col) {
        injectThumbnailUrls(card);
      }
    }
  });
}

function sortContainers(cards) {
  // 処理済みのカード総数が変わっていない場合はソートをスキップ（ホバー時の点滅バグ防止）
  const totalProcessed = cards.filter(c => c.dataset.boothFilterProcessed === 'true').length;
  if (totalProcessed === lastProcessedCount) return;
  lastProcessedCount = totalProcessed;

  // 親コンテナごとに処理
  const containers = [...new Set(cards.map(c => c.parentElement).filter(Boolean))];
  
  containers.forEach(container => {
    const allCards = Array.from(container.children).filter(el => el.dataset.boothFilterProcessed === 'true');
    if (allCards.length === 0) return;

    const shopGroups = {};
    const originalOrder = []; 

    allCards.forEach((card, index) => {
      const shopId = card.dataset.boothShopIdentifier;
      if (!shopId) return;
      if (!shopGroups[shopId]) shopGroups[shopId] = [];
      shopGroups[shopId].push(card);
      originalOrder.push({ card, index });
    });

    const singles = [];
    const multiples = [];

    // グループ分け（1個だけのものは元の順序を維持）
    originalOrder.forEach(({ card }) => {
      const shopId = card.dataset.boothShopIdentifier;
      if (!shopId) return;
      if (shopGroups[shopId].length === 1) {
        singles.push(card);
      }
    });

    for (const [shopId, groupCards] of Object.entries(shopGroups)) {
      if (groupCards.length > 1) {
        multiples.push({ shopId, count: groupCards.length, cards: groupCards });
      }
    }

    // マルチプルを被りが多い順に昇順ソート（多いやつほど最下部に行くように）
    multiples.sort((a, b) => a.count - b.count);

    // DOMへ再配置
    const fragment = document.createDocumentFragment();
    
    singles.forEach(card => fragment.appendChild(card));
    multiples.forEach(group => {
      group.cards.forEach(card => fragment.appendChild(card));
    });

    container.appendChild(fragment);
  });
}

function injectQuickMuteButton(card, blockTarget, shopText) {
  if (!blockTarget) return;

  // ボタンを挿入するターゲット要素を特定（テキストグループ：summaryエリアを優先）
  const target = card.querySelector('.item-card__summary, .item-card__shop-info, [class*="summary"]') || card;
  
  // すでにボタンがある場合は追加しない
  if (target.querySelector('.booth-filter-quick-mute')) return;

  const currentPos = window.getComputedStyle(target).position;
  if (currentPos === 'static') {
    target.style.position = 'relative';
  }

  const btn = document.createElement('button');
  btn.className = 'booth-filter-quick-mute';
  btn.innerHTML = '&times;';
  btn.title = `「${blockTarget}」をNGショップに登録`;
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    chrome.storage.local.get({ ngShops: [] }, (data) => {
      const list = data.ngShops || [];
      if (!list.includes(blockTarget)) {
        list.push(blockTarget);
        chrome.storage.local.set({ ngShops: list }, () => {
          const allCards = getItemCards(document.body);
          allCards.forEach(c => delete c.dataset.boothFilterProcessed);
          lastProcessedCount = 0; // リセット
          processCards(allCards);
          sortContainers(allCards);
        });
      }
    });
  });

  target.appendChild(btn);
}

function initDOMFiltering() {
  const cards = getItemCards(document.body);
  processCards(cards);
  sortContainers(cards);

  let debounceTimer = null;
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
        shouldProcess = true;
        break;
      }
    }
    
    if (shouldProcess) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const newCards = getItemCards(document.body);
        processCards(newCards);
        sortContainers(newCards);
        hideVRChatRecommendSection();
      }, 300);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// --- 「VRChatの人気作品」セクション非表示 ---
function hideVRChatRecommendSection() {
  if (!hideVRChatSection) return;

  // 見出しテキストで対象セクションを特定し、最も近いセクション要素ごと非表示にする
  const headings = document.querySelectorAll('h2, h3, h4, [class*="heading"], [class*="title"]');
  headings.forEach(heading => {
    if (heading.textContent.includes('VRChat') && heading.textContent.includes('人気')) {
      // section / div / article などのブロック親を上に辿って隠す
      const section =
        heading.closest('section') ||
        heading.closest('[class*="recommend"]') ||
        heading.closest('[class*="popular"]') ||
        heading.parentElement?.parentElement;
      if (section) {
        section.style.setProperty('display', 'none', 'important');
      }
    }
  });
}

function init() {
  interceptSearch();
  initDOMFiltering();
  hideVRChatRecommendSection();
}
