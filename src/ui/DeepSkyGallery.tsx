import { ArrowUpRight, ImageIcon, ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEEP_SKY_TARGETS, deepSkyText } from '../data/deepSky';
import { useLanguage } from './i18n';

const COPY = {
  en: {
    eyebrow: 'Curated NASA observations',
    title: 'A nearby-universe field guide',
    body: 'Five named galaxies, chosen for legible structure and direct NASA source pages. This is a credited reading gallery, not a claim to map every galaxy.',
    imageCredit: 'Image credit',
    distance: 'Distance',
    instrument: 'Instrument',
    selected: 'Selected target',
    open: 'Read {name}',
    imageRecord: 'Open NASA image record',
    unavailable: 'NASA image asset unavailable. Open the source record for the original asset.'
  },
  tr: {
    eyebrow: 'Kürasyonlu NASA gözlemleri',
    title: 'Yakın evren için alan rehberi',
    body: 'Okunabilir yapıları ve doğrudan NASA kaynak sayfaları için seçilmiş beş adlandırılmış galaksi. Bu kredili bir okuma galerisi; tüm galaksileri haritalama iddiası değil.',
    imageCredit: 'Görüntü kredisi',
    distance: 'Uzaklık',
    instrument: 'Araç',
    selected: 'Seçili hedef',
    open: '{name} hakkında oku',
    imageRecord: 'NASA görüntü kaydını aç',
    unavailable: 'NASA görüntü varlığı kullanılamıyor. Orijinal varlık için kaynak kaydını açın.'
  }
} as const;

function interpolate(template: string, value: string): string {
  return template.replace('{name}', value);
}

export function DeepSkyGallery() {
  const language = useLanguage((state) => state.language);
  const copy = COPY[language];
  const [selectedId, setSelectedId] = useState(DEEP_SKY_TARGETS[0].id);
  const selected = DEEP_SKY_TARGETS.find((target) => target.id === selectedId) ?? DEEP_SKY_TARGETS[0];
  const selectedText = deepSkyText(selected, language);

  return (
    <section aria-labelledby="deep-sky-gallery-title" className="mt-10 border-t border-sky-100/10 pt-10">
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-200/80">{copy.eyebrow}</p>
        <h2 id="deep-sky-gallery-title" className="mt-3 text-3xl font-extralight tracking-[-0.03em] text-white sm:text-4xl">{copy.title}</h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-300/65">{copy.body}</p>
      </div>

      <ul className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label={copy.title}>
        {DEEP_SKY_TARGETS.map((target) => {
          const text = deepSkyText(target, language);
          const active = target.id === selected.id;
          return (
            <li key={target.id}>
            <button
              type="button"
              aria-pressed={active}
              aria-controls="deep-sky-selected"
              aria-label={`${text.name} · ${target.imageCredit}`}
              onClick={() => setSelectedId(target.id)}
              className={`group overflow-hidden rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/75 ${active ? 'border-amber-200/45 bg-amber-200/[0.06]' : 'border-white/10 bg-white/[0.025] hover:border-sky-200/35'}`}
            >
              <NasaImage target={target} alt={text.imageAlt} unavailable={copy.unavailable} className="aspect-[4/3] w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100" />
              <span className="block p-3">
                <span className="block text-[13px] text-white">{text.name}</span>
                <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.13em] text-slate-400">{text.type}</span>
                <span className="mt-2 block text-[8px] leading-3 text-slate-500">© {target.imageCredit}</span>
              </span>
            </button>
            </li>
          );
        })}
      </ul>

      <article id="deep-sky-selected" aria-label={copy.selected} className="mt-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.025] sm:grid sm:grid-cols-[minmax(12rem,0.85fr)_minmax(0,1.15fr)]">
        <NasaImage target={selected} alt={selectedText.imageAlt} unavailable={copy.unavailable} className="h-full min-h-52 w-full bg-slate-950 object-contain" priority />
        <div className="p-5 sm:p-6">
          <p className="sr-only" aria-live="polite" aria-atomic="true">{copy.selected}: {selectedText.name}</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-200/80">{selectedText.type}</p>
          <h3 className="mt-2 text-2xl font-light tracking-tight text-white">{selectedText.name}</h3>
          <p className="mt-3 text-[13px] leading-6 text-slate-300/70">{selectedText.summary}</p>
          <dl className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-[11px] sm:grid-cols-3">
            <div><dt className="text-slate-500">{copy.distance}</dt><dd className="mt-1 font-mono text-slate-200/85">{selectedText.distance}</dd></div>
            <div><dt className="text-slate-500">{copy.instrument}</dt><dd className="mt-1 font-mono text-slate-200/85">{selectedText.instrument}</dd></div>
            <div><dt className="text-slate-500">{copy.imageCredit}</dt><dd className="mt-1 leading-4 text-slate-200/85">{selected.imageCredit}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200/25 px-4 text-[10px] uppercase tracking-[0.14em] text-sky-100 transition-colors hover:border-sky-100/60 hover:bg-sky-200/[0.08]">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              {interpolate(copy.open, selectedText.name)}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
            {selected.imageSourceUrl !== selected.sourceUrl && (
              <a href={selected.imageSourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-[10px] uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-white/35 hover:text-white">
                {copy.imageRecord}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      </article>

    </section>
  );
}

function NasaImage({ target, alt, unavailable, className, priority = false }: { target: (typeof DEEP_SKY_TARGETS)[number]; alt: string; unavailable: string; className: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [target.imageUrl]);
  if (failed) {
    return (
      <div aria-label={unavailable} className={`${className} flex items-center justify-center bg-slate-950 px-4 text-center text-[11px] leading-5 text-slate-400`}>
        <ImageOff className="mr-2 h-4 w-4 shrink-0 text-rose-200/70" aria-hidden />
        {unavailable}
      </div>
    );
  }
  return <img src={target.imageUrl} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} className={className} />;
}
