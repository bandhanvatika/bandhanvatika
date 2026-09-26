/**
 * Converts a numeric amount to Indian English words.
 * e.g. 150000 -> "Rupees One Lakh Fifty Thousand Only"
 */
export function amountToIndianWords(amount: number | string): string {
  const num = Math.round(Number(amount));
  if (isNaN(num) || num <= 0) return 'Rupees Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tensMultiple = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelowThousand(n: number): string {
    let str = '';
    if (n >= 100) {
      str += singleDigits[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      str += twoDigits[n - 10] + ' ';
    } else if (n >= 20) {
      str += tensMultiple[Math.floor(n / 10)] + ' ';
      if (n % 10 > 0) {
        str += singleDigits[n % 10] + ' ';
      }
    } else if (n > 0) {
      str += singleDigits[n] + ' ';
    }
    return str;
  }

  let words = '';
  let n = num;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore > 0) words += convertBelowThousand(crore) + 'Crore ';
  if (lakh > 0) words += convertBelowThousand(lakh) + 'Lakh ';
  if (thousand > 0) words += convertBelowThousand(thousand) + 'Thousand ';
  if (remainder > 0) words += convertBelowThousand(remainder);

  return `Rupees ${words.trim()} Only`;
}
