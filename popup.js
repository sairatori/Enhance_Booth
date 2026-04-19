document.addEventListener('DOMContentLoaded', () => {
  const wordListEl = document.getElementById('word-list');
  const shopListEl = document.getElementById('shop-list');
  const newWordInput = document.getElementById('new-word');
  const newShopInput = document.getElementById('new-shop');
  const addWordBtn = document.getElementById('add-word-btn');
  const addShopBtn = document.getElementById('add-shop-btn');

  const toggle2Col = document.getElementById('toggle-2col');
  const toggleCleanTitle = document.getElementById('toggle-clean-title');
  const toggleHideVRChat = document.getElementById('toggle-hide-vrchat');

  // Load current data
  chrome.storage.local.get({ ngWords: [], ngShops: [], enable2Col: false, enableCleanTitle: true, hideVRChatSection: false }, (data) => {
    renderList(wordListEl, data.ngWords, 'ngWords');
    renderList(shopListEl, data.ngShops, 'ngShops');
    toggle2Col.checked = data.enable2Col;
    toggleCleanTitle.checked = data.enableCleanTitle;
    toggleHideVRChat.checked = data.hideVRChatSection;
  });

  toggle2Col.addEventListener('change', (e) => {
    chrome.storage.local.set({ enable2Col: e.target.checked });
  });

  toggleCleanTitle.addEventListener('change', (e) => {
    chrome.storage.local.set({ enableCleanTitle: e.target.checked });
  });

  toggleHideVRChat.addEventListener('change', (e) => {
    chrome.storage.local.set({ hideVRChatSection: e.target.checked });
  });

  function renderList(container, items, storageKey) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
      const li = document.createElement('li');
      li.style.color = '#999';
      li.style.justifyContent = 'center';
      li.textContent = '登録されていません';
      container.appendChild(li);
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement('li');
      
      const span = document.createElement('span');
      span.className = 'text';
      span.textContent = item;
      span.title = item; // Show full text on hover
      
      const btn = document.createElement('button');
      btn.className = 'delete-btn';
      btn.innerHTML = '&times;';
      btn.title = '削除';
      btn.onclick = () => removeItem(storageKey, index);

      li.appendChild(span);
      li.appendChild(btn);
      container.appendChild(li);
    });
  }

  function addItem(storageKey, inputEl) {
    const value = inputEl.value.trim();
    if (!value) return;

    chrome.storage.local.get({ [storageKey]: [] }, (data) => {
      const list = data[storageKey] || [];
      if (!list.includes(value)) {
        list.push(value);
        chrome.storage.local.set({ [storageKey]: list }, () => {
          inputEl.value = '';
          const container = storageKey === 'ngWords' ? wordListEl : shopListEl;
          renderList(container, list, storageKey);
        });
      } else {
        inputEl.value = '';
      }
    });
  }

  function removeItem(storageKey, index) {
    chrome.storage.local.get({ [storageKey]: [] }, (data) => {
      const list = data[storageKey] || [];
      list.splice(index, 1);
      chrome.storage.local.set({ [storageKey]: list }, () => {
        const container = storageKey === 'ngWords' ? wordListEl : shopListEl;
        renderList(container, list, storageKey);
      });
    });
  }

  addWordBtn.addEventListener('click', () => addItem('ngWords', newWordInput));
  addShopBtn.addEventListener('click', () => addItem('ngShops', newShopInput));

  newWordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addItem('ngWords', newWordInput);
  });
  newShopInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addItem('ngShops', newShopInput);
  });
});
