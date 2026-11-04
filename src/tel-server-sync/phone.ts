export function getTelnr(value: string | null | undefined): string | false {
  const input = value ?? '';
  if (input.length < 3) return false;

  const nr = input.replace(/[^0-9+]/g, '');
  const plusPosition = nr.indexOf('+');

  if (plusPosition !== -1 && plusPosition !== 0) return false;
  if (plusPosition === 0) return nr.slice(1);
  if (nr[0] === '0' && nr[1] === '0') return nr.slice(2);
  if (nr[0] === '0' && nr[1] !== '0') return `31${nr.slice(1)}`;

  return nr;
}
