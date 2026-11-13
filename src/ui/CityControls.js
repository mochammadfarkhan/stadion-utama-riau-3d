/** Bar kendali pratinjau kota: slider jam, tombol Tur, tombol Putar waktu. DOM saja; logika ada di cityPreview. */

export const formatHour = (h) => {
  const total = Math.round((((h % 24) + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * @param {HTMLElement} parent
 * @param {{onHour(h: number): void, onTour(on: boolean): void, onLapse(on: boolean): void}} cb
 */
export function createCityControls(parent, { onHour, onTour, onLapse }) {
  const root = document.createElement('div');
  root.id = 'city-controls';
  root.hidden = true;

  const readout = document.createElement('span');
  readout.className = 'city-clock';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '24'; slider.step = '0.05';
  slider.setAttribute('aria-label', 'Jam');
  let dragging = false;
  slider.addEventListener('pointerdown', () => { dragging = true; });
  slider.addEventListener('pointerup', () => { dragging = false; });
  slider.addEventListener('input', () => { readout.textContent = formatHour(Number(slider.value)); onHour(Number(slider.value)); });

  const toggle = (label, cb) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'city-toggle'; b.textContent = label; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); cb(on); });
    return b;
  };
  const tourBtn = toggle('Tur', onTour);
  const lapseBtn = toggle('Putar waktu', onLapse);
  root.append(readout, slider, lapseBtn, tourBtn);
  parent.appendChild(root);

  return {
    setVisible(on) { root.hidden = !on; },
    /** Sinkronkan tampilan dengan jam permainan (tidak mengganggu saat slider diseret). */
    setHour(h) {
      if (dragging) return;
      slider.value = String(h);
      readout.textContent = formatHour(h);
    },
    reset() {
      for (const b of [tourBtn, lapseBtn]) b.setAttribute('aria-pressed', 'false');
    },
    dispose() { root.remove(); },
  };
}
