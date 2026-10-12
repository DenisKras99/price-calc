// Presentation only: never round intermediate financial calculations.
export function formatNumber(value,locale='ru-RU',digits=2) {
  return new Intl.NumberFormat(locale,{maximumFractionDigits:Math.min(2,Math.max(0,digits)),signDisplay:'exceptZero'}).format(value).replace(/^\+/, '');
}
// A displayed negotiation ceiling must not round UP beyond indifference.
export function formatCeilingPercent(rate,locale='ru-RU') {
  return formatNumber(Math.floor(rate*10000+1e-9)/100,locale);
}
export function inputNumber(value) {
  return Number(value.toFixed(2));
}
