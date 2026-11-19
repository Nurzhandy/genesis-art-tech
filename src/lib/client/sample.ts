'use client';
// «Заполнить примером» (A10 / R8): жюри проходит живую генерацию за два клика, без своих фото.
// Фото в public/sample/ — заглушки; замените на настоящие фото любимого дня команды (01–03.jpg).

export const SAMPLE = {
  text:
    'Гуляли по парку, всё в жёлтых листьях. Было холодно, руки мёрзли, но мы взяли какао в бумажных стаканах ' +
    'и долго разговаривали на скамейке у пруда. Пахло мокрой листвой и корицей, где-то играла уличная гитара. ' +
    'Солнце садилось рано, и всё вокруг стало медовым.',
  photos: ['/sample/01.jpg', '/sample/02.jpg', '/sample/03.jpg'],
  // Frank Sinatra — Autumn Leaves: ссылка на Deezer, у трека есть официальное 30-секундное превью и BPM.
  songUrl: 'https://www.deezer.com/track/3231839',
};

export async function samplePhotoFiles(): Promise<File[]> {
  return Promise.all(SAMPLE.photos.map(async (url, i) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Не удалось загрузить фото примера');
    return new File([await res.blob()], `sample-${i + 1}.jpg`, { type: 'image/jpeg' });
  }));
}
