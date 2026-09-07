import { supabase } from './supabase.js';

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, location, created_by, created_at')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createCustomer(name, location, username) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, location, created_by: username })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id, name, location) {
  const { data, error } = await supabase
    .from('customers')
    .update({ name, location })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchVouchers() {
  const { data, error } = await supabase
    .from('vouchers')
    .select('id, vr_id, customer_id, buying_date, created_by, created_at, voucher_items(id, product, unit_price, quantity, bag_charges, labor_charges)')
    .order('buying_date', { ascending: false });
  if (error) throw error;
  return data.map((v) => ({
    id: v.id,
    vrId: v.vr_id,
    customerId: v.customer_id,
    buyingDate: v.buying_date,
    createdBy: v.created_by,
    createdAt: v.created_at,
    items: (v.voucher_items || []).map((i) => ({
      id: i.id,
      product: i.product,
      unitPrice: +i.unit_price,
      quantity: +i.quantity,
      bagCharges: +i.bag_charges,
      laborCharges: +i.labor_charges,
    })),
  }));
}

export async function createVoucher(vrId, customerId, buyingDate, items, username) {
  const { data: voucher, error: vErr } = await supabase
    .from('vouchers')
    .insert({ vr_id: vrId, customer_id: customerId, buying_date: buyingDate, created_by: username })
    .select()
    .single();
  if (vErr) throw vErr;

  const rows = items.map((i) => ({
    voucher_id: voucher.id,
    product: i.product,
    unit_price: i.unitPrice,
    quantity: i.quantity,
    bag_charges: i.bagCharges || 0,
    labor_charges: i.laborCharges || 0,
  }));
  const { error: iErr } = await supabase.from('voucher_items').insert(rows);
  if (iErr) throw iErr;
  return voucher;
}

export async function updateVoucher(id, vrId, customerId, buyingDate, items) {
  const { error: vErr } = await supabase
    .from('vouchers')
    .update({ vr_id: vrId, customer_id: customerId, buying_date: buyingDate })
    .eq('id', id);
  if (vErr) throw vErr;

  const { error: dErr } = await supabase.from('voucher_items').delete().eq('voucher_id', id);
  if (dErr) throw dErr;

  const rows = items.map((i) => ({
    voucher_id: id,
    product: i.product,
    unit_price: i.unitPrice,
    quantity: i.quantity,
    bag_charges: i.bagCharges || 0,
    labor_charges: i.laborCharges || 0,
  }));
  if (rows.length > 0) {
    const { error: iErr } = await supabase.from('voucher_items').insert(rows);
    if (iErr) throw iErr;
  }
}

export async function deleteVoucher(id) {
  const { error } = await supabase.from('vouchers').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('id, voucher_id, customer_id, amount, payment_date, note, recorded_by, created_at')
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    voucherId: p.voucher_id,
    customerId: p.customer_id,
    amount: +p.amount,
    paymentDate: p.payment_date,
    note: p.note,
    recordedBy: p.recorded_by,
    createdAt: p.created_at,
  }));
}

export async function createPayment(voucherId, customerId, amount, paymentDate, note, username) {
  const { data, error } = await supabase
    .from('payments')
    .insert({ voucher_id: voucherId, customer_id: customerId, amount, payment_date: paymentDate, note, recorded_by: username })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayment(id, voucherId, customerId, amount, paymentDate, note) {
  const { data, error } = await supabase
    .from('payments')
    .update({ voucher_id: voucherId, customer_id: customerId, amount, payment_date: paymentDate, note })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
