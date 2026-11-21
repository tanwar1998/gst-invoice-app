export function money(paise, symbol = '₹') {
  const value = (Number(paise) || 0) / 100;
  return `${symbol}${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function moneyFromRupees(rupees, symbol = '₹') {
  return money(Math.round((Number(rupees) || 0) * 100), symbol);
}

export function formatQuantity(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export function formatDate(dateString, format = 'DD/MM/YYYY') {
  if (!dateString) return '-';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (format) {
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD-MMM-YYYY':
      return `${dd}-${months[date.getMonth()]}-${yyyy}`;
    case 'DD/MM/YYYY':
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
