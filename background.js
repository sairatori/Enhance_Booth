chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "block-booth-shop",
    title: "このショップをブロックする",
    contexts: ["link"],
    documentUrlPatterns: ["*://*.booth.pm/*"]
  });
});

const MAX_LIST_SIZE = 1000; // popup.jsの設定と同期

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "block-booth-shop") {
    if (!info.linkUrl) return;

    let shopId = '';
    try {
      const url = new URL(info.linkUrl);
      // ショップURLのパターン:
      // 1. https://shopname.booth.pm/
      // 2. https://booth.pm/ja/shops/12345
      if (url.hostname.endsWith('.booth.pm') && url.hostname !== 'booth.pm') {
        shopId = url.hostname.split('.')[0];
      } else if (url.pathname.includes('/shops/')) {
        shopId = url.pathname.split('/').pop();
      }

      if (shopId) {
        // 文字数制限（念のため）
        if (shopId.length > 50) {
          console.warn('ショップIDが長すぎます。');
          return;
        }

        chrome.storage.local.get({ ngShops: [] }, (data) => {
          const list = data.ngShops || [];
          
          // 件数上限チェック
          if (list.length >= MAX_LIST_SIZE && !list.includes(shopId)) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon128.png',
              title: '登録上限到達',
              message: `登録上限（${MAX_LIST_SIZE}件）に達しているため、ブロックできませんでした。不要なものを削除してください。`,
              priority: 2
            });
            return;
          }

          if (!list.includes(shopId)) {
            list.push(shopId);
            chrome.storage.local.set({ ngShops: list });
          }
        });
      }
    } catch (e) {
      console.error('Invalid URL:', e);
    }
  }
});
