chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "block-booth-shop",
    title: "このショップをブロックする",
    contexts: ["link"],
    documentUrlPatterns: ["*://*.booth.pm/*"]
  });
});

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
        chrome.storage.local.get({ ngShops: [] }, (data) => {
          const list = data.ngShops || [];
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
