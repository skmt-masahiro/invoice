/* ========================================
   請求書作成ツール - 葡萄屋専用
   ======================================== */

const STORAGE_KEY_ISSUER = 'invoice_issuer';
const MAX_ITEMS = 20;
const MIN_DISPLAY_ROWS = 8;

// 振込先プリセット
const BANK_PRESETS = {
  tajima: '■但馬銀行 甲南支店（普通） No. 7117606 カ）ロントン',
  mitsui: '■三井住友銀行 神戸営業部（普通） No. 1056018 ブドウヤ'
};

// --- データモデル ---
const state = {
  clientName: '',
  issueDate: '',
  items: [],
  note: '',
  bankMode: 'tajima',
  bankCustom: '',
  issuer: {
    name: '葡萄屋',
    zipCode: '650-0004',
    address: '神戸市中央区中山手通1-9-2\nMOZANビル 10F',
    tel: '078-333-8207（代表）',
    registrationNumber: 'T3140001026044'
  }
};

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
  loadIssuer();
  setDefaultDate();
  addItem();
  bindEvents();
  syncPreview();
});

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('issueDate').value = yyyy + '-' + mm + '-' + dd;
}

// --- localStorage ---
function loadIssuer() {
  const saved = localStorage.getItem(STORAGE_KEY_ISSUER);
  if (saved) {
    const data = JSON.parse(saved);
    Object.assign(state.issuer, data.issuer || {});
    state.bankMode = data.bankMode || 'tajima';
    state.bankCustom = data.bankCustom || '';
  }
  // フォームに反映
  document.getElementById('issuerName').value = state.issuer.name;
  document.getElementById('issuerZip').value = state.issuer.zipCode;
  document.getElementById('issuerAddress').value = state.issuer.address;
  document.getElementById('issuerTel').value = state.issuer.tel;
  document.getElementById('issuerRegNum').value = state.issuer.registrationNumber;

  // 銀行プリセット反映
  updateBankUI();
}

function saveIssuer() {
  readIssuerFromForm();
  localStorage.setItem(STORAGE_KEY_ISSUER, JSON.stringify({
    issuer: state.issuer,
    bankMode: state.bankMode,
    bankCustom: state.bankCustom
  }));
  syncPreview();
}

function readIssuerFromForm() {
  state.issuer.name = document.getElementById('issuerName').value;
  state.issuer.zipCode = document.getElementById('issuerZip').value;
  state.issuer.address = document.getElementById('issuerAddress').value;
  state.issuer.tel = document.getElementById('issuerTel').value;
  state.issuer.registrationNumber = document.getElementById('issuerRegNum').value;
}

// --- 銀行プリセット ---
function updateBankUI() {
  document.querySelectorAll('.btn-bank').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bank === state.bankMode);
  });
  const customInput = document.getElementById('bankCustom');
  if (state.bankMode === 'custom') {
    customInput.classList.remove('hidden');
    customInput.value = state.bankCustom;
  } else {
    customInput.classList.add('hidden');
  }
}

function getBankText() {
  if (state.bankMode === 'custom') {
    return state.bankCustom;
  }
  return BANK_PRESETS[state.bankMode] || '';
}

// --- 明細行の管理 ---
function addItem() {
  const container = document.getElementById('items-container');
  if (container.querySelectorAll('.item-row').length >= MAX_ITEMS) return;

  const template = document.getElementById('item-row-template');
  const clone = template.content.cloneNode(true);
  container.appendChild(clone);

  const rows = container.querySelectorAll('.item-row');
  const newRow = rows[rows.length - 1];

  newRow.querySelector('.btn-remove').addEventListener('click', () => {
    newRow.remove();
    syncPreview();
  });

  newRow.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', syncPreview);
  });
}

function collectItems() {
  const rows = document.querySelectorAll('#items-container .item-row');
  state.items = Array.from(rows).map(row => {
    const rawAmount = parseInt(row.querySelector('.item-amount').value);
    return {
      date: row.querySelector('.item-date').value,
      description: row.querySelector('.item-desc').value,
      amount: (rawAmount > 0) ? rawAmount : 0,
      taxRate: parseInt(row.querySelector('.item-tax').value)
    };
  });
}

// --- 計算 ---
function calculate() {
  let subtotal10 = 0;
  let subtotal8 = 0;

  for (const item of state.items) {
    if (item.taxRate === 8) {
      subtotal8 += item.amount;
    } else {
      subtotal10 += item.amount;
    }
  }

  const tax10 = Math.floor(subtotal10 * 0.10);
  const tax8 = Math.floor(subtotal8 * 0.08);
  const subtotal = subtotal10 + subtotal8;
  const grandTotal = subtotal + tax10 + tax8;

  return { subtotal10, subtotal8, tax10, tax8, subtotal, grandTotal };
}

function formatYen(n) {
  return '¥' + n.toLocaleString('ja-JP');
}

function formatDateJP(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// --- プレビュー同期 ---
function syncPreview() {
  state.clientName = document.getElementById('clientName').value;
  state.issueDate = document.getElementById('issueDate').value;
  state.note = document.getElementById('note').value;
  readIssuerFromForm();
  collectItems();

  // 請求先（ベースライン揃え: 同じfont-sizeにしてCSS側でalign）
  document.getElementById('pv-clientName').textContent = state.clientName || '○○○○';

  // 発行日
  document.getElementById('pv-issueDate').textContent = formatDateJP(state.issueDate);

  // 発行元
  document.getElementById('pv-issuerName').textContent = state.issuer.name || '';
  document.getElementById('pv-issuerZip').textContent =
    state.issuer.zipCode ? '〒' + state.issuer.zipCode : '';

  const addrEl = document.getElementById('pv-issuerAddress');
  addrEl.textContent = '';
  if (state.issuer.address) {
    state.issuer.address.split('\n').forEach((line, i, arr) => {
      addrEl.appendChild(document.createTextNode(line));
      if (i < arr.length - 1) addrEl.appendChild(document.createElement('br'));
    });
  }

  document.getElementById('pv-issuerTel').textContent = state.issuer.tel || '';
  const regNum = state.issuer.registrationNumber;
  document.getElementById('pv-issuerRegNum').textContent =
    regNum ? (regNum.startsWith('T') ? regNum[0] + ' ' + regNum.substring(1) : regNum) : '';

  // 明細テーブル
  const tbody = document.getElementById('pv-items');
  tbody.innerHTML = '';

  for (const item of state.items) {
    const tr = document.createElement('tr');
    const tdDate = document.createElement('td');
    tdDate.textContent = item.date;
    const tdDesc = document.createElement('td');
    tdDesc.textContent = item.description;
    const tdAmount = document.createElement('td');
    tdAmount.textContent = item.amount ? formatYen(item.amount) : '';
    tr.appendChild(tdDate);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmount);
    tbody.appendChild(tr);
  }

  // 空行
  const remaining = MIN_DISPLAY_ROWS - state.items.length;
  for (let i = 0; i < remaining; i++) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    for (let j = 0; j < 3; j++) {
      const td = document.createElement('td');
      td.textContent = '\u00A0';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // 計算
  const calc = calculate();

  document.getElementById('pv-grandTotal').textContent = formatYen(calc.grandTotal);
  document.getElementById('pv-subtotal').textContent = formatYen(calc.subtotal);
  document.getElementById('pv-subtotal10').textContent = formatYen(calc.subtotal10);
  document.getElementById('pv-subtotal8').textContent = formatYen(calc.subtotal8);
  document.getElementById('pv-tax10').textContent = formatYen(calc.tax10);
  document.getElementById('pv-tax8').textContent = formatYen(calc.tax8);
  document.getElementById('pv-taxAmount10').textContent = formatYen(calc.tax10);
  document.getElementById('pv-taxAmount8').textContent = formatYen(calc.tax8);
  document.getElementById('pv-total').textContent = formatYen(calc.grandTotal);

  document.getElementById('pv-tax8-row').style.display =
    calc.subtotal8 === 0 ? 'none' : '';

  // 備考
  document.getElementById('pv-note').textContent = state.note;

  // 振込先
  document.getElementById('pv-bank').textContent = getBankText();
}

// --- イベントバインディング ---
function bindEvents() {
  ['clientName', 'issueDate', 'note'].forEach(id => {
    document.getElementById(id).addEventListener('input', syncPreview);
  });

  document.getElementById('add-item').addEventListener('click', () => {
    addItem();
    syncPreview();
  });

  document.getElementById('save-issuer').addEventListener('click', saveIssuer);

  ['issuerName', 'issuerZip', 'issuerAddress', 'issuerTel', 'issuerRegNum']
    .forEach(id => {
      document.getElementById(id).addEventListener('input', syncPreview);
    });

  // 銀行プリセットボタン
  document.querySelectorAll('.btn-bank').forEach(btn => {
    btn.addEventListener('click', () => {
      state.bankMode = btn.dataset.bank;
      updateBankUI();
      syncPreview();
      // 自動保存
      saveIssuer();
    });
  });

  document.getElementById('bankCustom').addEventListener('input', (e) => {
    state.bankCustom = e.target.value;
    syncPreview();
  });

  document.getElementById('print-btn').addEventListener('click', handlePrint);
}

// --- 印刷前バリデーション ---
function handlePrint() {
  const warnings = [];
  if (!state.clientName.trim()) warnings.push('請求先が未入力です');
  if (state.items.every(item => item.amount === 0)) warnings.push('明細の金額が全て0です');

  if (warnings.length > 0) {
    const proceed = confirm('以下の項目が未入力です:\n\n' + warnings.join('\n') + '\n\nこのまま印刷しますか？');
    if (!proceed) return;
  }

  window.print();
}
