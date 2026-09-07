export function money(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

export function date(d) {
  if (!d) return '—';
  const dt = typeof d === 'string' && d.length === 10 ? new Date(d + 'T00:00:00') : new Date(d);
  return dt.toLocaleDateString();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

export function itemTotal(item) {
  return (+item.unitPrice || 0) * (+item.quantity || 0) + (+item.bagCharges || 0) + (+item.laborCharges || 0);
}

export function voucherTotal(v) {
  return (v.items || []).reduce((s, x) => s + itemTotal(x), 0);
}

export function paidAmount(voucherId, payments) {
  return payments
    .filter((p) => p.voucherId === voucherId)
    .reduce((s, p) => s + (+p.amount || 0), 0);
}

export function balance(voucher, payments) {
  return Math.max(0, voucherTotal(voucher) - paidAmount(voucher.id, payments));
}

export function status(voucher, payments) {
  const paid = paidAmount(voucher.id, payments);
  const bal = Math.max(0, voucherTotal(voucher) - paid);
  if (paid <= 0) return 'unpaid';
  if (bal <= 0) return 'paid';
  return 'partial';
}

export function inMonth(d, m) {
  return !m || String(d || '').slice(0, 7) === m;
}

let toastTimer = null;
export function toast(text, error = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.background = error ? 'var(--danger)' : 'var(--moss)';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2000);
}
