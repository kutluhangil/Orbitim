import type { AppLanguage } from '../ui/i18n';

interface DeepSkyText {
  name: string;
  type: string;
  distance: string;
  instrument: string;
  summary: string;
  imageAlt: string;
}

export interface DeepSkyTarget {
  id: string;
  imageUrl: string;
  sourceUrl: string;
  imageSourceUrl: string;
  imageCredit: string;
  en: DeepSkyText;
  tr: DeepSkyText;
}

/**
 * This is intentionally a small gallery, not a claim to catalogue all
 * galaxies. Each image URL is a NASA-provided image asset and each fact card
 * links to the NASA Science page that supplies its context.
 */
export const DEEP_SKY_TARGETS: readonly DeepSkyTarget[] = [
  {
    id: 'm31',
    imageUrl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000833/GSFC_20171208_Archive_e000833~small.jpg',
    sourceUrl: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/',
    imageSourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000833',
    imageCredit: 'NASA, ESA and G. Bacon (STScI)',
    en: {
      name: 'Andromeda · M31', type: 'Spiral galaxy', distance: '2.5 million light-years', instrument: 'Hubble Space Telescope',
      summary: 'Our nearest major galactic neighbour. This Hubble mosaic combines many pointings; it is not a single exposure.',
      imageAlt: 'A NASA Hubble mosaic view of the Andromeda Galaxy.'
    },
    tr: {
      name: 'Andromeda · M31', type: 'Sarmal galaksi', distance: '2,5 milyon ışık yılı', instrument: 'Hubble Uzay Teleskobu',
      summary: 'En yakın büyük galaktik komşumuz. Bu Hubble mozaiği birçok hedeflemenin birleşimidir; tek bir poz değildir.',
      imageAlt: 'Andromeda Galaksisi’nin NASA Hubble mozaik görünümü.'
    }
  },
  {
    id: 'm51',
    imageUrl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001925/GSFC_20171208_Archive_e001925~medium.jpg',
    sourceUrl: 'https://science.nasa.gov/image-detail/hubble_m51/',
    imageSourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001925',
    imageCredit: 'NASA, ESA, S. Beckwith (STScI) and the Hubble Heritage Team (STScI/AURA)',
    en: {
      name: 'Whirlpool · M51', type: 'Spiral galaxy', distance: '31 million light-years', instrument: 'Hubble Space Telescope',
      summary: 'A spiral system whose visible arms, star-forming regions and companion interaction can be read together in the source image.',
      imageAlt: 'A NASA Hubble view of the Whirlpool Galaxy, Messier 51.'
    },
    tr: {
      name: 'Girdap · M51', type: 'Sarmal galaksi', distance: '31 milyon ışık yılı', instrument: 'Hubble Uzay Teleskobu',
      summary: 'Kaynak görüntüde sarmal kolları, yıldız oluşum bölgeleri ve eşlikçi galaksi etkileşimi birlikte okunabilen bir sistem.',
      imageAlt: 'Girdap Galaksisi Messier 51’in NASA Hubble görüntüsü.'
    }
  },
  {
    id: 'm104',
    imageUrl: 'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/hubble/galaxies/spiral/STScI-01EVT1FE98G6AWBYKRCJWYVBDE.png?crop=faces%2Cfocalpoint&fit=clip&h=960&w=2000',
    sourceUrl: 'https://science.nasa.gov/asset/hubble/sombrero-galaxy/',
    imageSourceUrl: 'https://science.nasa.gov/asset/hubble/sombrero-galaxy/',
    imageCredit: 'NASA and the Hubble Heritage Team (STScI/AURA)',
    en: {
      name: 'Sombrero · M104', type: 'Edge-on spiral galaxy', distance: '28 million light-years', instrument: 'Hubble · ACS/WFC',
      summary: 'Its bright bulge and dust lane are a line-of-sight effect: the galaxy is observed almost edge-on.',
      imageAlt: 'A NASA Hubble view of the Sombrero Galaxy, Messier 104.'
    },
    tr: {
      name: 'Sombrero · M104', type: 'Kenardan görülen sarmal galaksi', distance: '28 milyon ışık yılı', instrument: 'Hubble · ACS/WFC',
      summary: 'Parlak şişkinlik ve toz şeridi bakış doğrultusunun sonucudur: galaksi neredeyse kenardan gözlenir.',
      imageAlt: 'Sombrero Galaksisi Messier 104’ün NASA Hubble görüntüsü.'
    }
  },
  {
    id: 'ngc-1300',
    imageUrl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e002154/GSFC_20171208_Archive_e002154~medium.jpg',
    sourceUrl: 'https://science.nasa.gov/image-detail/ngc-1300/',
    imageSourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e002154',
    imageCredit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA); acknowledgment: P. Knezek (WIYN)',
    en: {
      name: 'NGC 1300', type: 'Barred spiral galaxy', distance: 'Distance not displayed here', instrument: 'Hubble · ACS',
      summary: 'The source identifies the stellar bar and its nested inner spiral; no unverified distance is added to this compact card.',
      imageAlt: 'A NASA Hubble view of the barred spiral galaxy NGC 1300.'
    },
    tr: {
      name: 'NGC 1300', type: 'Çubuklu sarmal galaksi', distance: 'Uzaklık bu kartta gösterilmiyor', instrument: 'Hubble · ACS',
      summary: 'Kaynak yıldız çubuğunu ve içteki sarmal yapıyı açıklar; bu kısa karta doğrulanmamış bir uzaklık eklenmez.',
      imageAlt: 'Çubuklu sarmal galaksi NGC 1300’ün NASA Hubble görüntüsü.'
    }
  },
  {
    id: 'cartwheel',
    imageUrl: 'https://science.nasa.gov/wp-content/uploads/2023/09/stsci-01g8jzq6gwxhex15pyy60wdrsk-2.png',
    sourceUrl: 'https://science.nasa.gov/missions/webb/webb-captures-stellar-gymnastics-in-the-cartwheel-galaxy/',
    imageSourceUrl: 'https://science.nasa.gov/image-detail/stsci-01g8jzq6gwxhex15pyy60wdrsk-2/',
    imageCredit: 'NASA, ESA, CSA, STScI and the Webb ERO Production Team',
    en: {
      name: 'Cartwheel Galaxy', type: 'Collision-shaped ring galaxy', distance: 'About 500 million light-years', instrument: 'Webb · NIRCam + MIRI',
      summary: 'The ring-like form follows a high-speed collision. The source image combines near- and mid-infrared Webb observations.',
      imageAlt: 'A NASA Webb view of the Cartwheel Galaxy and companion galaxies.'
    },
    tr: {
      name: 'Araba Tekerleği Galaksisi', type: 'Çarpışmayla şekillenmiş halkalı galaksi', distance: 'Yaklaşık 500 milyon ışık yılı', instrument: 'Webb · NIRCam + MIRI',
      summary: 'Halka benzeri yapı yüksek hızlı bir çarpışmanın sonucudur. Kaynak görüntü Webb’in yakın ve orta kızılötesi gözlemlerini birleştirir.',
      imageAlt: 'Araba Tekerleği Galaksisi ve eşlikçilerinin NASA Webb görüntüsü.'
    }
  }
];

export function deepSkyText(target: DeepSkyTarget, language: AppLanguage): DeepSkyText {
  return target[language];
}
