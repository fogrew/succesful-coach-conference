document.addEventListener('DOMContentLoaded', function () {
  // Dynamic Pricing
  const priceElem = document.getElementById('dynamic-price');
  const descElem = document.getElementById('dynamic-price-desc');
  if (priceElem && descElem) {
    const now = new Date();
    const sept1 = new Date(2025, 8, 1, 23, 59, 59); // 1 сентября
    const oct1 = new Date(2025, 9, 1, 23, 59, 59); // 1 октября
    const oct5 = new Date(2025, 9, 5, 23, 59, 59); // 5 октября

    let price = '';
    let desc = '';
    if (now < sept1) {
      price = '3990 ₽';
      desc = 'Цена действует до 1 сентября';
    } else if (now < oct1) {
      price = '4990 ₽';
      desc = 'Цена действует до 1 октября';
    } else if (now <= oct5) {
      price = '7990 ₽';
      desc = 'Цена действует до 5 октября';
    } else {
      price = 'Продажа завершена';
      desc = '';
    }
    priceElem.textContent = price;
    descElem.textContent = desc;
  }

  // Горизонтальный слайдер для блока "Как это было в прошлом году"
  const slider = document.querySelector('.last-year__gallery-slider');
  if (slider) {
    const track = slider.querySelector('.last-year__gallery-track');
    const left = slider.querySelector('.last-year__gallery-arrow--left');
    const right = slider.querySelector('.last-year__gallery-arrow--right');
    const scrollStep = 350;

    if (left && track) {
      left.addEventListener('click', () => {
        track.scrollBy({ left: -scrollStep, behavior: 'smooth' });
      });
    }
    if (right && track) {
      right.addEventListener('click', () => {
        track.scrollBy({ left: scrollStep, behavior: 'smooth' });
      });
    }
  }
});
