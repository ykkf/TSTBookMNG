// --- State & Mock Data ---

window.state = {
    unpurchased: [
        { id: '1', title: 'ONE PIECE', volume: '108', publisher: 'shueisha', status: 'unpurchased', reason: null },
        { id: '2', title: '呪術廻戦', volume: '27', publisher: 'shueisha', status: 'unpurchased', reason: '在庫切れ' },
    ],
    purchased: [
        { id: '3', title: 'SPY×FAMILY', volume: '13', publisher: 'shueisha', status: 'purchased', reason: null },
    ],
    editingCards: [], // Temp storage for OCR results
    publishers: [
        { id: 'shueisha', name: '集英社', short: 'S', color: '#e50012' },
        { id: 'kodansha', name: '講談社', short: 'K', color: '#0097a7' },
        { id: 'shogakukan', name: '小学館', short: 'Sk', color: '#ffeb3b', textColor: 'black' },
        { id: 'kadokawa', name: 'KADOKAWA', short: 'Kd', color: '#1a237e' }
    ],
    settings: {
        autoDeletePeriod: '30' // Default 1 month
    }
};

window.currentScreen = 'home';
window.targetCardId = null; // For modal handling
window.currentDetailId = null; // For detail edit screen
window.publisherSelectTarget = null; // To know which select element triggered the add new

// --- DOM Elements ---

const screens = {
    home: document.getElementById('screen-home'),
    camera: document.getElementById('screen-camera'),
    edit: document.getElementById('screen-edit'),
    detailEdit: document.getElementById('screen-detail-edit')
};

const lists = {
    unpurchased: document.getElementById('list-unpurchased'),
    purchased: document.getElementById('list-purchased')
};

const tabs = document.querySelectorAll('.tab');
const fabCamera = document.getElementById('fab-camera');
const btnShutter = document.getElementById('btn-shutter');
const btnCloseCamera = document.getElementById('btn-close-camera');
const btnHeaderAction = document.getElementById('header-action-btn');
const pageTitle = document.getElementById('page-title');

const modalReason = document.getElementById('modal-reason');
const reasonBtns = document.querySelectorAll('.reason-btn');
const btnSaveReason = document.getElementById('btn-save-reason');
const btnCloseModal = document.getElementById('btn-close-modal');

// Settings Elements
const modalSettings = document.getElementById('modal-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnSettings = document.getElementById('btn-settings');
const btnDeleteAllPurchased = document.getElementById('btn-delete-all-purchased');
const settingAutoDelete = document.getElementById('setting-auto-delete');
// OCR Edit Elements
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnSaveEdit = document.getElementById('btn-save-edit');

// Publisher Modal
const modalPublisher = document.getElementById('modal-publisher');
const inputNewPublisher = document.getElementById('new-publisher-name');
const btnClosePubModal = document.getElementById('btn-close-pub-modal');
const btnSavePublisher = document.getElementById('btn-save-publisher');


// Detail Edit Elements
const inputDetailTitle = document.getElementById('detail-title');
const inputDetailVolume = document.getElementById('detail-volume');
const inputDetailPublisher = document.getElementById('detail-publisher');
const btnSaveDetail = document.getElementById('btn-save-detail');
const btnDeleteItem = document.getElementById('btn-delete-item');

// --- Navigation ---

function navigateTo(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');
    currentScreen = screenId;

    // Header logic
    // We are now handling headers per screen more explicitly, 
    // but for Home we still use the main header.
    // For OCR edit, we hide main header or just overlay it.
    // Let's simply hide the main header when not in Home/Detail (Detail has no header in HTML? No, it's a section)
    // Actually our previous logic used the main header for everything except camera.
    // Now OCR Edit has its own header bar. So hide main header there.

    const mainHeader = document.querySelector('header');
    if (screenId === 'edit') {
        mainHeader.classList.add('hidden');
    } else {
        mainHeader.classList.remove('hidden');
    }

    btnHeaderAction.classList.add('hidden'); // Default hide action
    btnHeaderAction.onclick = null;

    if (screenId === 'home') {
        pageTitle.textContent = 'Manga Manager';
    } else if (screenId === 'detailEdit') {
        // Title is set by the caller (Add vs Edit)
        // Ensure delete button visibility is reset by caller, but safe defaults here:
        // btnDeleteItem.classList.remove('hidden'); 
        // document.getElementById('btn-detail-reason').classList.remove('hidden');
    }
}

// --- Render ---

// --- Rendering ---

function renderHome() {
    renderUnpurchased();
    renderPurchasedList();
    updateHeaderAction();
}
window.renderHome = renderHome;

function renderUnpurchased() {
    const list = document.getElementById('list-unpurchased');
    list.innerHTML = '';

    // Search & Filter
    const searchTextEl = document.getElementById('search-text');
    const filterPubEl = document.getElementById('filter-publisher');

    // Ensure listeners are only added once, or handle re-rendering carefully.
    // For simplicity, if renderHome is called often, these listeners might be better
    // initialized once outside this function. Assuming they are not re-added on every call.
    // The instruction implies adding them here, so I will add them.
    if (searchTextEl && !searchTextEl.dataset.listenerAdded) {
        searchTextEl.addEventListener('input', window.renderHome);
        searchTextEl.dataset.listenerAdded = 'true';
    }
    if (filterPubEl && !filterPubEl.dataset.listenerAdded) {
        filterPubEl.addEventListener('change', window.renderHome);
        filterPubEl.dataset.listenerAdded = 'true';
    }

    const searchText = searchTextEl ? searchTextEl.value.toLowerCase() : '';
    const filterPub = filterPubEl ? filterPubEl.value : 'all';

    const filtered = window.state.unpurchased.filter(item => {
        const matchTitle = item.title.toLowerCase().includes(searchText);
        const matchPub = filterPub === 'all' || item.publisher === filterPub;
        return matchTitle && matchPub;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state">未購入のマンガはありません</div>';
        return;
    }

    filtered.forEach(item => {
        const card = createCard(item, false);
        list.appendChild(card);
    });
}

function renderPurchasedList() {
    const list = document.getElementById('list-purchased');
    list.innerHTML = '';

    const filtered = window.state.purchased; // Add filtering if needed for purchased too

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state">購入済みのマンガはありません</div>';
        return;
    }

    // Sort by updated (most recent first)
    filtered.sort((a, b) => b.updatedAt - a.updatedAt);

    filtered.forEach(item => {
        const card = createCard(item, true);
        list.appendChild(card);
    });
}

function updatePublisherFilterOptions() {
    const select = document.getElementById('filter-publisher');
    const currentVal = select.value;

    let html = '<option value="all">全出版社</option>';
    state.publishers.forEach(p => {
        html += `<option value="${p.id}">${p.name}</option>`;
    });

    select.innerHTML = html;
    select.value = currentVal; // Maintain selection
}

function getPublisherInfo(key) {
    return state.publishers.find(p => p.id === key) || { id: 'other', name: 'その他', short: '?', color: '#9e9e9e' };
}

function createCard(item) {
    const el = document.createElement('div');
    el.className = 'card';
    const reasonHtml = item.reason ? `<div class="card-reason">⚠️ ${item.reason}</div>` : '';
    const pubInfo = getPublisherInfo(item.publisher);

    // Inline style for dynamic publisher colors
    const iconStyle = `background-color: ${pubInfo.color}; color: ${pubInfo.textColor || 'white'};`;

    el.innerHTML = `
        <div class="card-info">
            <div class="card-title">
                <span class="publisher-icon" style="${iconStyle}">${pubInfo.short}</span>
                ${item.title}
            </div>
            <span class="card-vol">${item.volume}巻</span>
            ${reasonHtml}
        </div>
        <div class="card-actions">
            <div class="checkbox ${item.status === 'purchased' ? 'checked' : ''}" onclick="toggleStatus('${item.id}', '${item.status}')">
                ${item.status === 'purchased' ? '<span class="material-icons" style="font-size:16px;">check</span>' : ''}
            </div>
        </div>
    `;

    // Tap to edit (except checkbox)
    el.querySelector('.card-info').onclick = () => {
        if (item.status === 'unpurchased') {
            openDetailEdit(item.id);
        } else {
            openDetailEdit(item.id);
        }
    };

    return el;
}

function generatePublisherOptions(selectedId) {
    let html = state.publishers.map(p =>
        `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    html += `<option value="add-new">+ 出版社を追加...</option>`;
    return html;
}
window.generatePublisherOptions = generatePublisherOptions;

function renderEditScreen() {
    const list = document.getElementById('ocr-list');
    list.innerHTML = '';

    state.editingCards.forEach((card, index) => {
        const el = document.createElement('div');
        el.className = 'edit-card';
        // Mock publisher guessing for OCR results
        const guessedPublisher = 'shueisha'; // Mock

        el.innerHTML = `
            <div class="input-group">
                <label class="input-label">タイトル</label>
                <input type="text" class="text-input" value="${card.title}" id="title-${index}">
                <div class="ai-chips">
                    ${card.suggestions.map(s => `<button class="chip" onclick="applySuggestion(${index}, '${s}')">${s}</button>`).join('')}
                </div>
            </div>
            <div class="input-group">
                <label class="input-label">巻数</label>
                <input type="number" class="text-input" value="${card.volume}" style="width: 80px;" id="vol-${index}">
            </div>
            <div class="input-group">
                <label class="input-label">出版社</label>
                <select id="pub-${index}" class="text-input" onchange="checkPublisherSelect(this)">
                    ${generatePublisherOptions(guessedPublisher)}
                </select>
            </div>
            
            <div class="edit-actions">
                <button class="btn-flat text-danger" onclick="removeEditCard(${index})">削除</button>
                <button class="btn-flat text-primary" onclick="openReasonModal(${index})">未購入理由...</button>
            </div>
        `;
        list.appendChild(el);
    });
}

window.checkPublisherSelect = (selectEl) => {
    if (selectEl.value === 'add-new') {
        window.publisherSelectTarget = selectEl;
        // Temporarily reset value to avoid sticking on "add-new" if cancelled
        selectEl.value = 'other';
        openPublisherModal();
    }
};

// --- Detail Edit Logic ---

function openDetailEdit(id) {
    currentDetailId = id;
    // Find item
    const item = state.unpurchased.find(i => i.id === id) || state.purchased.find(i => i.id === id);
    if (!item) return;

    inputDetailTitle.value = item.title;
    inputDetailVolume.value = item.volume;

    // Populate publisher options
    inputDetailPublisher.innerHTML = generatePublisherOptions(item.publisher || 'other');
    inputDetailPublisher.value = item.publisher || 'other'; // Ensure value is set
    inputDetailPublisher.onchange = function () { checkPublisherSelect(this); };

    navigateTo('detailEdit');
}

btnSaveDetail.onclick = () => {
    if (!currentDetailId) return;

    // Find and update
    let list = state.unpurchased;
    let item = list.find(i => i.id === currentDetailId);
    if (!item) {
        list = state.purchased;
        item = list.find(i => i.id === currentDetailId);
    }

    if (item) {
        item.title = inputDetailTitle.value;
        item.volume = inputDetailVolume.value;
        item.publisher = inputDetailPublisher.value;
        showToast('保存しました');
    }

    navigateTo('home');
    saveState();
    renderHome();
};

btnDeleteItem.onclick = () => {
    if (!currentDetailId) return;

    if (!confirm('本当に削除しますか？')) return;

    let idx = state.unpurchased.findIndex(i => i.id === currentDetailId);
    if (idx > -1) {
        state.unpurchased.splice(idx, 1);
    } else {
        idx = state.purchased.findIndex(i => i.id === currentDetailId);
        if (idx > -1) state.purchased.splice(idx, 1);
    }

    showToast('削除しました');
    saveState();
    navigateTo('home');
    renderHome();
};


// --- Actions ---

window.toggleStatus = (id, currentStatus) => {
    // Determine source and target arrays
    const sourceList = currentStatus === 'unpurchased' ? state.unpurchased : state.purchased;
    const targetList = currentStatus === 'unpurchased' ? state.purchased : state.unpurchased;
    const newStatus = currentStatus === 'unpurchased' ? 'purchased' : 'unpurchased';

    const idx = sourceList.findIndex(x => x.id === id);
    if (idx > -1) {
        const item = sourceList.splice(idx, 1)[0];
        item.status = newStatus;
        if (newStatus === 'purchased') {
            item.reason = null; // Clear reason on purchase
            item.updatedAt = Date.now(); // Set purchased timestamp
        }
        targetList.push(item);

        showToast(newStatus === 'purchased' ? '購入済みにしました' : '未購入に戻しました');
        saveState();
        renderHome();
    }
    // Prevent event bubbling
    event.stopPropagation();
};

window.applySuggestion = (index, value) => {
    document.getElementById(`title-${index}`).value = value;
};

window.removeEditCard = (index) => {
    state.editingCards.splice(index, 1);
    renderEditScreen();
};

window.openReasonModal = (editIndex) => {
    targetCardId = editIndex; // Using index as ID for temp cards
    modalReason.classList.remove('hidden');
    document.getElementById('reason-custom').value = '';
    reasonBtns.forEach(b => b.classList.remove('selected'));
};

window.openDetailReasonModal = () => {
    if (!currentDetailId) return;
    targetCardId = currentDetailId; // Use the detail ID
    modalReason.classList.remove('hidden');
    document.getElementById('reason-custom').value = '';
    reasonBtns.forEach(b => b.classList.remove('selected'));
};

// OCR Edit Header Actions
btnSaveEdit.onclick = saveEditResults;
btnCancelEdit.onclick = () => {
    if (state.editingCards.length > 0 && !confirm('編集中の内容は破棄されます。よろしいですか？')) {
        return;
    }
    state.editingCards = [];
    navigateTo('home');
};

function saveEditResults() {
    state.editingCards.forEach((card, index) => {
        const title = document.getElementById(`title-${index}`).value;
        const volume = document.getElementById(`vol-${index}`).value;
        const publisher = document.getElementById(`pub-${index}`).value;

        state.unpurchased.push({
            id: Date.now().toString() + index,
            title: title,
            volume: volume,
            publisher: publisher,
            status: 'unpurchased',
            reason: card.reason || null
        });
    });

    state.editingCards = []; // Clear
    showToast('登録しました');
    saveState();
    navigateTo('home');
    renderHome();
}

// --- Logic for Tabs ---

tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.dataset.tab;
        if (target === 'unpurchased') {
            lists.unpurchased.classList.remove('hidden');
            lists.purchased.classList.add('hidden');
        } else {
            lists.unpurchased.classList.add('hidden');
            lists.purchased.classList.remove('hidden');
        }
    };
});

// --- Camera & OCR Logic (Mock) ---

// --- Manual Add Logic ---

const fabAddManual = document.getElementById('fab-add-manual');
const btnCancelDetail = document.getElementById('btn-cancel-detail'); // New Cancel Button

if (btnCancelDetail) {
    btnCancelDetail.onclick = () => {
        navigateTo('home');
    };
}

fabAddManual.onclick = () => {
    // Determine which list is active to set default status
    const isUnpurchased = document.querySelector('.tab[data-tab="unpurchased"]').classList.contains('active');

    // Reset form
    currentDetailId = null; // null means "New Item"
    inputDetailTitle.value = '';
    inputDetailVolume.value = '';

    inputDetailPublisher.innerHTML = generatePublisherOptions('other');
    inputDetailPublisher.value = 'other';
    inputDetailPublisher.onchange = function () { checkPublisherSelect(this); };

    // Update UI for "Add" mode
    pageTitle.textContent = 'マンガを手動追加';
    if (btnDeleteItem) btnDeleteItem.classList.add('hidden'); // Cannot delete what doesn't exist
    const btnReason = document.getElementById('btn-detail-reason');
    if (btnReason) btnReason.classList.add('hidden'); // Simplification for new add

    navigateTo('detailEdit');
};

// --- Settings Logic ---

// Ensure elements exist before attaching events
if (btnSettings && modalSettings) {
    btnSettings.onclick = () => {
        modalSettings.classList.remove('hidden');
        // Load current setting
        if (state.settings && settingAutoDelete) {
            settingAutoDelete.value = state.settings.autoDeletePeriod || '30';
        }
        renderSettingsPublishers();
    };
} else {
    console.error('Settings button or modal not found!');
}

btnSaveDetail.onclick = () => {
    const title = inputDetailTitle.value.trim();
    if (!title) {
        alert('タイトルを入力してください');
        return;
    }
    const volume = inputDetailVolume.value;
    const publisher = inputDetailPublisher.value;

    if (currentDetailId) {
        // --- UPDATE EXISTING ---
        let list = state.unpurchased;
        let item = list.find(i => i.id === currentDetailId);
        if (!item) {
            list = state.purchased;
            item = list.find(i => i.id === currentDetailId);
        }

        if (item) {
            item.title = title;
            item.volume = volume;
            item.publisher = publisher;
            showToast('保存しました');
        }
    } else {
        // --- CREATE NEW ---
        // Default to unpurchased, unless we want to allow adding directly to purchased?
        // Let's assume adding to the *currently visible list* or default to unpurchased.
        const activeTab = document.querySelector('.tab.active').dataset.tab;
        const targetList = activeTab === 'purchased' ? state.purchased : state.unpurchased;

        const newItem = {
            id: Date.now().toString(),
            title: title,
            volume: volume,
            publisher: publisher,
            status: activeTab, // 'unpurchased' or 'purchased'
            reason: null,
            updatedAt: Date.now()
        };

        targetList.unshift(newItem); // Add to top
        showToast('追加しました');
    }

    navigateTo('home');
    saveState();
    renderHome();
};


// --- Camera & OCR Logic (Real Stream) ---

let videoStream = null;
const videoEl = document.getElementById('camera-feed');

fabCamera.onclick = () => {
    navigateTo('camera');
    startCamera();
};

btnCloseCamera.onclick = () => {
    stopCamera();
    navigateTo('home');
};

async function startCamera() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment' // Use back camera
            },
            audio: false
        });
        videoEl.srcObject = videoStream;
    } catch (err) {
        console.error("Camera Error:", err);
        alert('カメラを起動できませんでした。\n権限を確認してください。');
        navigateTo('home');
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

btnShutter.onclick = () => {
    // Visual feedback
    btnShutter.style.backgroundColor = 'red';

    // Logic: In a real app, we'd capture a frame here.
    // canvas.drawImage(videoEl, ...)

    setTimeout(() => {
        btnShutter.style.backgroundColor = 'white';
        stopCamera(); // Stop processing

        // Mock OCR Result (Simulation)
        // In the future, send the captured canvas to an OCR API here.
        state.editingCards = [
            { title: '撮影したマンガ(仮)', volume: '1', status: 'unpurchased', suggestions: ['撮影データ1', '撮影データ2'] }
        ];

        renderEditScreen();
        navigateTo('edit');
    }, 500);
};

// --- Modal Logic ---

btnCloseModal.onclick = () => {
    modalReason.classList.add('hidden');
};

reasonBtns.forEach(btn => {
    btn.onclick = () => {
        reasonBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    };
});

btnSaveReason.onclick = () => {
    const selectedBtn = document.querySelector('.reason-btn.selected');
    const customText = document.getElementById('reason-custom').value;

    let reason = '';
    if (selectedBtn) reason = selectedBtn.dataset.reason;
    if (customText) reason += (reason ? ' ' : '') + customText.trim();

    if (reason) {
        if (typeof targetCardId === 'number') {
            if (state.editingCards[targetCardId]) {
                state.editingCards[targetCardId].reason = reason;
                showToast('理由を保存しました');
            }
        } else {
            const item = state.unpurchased.find(i => i.id === targetCardId) || state.purchased.find(i => i.id === targetCardId);
            if (item) {
                item.reason = reason;
                showToast('理由を保存しました');
            }
        }
    }

    modalReason.classList.add('hidden');
    saveState();
};


// --- Publisher Modal Logic ---
function openPublisherModal() {
    modalPublisher.classList.remove('hidden');
    inputNewPublisher.value = '';
}

btnClosePubModal.onclick = () => {
    modalPublisher.classList.add('hidden');
};

btnSavePublisher.onclick = () => {
    const name = inputNewPublisher.value.trim();
    if (!name) return;

    // Check for duplicates
    if (state.publishers.some(p => p.name === name)) {
        alert('その出版社は既に登録されています');
        return;
    }

    // Create id from name (simplified for prototype)
    const id = 'pub_' + Date.now();
    const short = name.substring(0, 1).toUpperCase();

    // Add to state
    const newPub = {
        id: id,
        name: name,
        short: short,
        color: '#607d8b' // Default color for custom publishers
    };
    state.publishers.push(newPub);

    // Update select element that triggered this
    if (publisherSelectTarget) {
        // Re-generate options. 
        // Note: publisherSelectTarget is a DOM element (select).
        // We need to inject options again.

        publisherSelectTarget.innerHTML = generatePublisherOptions(newPub.id);
        publisherSelectTarget.value = newPub.id;
    }

    modalPublisher.classList.add('hidden');
    saveState();
    showToast(`出版社「${name}」を追加しました`);
};

// --- Settings Logic ---
// Functions like openSettings, closeSettings, saveSettings are now in index.html for reliability.
// But we still need helper functions.

// Exposed for Inline Script
window.forceRenderPublishers = function () {
    renderSettingsPublishers();
};

function renderSettingsPublishers() {
    // ... existing logic ...
    const container = document.getElementById('settings-publisher-list');
    if (!container) return;

    container.innerHTML = '';

    if (!state.publishers || state.publishers.length === 0) {
        container.innerHTML = '<div style="padding: 8px; color: #888;">出版社がありません</div>';
        return;
    }

    state.publishers.forEach(pub => {
        if (!pub) return;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '8px';
        row.style.padding = '8px';
        row.style.borderBottom = '1px solid #f0f0f0';
        row.style.backgroundColor = '#fff';
        row.style.color = '#333';

        // Prevent deleting default publishers
        const id = pub.id || 'unknown';
        const name = pub.name || '不明な出版社';
        const isDefault = ['shueisha', 'kodansha', 'shogakukan', 'kadokawa'].includes(id);
        const deleteBtn = isDefault ?
            '<span style="color:#ccc; font-size:12px;">(標準)</span>' :
            `<button class="text-danger" style="background:none; border:none; cursor:pointer; padding: 4px;" onclick="deletePublisher('${id}')"><span class="material-icons" style="font-size: 20px;">delete</span></button>`;

        row.innerHTML = `
            <span style="font-weight: 500;">${name}</span>
            ${deleteBtn}
        `;
        container.appendChild(row);
    });
}
window.forceRenderPublishers = renderSettingsPublishers;

// ... deletePublisher is already window.deletePublisher ...

function checkAutoDelete() {
    if (!window.state.settings || !window.state.settings.autoDeletePeriod || window.state.settings.autoDeletePeriod === 'never') return;
    // ... rest of logic
    const period = window.state.settings.autoDeletePeriod;
    if (period === 'never') return;

    const days = parseInt(period, 10);
    const msPerDay = 24 * 60 * 60 * 1000;
    const threshold = Date.now() - (days * msPerDay);

    const initialCount = state.purchased.length;
    state.purchased = state.purchased.filter(item => {
        if (!item.updatedAt) return true;
        return item.updatedAt > threshold;
    });

    if (state.purchased.length < initialCount) {
        saveState();
        renderHome();
        console.log(`Auto-deleted ${initialCount - state.purchased.length} items.`);
    }
}
window.checkAutoDelete = checkAutoDelete;

// --- Utils ---

// Expose showToast globally if not already
if (!window.showToast) {
    window.showToast = function (msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000);
    };
}

// --- Storage Logic ---

const STORAGE_KEY = 'manga_manager_data';

function saveState() {
    const data = {
        unpurchased: state.unpurchased,
        purchased: state.purchased,
        publishers: state.publishers
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
window.saveState = saveState;

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        const data = JSON.parse(raw);
        state.unpurchased = data.unpurchased || [];
        state.purchased = data.purchased || [];
        // Merge publishers to ensure defaults exist if needed, or just overwrite if we trust saved data.
        // For simplicity in prototype: overwrite if exists, but ensure 'other' exists?
        // Let's just overwrite.
        if (data.publishers && data.publishers.length > 0) {
            state.publishers = data.publishers.filter(p => p.id !== 'other');
        }
        if (data.settings) {
            state.settings = data.settings;
        }
    }
    // Migration: ensure 'other' is gone if it was default
    state.publishers = state.publishers.filter(p => p.id !== 'other');
}

// --- Init ---

document.getElementById('search-text').addEventListener('input', renderHome);
document.getElementById('filter-publisher').addEventListener('change', renderHome);

// Expose for debugging
window.debugState = () => console.log(state);
window.forceRenderPublishers = renderSettingsPublishers;

loadState();
checkAutoDelete(); // Run on startup
renderHome();
