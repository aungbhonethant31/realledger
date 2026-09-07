import { supabase } from './supabase.js';
import { getSession, signIn, signUp, signOut } from './auth.js';
import {
  fetchCustomers, createCustomer, updateCustomer, deleteCustomer,
  fetchVouchers, createVoucher, updateVoucher, deleteVoucher,
  fetchPayments, createPayment, updatePayment,
} from './db.js';
import {
  money, date, today, esc, itemTotal, voucherTotal, paidAmount,
  balance, status, inMonth, toast,
} from './utils.js';

const $ = (s) => document.querySelector(s);

let currentUser = null;
let customers = [];
let vouchers = [];
let payments = [];
let page = 'dashboard';
let monthFilter = '';

const modal = $('#modal');

async function loadData() {
  [customers, vouchers, payments] = await Promise.all([
    fetchCustomers(),
    fetchVouchers(),
    fetchPayments(),
  ]);
}

async function init() {
  try {
    currentUser = await getSession();
  } catch (e) {
    currentUser = null;
  }

  $('#loadingScreen').classList.add('hidden');

  if (currentUser) {
    showApp();
    await loadData();
    render();
  } else {
    showLogin();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    (async () => {
      if (event === 'SIGNED_OUT' || !session) {
        currentUser = null;
        showLogin();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!currentUser) {
          currentUser = await getSession();
          if (currentUser) {
            showApp();
            await loadData();
            render();
          }
        }
      }
    })();
  });
}

function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#app').classList.add('hidden');
  renderLogin('signin');
}

const DEFAULT_ACCOUNTS = {
  admin: { email: 'admin@ledgerly.app', password: 'admin123' },
  user: { email: 'user@ledgerly.app', password: 'user123' },
};

function resolveEmail(usernameOrEmail) {
  const key = usernameOrEmail.trim().toLowerCase();
  if (DEFAULT_ACCOUNTS[key]) return DEFAULT_ACCOUNTS[key].email;
  return usernameOrEmail.trim();
}

function renderLogin(mode) {
  const isSignup = mode === 'signup';
  $('#loginScreen').innerHTML = `
    <div class="login-card">
      <div class="login-brand">L</div>
      <h1>${isSignup ? 'Create your account' : 'Welcome to Ledgerly'}</h1>
      <p>${isSignup ? 'Sign up to start managing customers, vouchers, and payment records.' : 'Sign in to manage customers, vouchers, and payment records.'}</p>
      <form id="loginForm">
        ${isSignup ? `<label for="signupName">Display name</label><input id="signupName" class="field" autocomplete="name" required>` : ''}
        <label for="email">${isSignup ? 'Email' : 'Username or email'}</label>
        <input id="email" class="field" ${isSignup ? 'type="email"' : ''} autocomplete="${isSignup ? 'email' : 'username'}" required>
        <label for="password">Password</label>
        <input id="password" class="field" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required>
        <button class="btn primary" type="submit">${isSignup ? 'Create account' : 'Sign in'}</button>
        <div id="loginError" class="login-error" role="alert"></div>
      </form>
      ${!isSignup ? `<div class="login-help" style="margin-top:22px;padding:14px;border-radius:12px;background:#eef1ea;color:#718078;font-size:12px;line-height:1.7">Demo accounts:<br><b>admin</b> / admin123 (administrator)<br><b>user</b> / user123 (normal user)</div>` : ''}
      <div class="login-toggle">
        ${isSignup
          ? 'Already have an account? <a id="toggleMode">Sign in</a>'
          : "Don't have an account? <a id=\"toggleMode\">Sign up</a>"}
      </div>
    </div>
  `;
  $('#loginForm').addEventListener('submit', (e) => handleLogin(e, isSignup));
  $('#toggleMode').addEventListener('click', () => renderLogin(isSignup ? 'signin' : 'signup'));
  const firstInput = isSignup ? $('#signupName') : $('#email');
  if (firstInput) firstInput.focus();
}

async function handleLogin(e, isSignup) {
  e.preventDefault();
  const errEl = $('#loginError');
  errEl.textContent = '';
  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = 'Please wait…';

  try {
    if (isSignup) {
      const username = $('#signupName').value.trim();
      const email = $('#email').value.trim();
      const password = $('#password').value;
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      await signUp(email, password, username);
      const session = await getSession();
      if (session) {
        currentUser = session;
        showApp();
        await loadData();
        render();
      } else {
        errEl.textContent = 'Account created. Please sign in.';
        renderLogin('signin');
      }
    } else {
      const email = resolveEmail($('#email').value);
      const password = $('#password').value;
      await signIn(email, password);
      currentUser = await getSession();
      if (currentUser) {
        showApp();
        await loadData();
        render();
      }
    }
  } catch (err) {
    errEl.textContent = err.message || 'Something went wrong. Please try again.';
    btn.disabled = false;
    btn.textContent = isSignup ? 'Create account' : 'Sign in';
  }
}

function showApp() {
  $('#loginScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#accountName').textContent = currentUser.username;
  const roleLabel = currentUser.role === 'admin' ? 'Administrator' : 'Normal user';
  $('#accountRole').textContent = roleLabel;
  page = 'dashboard';
}

$('#logoutBtn').addEventListener('click', async () => {
  await signOut();
  currentUser = null;
  customers = [];
  vouchers = [];
  payments = [];
  showLogin();
});

$('#closeModalBtn').addEventListener('click', closeModal);

function setPage(next) {
  page = next;
  monthFilter = '';
  render();
}

async function refresh() {
  await loadData();
  render();
}

function render() {
  const nav = [
    ['dashboard', 'Dashboard'],
    ['customers', 'Customers'],
    ['vouchers', 'Vouchers'],
    ['payments', 'Payment records'],
  ];
  $('#nav').innerHTML = nav
    .map((x) => `<button class="${page === x[0] ? 'active' : ''}" data-page="${x[0]}">${x[1]}</button>`)
    .join('');
  $('#nav').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  const pages = { dashboard, customers: customersView, vouchers: vouchersView, payments: paymentsView };
  (pages[page] || dashboard)();
}

function head(title, subtitle, button, action) {
  $('#title').textContent = title;
  $('#subtitle').textContent = subtitle;
  $('#addBtn').textContent = button || '';
  $('#addBtn').classList.toggle('hidden', !button);
  $('#addBtn').onclick = action || null;
}

function dashboard() {
  const isAdmin = currentUser.role === 'admin';
  head(
    'Dashboard',
    'A summary of all records in your workspace.',
    isAdmin ? 'Record payment' : 'Add voucher',
    isAdmin ? () => paymentForm() : () => voucherForm()
  );

  const sales = vouchers.reduce((s, v) => s + voucherTotal(v), 0);
  const received = payments.reduce((s, p) => s + (+p.amount || 0), 0);
  const cards = [
    ['Customers', customers.length],
    ['Vouchers', vouchers.length],
    ['Total sales', money(sales)],
    ['Outstanding', money(Math.max(0, sales - received))],
  ];
  const recent = [...payments]
    .sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)))
    .slice(0, 5);

  $('#view').innerHTML = `
    <div class="grid">${cards.map((c) => `<div class="card stat"><span>${c[0]}</span><strong>${c[1]}</strong></div>`).join('')}</div>
    <div class="card section">
      <div class="section-head">Recent payments</div>
      ${paymentTable(recent)}
    </div>
  `;
}

function monthControl(label = 'Month') {
  return `<input class="field" type="month" aria-label="${label}" value="${esc(monthFilter)}" id="monthPicker"><button class="btn soft" id="clearMonth">All months</button>`;
}

function bindMonthControls() {
  const picker = $('#monthPicker');
  if (picker) picker.addEventListener('change', (e) => { monthFilter = e.target.value; render(); });
  const clear = $('#clearMonth');
  if (clear) clear.addEventListener('click', () => { monthFilter = ''; render(); });
}

function customersView() {
  head('Customers', 'View customer voucher totals for any month.', 'Add customer', () => customerForm());
  const isAdmin = currentUser.role === 'admin';
  const rows = customers.map((c) => {
    const vs = vouchers.filter((v) => v.customerId === c.id && inMonth(v.buyingDate, monthFilter));
    const t = vs.reduce((s, v) => s + voucherTotal(v), 0);
    const p = payments
      .filter((x) => x.customerId === c.id && inMonth(x.paymentDate, monthFilter))
      .reduce((s, x) => s + (+x.amount || 0), 0);
    return `<tr data-search="${esc((c.name + ' ' + c.location).toLowerCase())}">
      <td><b>${esc(c.name)}</b></td>
      <td>${esc(c.location)}</td>
      <td>${vs.length}</td>
      <td>${money(t)}</td>
      <td>${money(p)}</td>
      <td><b>${money(Math.max(0, t - p))}</b></td>
      <td>
        <button class="btn link" data-action="records" data-id="${c.id}">View vouchers</button>
        ${isAdmin ? `<button class="btn link" data-action="edit" data-id="${c.id}">Edit</button><button class="btn danger" data-action="delete" data-id="${c.id}">Delete</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  $('#view').innerHTML = `
    ${!isAdmin ? '<div class="role-note">User access: you can add customers and vouchers. Payment recording and record editing are reserved for administrators.</div>' : ''}
    <div class="card toolbar">
      <input class="field" placeholder="Search customer or location" id="searchInput">
      ${monthControl('Filter customer records by month')}
    </div>
    <div class="card">
      <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Location</th><th>Vouchers</th><th>Purchases</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead>
      <tbody id="rows">${rows}</tbody></table></div>
      ${rows ? '' : '<div class="empty">No customers found for this view.</div>'}
    </div>
  `;
  bindMonthControls();
  const search = $('#searchInput');
  if (search) search.addEventListener('input', (e) => filterRows(e.target.value));
  bindRowActions([
    ['records', (id) => customerRecords(id)],
    ['edit', (id) => customerForm(id)],
    ['delete', (id) => removeCustomer(id)],
  ]);
}

function vouchersView() {
  head('Vouchers', 'Browse voucher records and filter them by buying month.', 'Add voucher', () => voucherForm());
  const list = [...vouchers]
    .filter((v) => inMonth(v.buyingDate, monthFilter))
    .sort((a, b) => String(b.buyingDate).localeCompare(String(a.buyingDate)));

  $('#view').innerHTML = `
    <div class="card toolbar">
      <input class="field" placeholder="Search VR ID, customer, or product" id="searchInput">
      ${monthControl('Filter vouchers by month')}
      <select class="field" id="statusFilter">
        <option value="">All statuses</option>
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partially paid</option>
        <option value="paid">Paid</option>
      </select>
    </div>
    <div class="card">${voucherTable(list, true)}</div>
  `;
  bindMonthControls();
  const search = $('#searchInput');
  if (search) search.addEventListener('input', (e) => filterRows(e.target.value));
  const sf = $('#statusFilter');
  if (sf) sf.addEventListener('change', (e) => filterStatus(e.target.value));
  bindRowActions([
    ['edit', (id) => voucherForm(id)],
    ['pay', (id) => paymentForm(null, id)],
    ['delete', (id) => removeVoucher(id)],
  ]);
}

function paymentsView() {
  const isAdmin = currentUser.role === 'admin';
  head('Payment records', 'View received payments by month.', isAdmin ? 'Record payment' : '', isAdmin ? () => paymentForm() : null);
  const list = [...payments]
    .filter((p) => inMonth(p.paymentDate, monthFilter))
    .sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));

  $('#view').innerHTML = `
    ${!isAdmin ? '<div class="role-note">Payment records are read-only for normal users.</div>' : ''}
    <div class="card toolbar">
      <input class="field" placeholder="Search customer or VR ID" id="searchInput">
      ${monthControl('Filter payments by month')}
    </div>
    <div class="card">${paymentTable(list, true)}</div>
  `;
  bindMonthControls();
  const search = $('#searchInput');
  if (search) search.addEventListener('input', (e) => filterRows(e.target.value));
  bindRowActions([
    ['edit-payment', (id) => paymentForm(id)],
  ]);
}

function customerById(id) {
  return customers.find((c) => c.id === id);
}

function voucherById(id) {
  return vouchers.find((v) => v.id === id);
}

function voucherTable(list, actions = false) {
  if (!list.length) return '<div class="empty">No voucher records found.</div>';
  const isAdmin = currentUser.role === 'admin';
  return `
    <div class="table-wrap"><table><thead><tr>
      <th>VR ID</th><th>Customer</th><th>Products</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th>
      ${actions ? '<th>Actions</th>' : ''}
    </tr></thead><tbody id="rows">
    ${list.map((v) => {
      const c = customerById(v.customerId);
      const s = status(v, payments);
      const items = (v.items || [])
        .map((i) => `<span class="chip"><b>${esc(i.product)}</b> &times; ${esc(i.quantity)} kg</span>`)
        .join('');
      return `<tr data-status="${s}" data-search="${esc((v.vrId + ' ' + (c?.name || '') + ' ' + (v.items || []).map((i) => i.product).join(' ')).toLowerCase())}">
        <td><b>${esc(v.vrId)}</b></td>
        <td>${esc(c?.name || 'Deleted')}</td>
        <td class="products-cell">${items || '—'}</td>
        <td>${date(v.buyingDate)}</td>
        <td>${money(voucherTotal(v))}</td>
        <td>${money(paidAmount(v.id, payments))}</td>
        <td><b>${money(balance(v, payments))}</b></td>
        <td><span class="badge ${s}">${s}</span></td>
        ${actions ? `<td>${isAdmin ? `<button class="btn link" data-action="edit" data-id="${v.id}">Edit</button>${balance(v, payments) > 0 ? `<button class="btn link" data-action="pay" data-id="${v.id}">Pay</button>` : ''}<button class="btn danger" data-action="delete" data-id="${v.id}">Delete</button>` : 'Read only'}</td>` : ''}
      </tr>`;
    }).join('')}
    </tbody></table></div>
  `;
}

function paymentTable(list, actions = false) {
  if (!list.length) return '<div class="empty">No payment records found.</div>';
  const isAdmin = currentUser.role === 'admin';
  return `
    <div class="table-wrap"><table><thead><tr>
      <th>Date</th><th>Customer</th><th>VR ID</th><th>Amount</th><th>Note</th>
      ${actions ? '<th>Access</th>' : ''}
    </tr></thead><tbody id="rows">
    ${list.map((p) => {
      const c = customerById(p.customerId);
      const v = voucherById(p.voucherId);
      return `<tr data-search="${esc(((c?.name || '') + ' ' + (v?.vrId || '')).toLowerCase())}">
        <td>${date(p.paymentDate)}</td>
        <td>${esc(c?.name || 'Deleted')}</td>
        <td>${esc(v?.vrId || 'Deleted')}</td>
        <td><b>${money(p.amount)}</b></td>
        <td>${esc(p.note || '—')}</td>
        ${actions ? `<td>${isAdmin ? `<button class="btn link" data-action="edit-payment" data-id="${p.id}">Edit</button>` : 'Read only'}</td>` : ''}
      </tr>`;
    }).join('')}
    </tbody></table></div>
  `;
}

function bindRowActions(actions) {
  actions.forEach(([action, handler]) => {
    document.querySelectorAll(`[data-action="${action}"]`).forEach((btn) => {
      btn.addEventListener('click', () => handler(btn.dataset.id));
    });
  });
}

function filterRows(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#rows tr').forEach((r) => {
    r.classList.toggle('hidden', !r.dataset.search.includes(q));
  });
}

function filterStatus(s) {
  document.querySelectorAll('#rows tr').forEach((r) => {
    r.classList.toggle('hidden', !!s && r.dataset.status !== s);
  });
}

/* ── Modal helpers ──────────────────────────────────────────────────── */

function openForm(title, html, onSubmit) {
  $('#modalTitle').textContent = title;
  const form = $('#form');
  form.innerHTML = html;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      await onSubmit(new FormData(form));
      await refresh();
      closeModal();
      toast('Saved successfully');
    } catch (err) {
      toast(err.message || 'Unable to save', true);
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
  };
  if (typeof modal.showModal === 'function') {
    try { modal.showModal(); } catch { modal.setAttribute('open', ''); modal.classList.add('fallback'); }
  } else {
    modal.setAttribute('open', '');
    modal.classList.add('fallback');
  }
}

function closeModal() {
  if (typeof modal.close === 'function') modal.close();
  else { modal.removeAttribute('open'); modal.classList.remove('fallback'); }
}

/* ── Customer form ──────────────────────────────────────────────────── */

function customerForm(id) {
  if (id && currentUser.role !== 'admin') return toast('Administrator permission required', true);
  const c = id ? customerById(id) : null;
  openForm(
    id ? 'Edit customer' : 'Add customer',
    `<div class="form-grid">
      <div><label>Name</label><input class="field" name="name" value="${esc(c?.name)}" required></div>
      <div><label>Location</label><input class="field" name="location" value="${esc(c?.location)}" required></div>
    </div>
    <div class="actions"><button type="button" class="btn soft" id="cancelBtn">Cancel</button><button class="btn primary">Save</button></div>`,
    async (f) => {
      const name = f.get('name').trim();
      const location = f.get('location').trim();
      if (id) await updateCustomer(id, name, location);
      else await createCustomer(name, location, currentUser.username);
    }
  );
  const cancel = $('#cancelBtn');
  if (cancel) cancel.addEventListener('click', closeModal);
}

/* ── Voucher form ───────────────────────────────────────────────────── */

function voucherForm(id) {
  if (id && currentUser.role !== 'admin') return toast('Administrator permission required', true);
  if (!customers.length) return toast('Add a customer first.', true);
  const v = id ? voucherById(id) : { items: [{ product: '', quantity: '', unitPrice: '', bagCharges: '', laborCharges: '' }], buyingDate: today() };
  const options = customers.map((c) => `<option value="${c.id}" ${c.id === v.customerId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  openForm(
    id ? 'Edit voucher' : 'Add voucher',
    `<div class="form-grid">
      <div><label>VR ID</label><input class="field" name="vrId" value="${esc(v.vrId)}" required></div>
      <div><label>Customer</label><select class="field" name="customerId" required><option value="">Select…</option>${options}</select></div>
      <div><label>Buying date</label><input class="field" type="date" name="buyingDate" value="${v.buyingDate}" required></div>
      <div class="full">
        <label>Products</label>
        <div id="items">${(v.items || []).map(itemRowHTML).join('')}</div>
        <button type="button" class="btn soft" id="addItemBtn">+ Add product</button>
        <div class="voucher-total"><span>Final voucher price</span><strong id="voucherTotal">${money(voucherTotal(v))}</strong></div>
      </div>
    </div>
    <div class="actions"><button type="button" class="btn soft" id="cancelBtn">Cancel</button><button class="btn primary">Save</button></div>`,
    async (f) => {
      const products = f.getAll('product');
      const rates = f.getAll('unitPrice');
      const kgs = f.getAll('quantity');
      const bags = f.getAll('bagCharges');
      const labors = f.getAll('laborCharges');
      const items = products.map((p, n) => ({
        product: p.trim(),
        unitPrice: +rates[n],
        quantity: +kgs[n],
        bagCharges: +bags[n],
        laborCharges: +labors[n],
      }));
      const vrId = f.get('vrId').trim();
      const customerId = f.get('customerId');
      const buyingDate = f.get('buyingDate');

      if (vouchers.some((x) => x.id !== id && x.vrId.toLowerCase() === vrId.toLowerCase())) {
        throw new Error('VR ID already exists.');
      }
      if (id) await updateVoucher(id, vrId, customerId, buyingDate, items);
      else await createVoucher(vrId, customerId, buyingDate, items, currentUser.username);
    }
  );

  const cancel = $('#cancelBtn');
  if (cancel) cancel.addEventListener('click', closeModal);
  const addBtn = $('#addItemBtn');
  if (addBtn) addBtn.addEventListener('click', addItem);
  document.querySelectorAll('#items .item-row').forEach(bindItemRow);
  updateVoucherTotal();
}

function itemRowHTML(x = {}) {
  return `<div class="item-row">
    <div><label>Product</label><input class="field" name="product" value="${esc(x.product)}" required></div>
    <div><label>Rate / kg</label><input class="field" name="unitPrice" type="number" min="0" step="0.01" value="${x.unitPrice ?? ''}" required></div>
    <div><label>Buy kg</label><input class="field" name="quantity" type="number" min="0.01" step="0.01" value="${x.quantity ?? ''}" required></div>
    <div><label>Bag charges</label><input class="field" name="bagCharges" type="number" min="0" step="0.01" value="${x.bagCharges || ''}"></div>
    <div><label>Labor charges</label><input class="field" name="laborCharges" type="number" min="0" step="0.01" value="${x.laborCharges || ''}"></div>
    <div class="line-wrap"><label>Final price</label><div class="field line-total">${money(itemTotal(x))}</div></div>
    <button type="button" class="close" aria-label="Remove">&times;</button>
  </div>`;
}

function bindItemRow(row) {
  row.addEventListener('input', updateVoucherTotal);
  const closeBtn = row.querySelector('.close');
  if (closeBtn) closeBtn.addEventListener('click', () => { row.remove(); updateVoucherTotal(); });
}

function addItem() {
  const container = $('#items');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', itemRowHTML());
  const newRow = container.lastElementChild;
  bindItemRow(newRow);
  updateVoucherTotal();
}

function updateVoucherTotal() {
  let sum = 0;
  document.querySelectorAll('#items .item-row').forEach((r) => {
    const q = (n) => +r.querySelector(`[name="${n}"]`)?.value || 0;
    const line = q('unitPrice') * q('quantity') + q('bagCharges') + q('laborCharges');
    const lt = r.querySelector('.line-total');
    if (lt) lt.textContent = money(line);
    sum += line;
  });
  const vt = $('#voucherTotal');
  if (vt) vt.textContent = money(sum);
}

/* ── Payment form ───────────────────────────────────────────────────── */

function paymentForm(id, voucherId) {
  if (currentUser.role !== 'admin') return toast('Only administrators can record payments.', true);
  if (!vouchers.length) return toast('Add a voucher first.', true);
  const p = id ? payments.find((x) => x.id === id) : { voucherId, paymentDate: today() };
  const available = vouchers.filter((v) => v.id === p.voucherId || balance(v, payments) > 0);
  const options = available
    .map((v) => {
      const c = customerById(v.customerId);
      return `<option value="${v.id}" ${v.id === p.voucherId ? 'selected' : ''}>${esc(v.vrId)} — ${esc(c?.name || '')} (due ${money(balance(v, payments))})</option>`;
    })
    .join('');

  openForm(
    id ? 'Edit payment' : 'Record payment',
    `<div class="form-grid">
      <div class="full"><label>Voucher</label><select class="field" name="voucherId" required id="voucherSelect"><option value="">Select…</option>${options}</select></div>
      <div><label>Amount</label><input class="field" name="amount" type="number" min="0.01" step="0.01" value="${p.amount || ''}" required></div>
      <div><label>Payment date</label><input class="field" type="date" name="paymentDate" value="${p.paymentDate}" required></div>
      <div class="full"><label>Note</label><textarea class="field" name="note" rows="3">${esc(p.note)}</textarea></div>
    </div>
    <div class="actions"><button type="button" class="btn soft" id="cancelBtn">Cancel</button><button class="btn primary">Save</button></div>`,
    async (f) => {
      const vid = f.get('voucherId');
      const v = voucherById(vid);
      const amount = +f.get('amount');
      const oldAmount = id ? +p.amount : 0;
      if (!v) throw new Error('Select a voucher.');
      if (amount > balance(v, payments) + oldAmount) throw new Error('Payment cannot exceed voucher balance.');
      const paymentDate = f.get('paymentDate');
      const note = f.get('note').trim();
      if (id) await updatePayment(id, vid, v.customerId, amount, paymentDate, note);
      else await createPayment(vid, v.customerId, amount, paymentDate, note, currentUser.username);
    }
  );
  const cancel = $('#cancelBtn');
  if (cancel) cancel.addEventListener('click', closeModal);
}

/* ── Customer records modal ─────────────────────────────────────────── */

function customerRecords(id) {
  const c = customerById(id);
  const list = vouchers.filter((v) => v.customerId === id && inMonth(v.buyingDate, monthFilter));
  openForm(
    `${esc(c?.name || 'Customer')} — voucher records`,
    `<div class="toolbar">
      <input class="field" type="month" value="${esc(monthFilter)}" id="monthPicker2">
      <button type="button" class="btn soft" id="clearMonth2">All months</button>
    </div>
    <div class="detail-summary">
      <div><small>Vouchers</small><b>${list.length}</b></div>
      <div><small>Total purchases</small><b>${money(list.reduce((s, v) => s + voucherTotal(v), 0))}</b></div>
      <div><small>Outstanding</small><b>${money(list.reduce((s, v) => s + balance(v, payments), 0))}</b></div>
    </div>
    <div class="card">${voucherTable(list)}</div>
    <div class="actions"><button type="button" class="btn soft" id="closeRecordsBtn">Close</button></div>`,
    () => {}
  );
  const picker2 = $('#monthPicker2');
  if (picker2) picker2.addEventListener('change', (e) => { monthFilter = e.target.value; closeModal(); customerRecords(id); });
  const clear2 = $('#clearMonth2');
  if (clear2) clear2.addEventListener('click', () => { monthFilter = ''; closeModal(); customerRecords(id); });
  const closeBtn = $('#closeRecordsBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
}

/* ── Delete actions ─────────────────────────────────────────────────── */

async function removeCustomer(id) {
  if (currentUser.role !== 'admin') return;
  const vids = vouchers.filter((v) => v.customerId === id).map((v) => v.id);
  if (payments.some((p) => p.customerId === id || vids.includes(p.voucherId))) {
    return toast('Cannot delete a customer with payment records.', true);
  }
  if (!confirm('Delete this customer and all related vouchers?')) return;
  try {
    await deleteCustomer(id);
    await refresh();
    toast('Customer deleted');
  } catch (err) {
    toast(err.message || 'Delete failed', true);
  }
}

async function removeVoucher(id) {
  if (currentUser.role !== 'admin') return;
  if (payments.some((p) => p.voucherId === id)) {
    return toast('Cannot delete a voucher with payment records.', true);
  }
  if (!confirm('Delete this voucher?')) return;
  try {
    await deleteVoucher(id);
    await refresh();
    toast('Voucher deleted');
  } catch (err) {
    toast(err.message || 'Delete failed', true);
  }
}

init();
