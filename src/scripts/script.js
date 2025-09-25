document.addEventListener('DOMContentLoaded', function () {
  const priceElem = document.getElementById('dynamic-price');
  const descElem = document.getElementById('dynamic-price-desc');
  if (priceElem && descElem) {
    const now = new Date();
    const sept10 = new Date(2025, 8, 10, 23, 59, 59); // 1 сентября
    const oct1 = new Date(2025, 9, 1, 23, 59, 59); // 1 октября
    const oct5 = new Date(2025, 9, 5, 23, 59, 59); // 5 октября

    let price = '';
    let desc = '';
    if (now < sept10) {
      price = '3990 ₽';
      desc = 'Цена действует до 10 сентября';
    } else if (now < oct1) {
      price = '4990 ₽';
      desc = 'Цена действует до 1 октября';
    } else if (now <= oct5) {
      price = '5990 ₽';
      desc = 'Цена действует до 5 октября';
    } else {
      price = 'Продажа завершена';
      desc = '';
    }
    priceElem.textContent = price;
    descElem.textContent = desc;
  }
});
