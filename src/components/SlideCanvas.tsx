import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Slide, ThemeConfig } from '../types/deck';
import { SlideChart } from './SlideChart';

interface SlideCanvasProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  deckTitle: string;
  theme: ThemeConfig;
  editable?: boolean;
  onChange?: (updated: Slide) => void;
  className?: string;
}

interface InlineTextProps {
  value: string;
  onChange?: (val: string) => void;
  editable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

const InlineText: React.FC<InlineTextProps> = ({
  value,
  onChange,
  editable,
  className = '',
  style,
  placeholder = '',
  multiline = true,
  rows = 1,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value, editable]);

  if (!editable || !onChange) {
    return (
      <div className={className} style={style}>
        {value}
      </div>
    );
  }

  if (!multiline) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-transparent outline-none rounded-sm transition-shadow focus:ring-2 focus:ring-blue-500/40 hover:ring-1 hover:ring-blue-400/30 ${className}`}
        style={style}
      />
    );
  }

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-transparent outline-none resize-none overflow-hidden rounded-sm transition-shadow focus:ring-2 focus:ring-blue-500/40 hover:ring-1 hover:ring-blue-400/30 ${className}`}
      style={style}
    />
  );
};

interface ResilientImageProps {
  src?: string;
  alt: string;
  caption?: string;
  theme: ThemeConfig;
  className?: string;
}

const ResilientImage: React.FC<ResilientImageProps> = ({ src, alt, caption, theme, className = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center gap-2 rounded-lg border ${className}`}
        style={{ backgroundColor: theme.surfaceHex, borderColor: theme.borderHex, color: theme.mutedHex }}
      >
        <ImageIcon className="w-7 h-7 opacity-60" />
        <span className="text-[11px] font-medium">Visual asset placeholder</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden rounded-lg border ${className}`} style={{ borderColor: theme.borderHex }}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
      {caption && (
        <div
          className="absolute bottom-0 inset-x-0 px-3 py-2 text-[11px] font-medium"
          style={{
            background: 'linear-gradient(to top, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.25), transparent)',
            color: '#F8FAFC',
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};

export const SLIDE_BASE_WIDTH = 960;
export const SLIDE_BASE_HEIGHT = 540;

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  slideIndex,
  totalSlides,
  deckTitle,
  theme,
  editable = false,
  onChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setScale(rect.width / SLIDE_BASE_WIDTH);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const updateField = <K extends keyof Slide>(key: K, val: Slide[K]) => {
    if (!onChange) return;
    onChange({ ...slide, [key]: val });
  };

  const titleFontClass = theme.titleFont === 'serif' ? 'font-slide-serif' : 'font-display';
  const numLabel = `${String(slideIndex + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`;

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video overflow-hidden select-none ${editable ? 'select-text' : ''} ${className}`}
      style={{ backgroundColor: theme.bgHex }}
    >
      <div
        style={{
          width: SLIDE_BASE_WIDTH,
          height: SLIDE_BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundColor: theme.bgHex,
          color: theme.inkHex,
        }}
        className="relative flex flex-col justify-between p-[46px] font-slide-sans"
      >
        {slide.layout === 'title' ? (
          <div className="flex-1 flex items-stretch gap-10 h-full">
            <div className={`flex flex-col justify-between ${slide.imageUrl ? 'w-[54%]' : 'w-full max-w-[760px]'}`}>
              <div className="pt-2">
                {(slide.kicker || editable) && (
                  <InlineText
                    value={slide.kicker ?? ''}
                    onChange={(val) => updateField('kicker', val)}
                    editable={editable}
                    placeholder="Add kicker..."
                    multiline={false}
                    className="text-[13px] font-semibold tracking-wide mb-4"
                    style={{ color: theme.accentHex }}
                  />
                )}
                <InlineText
                  value={slide.title}
                  onChange={(val) => updateField('title', val)}
                  editable={editable}
                  placeholder="Presentation Title"
                  className={`${titleFontClass} text-[44px] font-bold leading-[1.08] tracking-tight text-balance`}
                  style={{ color: theme.inkHex }}
                />
                {(slide.subtitle || editable) && (
                  <InlineText
                    value={slide.subtitle ?? ''}
                    onChange={(val) => updateField('subtitle', val)}
                    editable={editable}
                    placeholder="Add concise subtitle..."
                    className="text-[17px] leading-[1.5] mt-5"
                    style={{ color: theme.mutedHex }}
                  />
                )}
              </div>

              <div
                className="pt-5 border-t flex items-center justify-between gap-4"
                style={{ borderColor: theme.borderHex }}
              >
                <InlineText
                  value={slide.callout ?? ''}
                  onChange={(val) => updateField('callout', val)}
                  editable={editable}
                  placeholder="Presenter or date metadata..."
                  multiline={false}
                  className="text-[12.5px] font-medium"
                  style={{ color: theme.mutedHex }}
                />
                <span className="text-[12px] font-mono-tabular shrink-0" style={{ color: theme.mutedHex }}>
                  {numLabel}
                </span>
              </div>
            </div>

            {slide.imageUrl && (
              <div className="w-[46%] h-full">
                <ResilientImage
                  src={slide.imageUrl}
                  alt={slide.title}
                  caption={slide.imageCaption}
                  theme={theme}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Content Slide Header */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-1.5">
                {(slide.kicker || editable) ? (
                  <InlineText
                    value={slide.kicker ?? ''}
                    onChange={(val) => updateField('kicker', val)}
                    editable={editable}
                    placeholder="Section kicker..."
                    multiline={false}
                    className="text-[12px] font-semibold tracking-wide"
                    style={{ color: theme.accentHex }}
                  />
                ) : (
                  <span />
                )}
              </div>
              <InlineText
                value={slide.title}
                onChange={(val) => updateField('title', val)}
                editable={editable}
                placeholder="Slide Title"
                className={`${titleFontClass} text-[28px] font-bold leading-[1.18] tracking-tight text-balance`}
                style={{ color: theme.inkHex }}
              />
              {slide.layout !== 'quote' && (slide.subtitle || editable) && (
                <InlineText
                  value={slide.subtitle ?? ''}
                  onChange={(val) => updateField('subtitle', val)}
                  editable={editable}
                  placeholder="Optional 1-line summary..."
                  className="text-[14.5px] leading-[1.45] mt-1.5"
                  style={{ color: theme.mutedHex }}
                />
              )}
            </div>

            {/* Slide Main Body */}
            <div className="flex-1 flex flex-col justify-center my-4 min-h-0">
              {slide.layout === 'bullets' && (
                <div className="flex flex-col justify-between h-full gap-4">
                  <div className="flex flex-col gap-3.5 my-auto">
                    {(slide.bullets ?? []).map((bullet, idx) => (
                      <div key={idx} className="flex items-start gap-3.5">
                        <span
                          className="text-[13px] font-mono-tabular font-semibold pt-0.5 shrink-0"
                          style={{ color: theme.accentHex }}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <InlineText
                          value={bullet}
                          onChange={(val) => {
                            const next = [...(slide.bullets ?? [])];
                            next[idx] = val;
                            updateField('bullets', next);
                          }}
                          editable={editable}
                          className="text-[16px] leading-[1.48] flex-1"
                          style={{ color: theme.inkHex }}
                        />
                      </div>
                    ))}
                  </div>
                  {(slide.callout || editable) && (
                    <div
                      className="px-4 py-3 rounded-lg border text-[13px] font-medium"
                      style={{
                        backgroundColor: theme.surfaceHex,
                        borderColor: theme.borderHex,
                        color: theme.inkHex,
                      }}
                    >
                      <InlineText
                        value={slide.callout ?? ''}
                        onChange={(val) => updateField('callout', val)}
                        editable={editable}
                        placeholder="Optional takeaway callout..."
                        multiline={false}
                      />
                    </div>
                  )}
                </div>
              )}

              {slide.layout === 'two-column' && (
                <div className="grid grid-cols-2 gap-6 h-full items-stretch">
                  {(slide.columns ?? []).slice(0, 2).map((col, colIdx) => (
                    <div
                      key={colIdx}
                      className="p-6 rounded-lg border flex flex-col gap-4"
                      style={{
                        backgroundColor: theme.surfaceHex,
                        borderColor: theme.borderHex,
                      }}
                    >
                      <InlineText
                        value={col.title}
                        onChange={(val) => {
                          const next = [...(slide.columns ?? [])];
                          next[colIdx] = { ...col, title: val };
                          updateField('columns', next);
                        }}
                        editable={editable}
                        className={`${titleFontClass} text-[17px] font-semibold pb-3 border-b`}
                        style={{ color: theme.inkHex, borderColor: theme.borderHex }}
                      />
                      <div className="flex flex-col gap-3">
                        {col.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex items-start gap-2.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                              style={{ backgroundColor: theme.accentHex }}
                            />
                            <InlineText
                              value={item}
                              onChange={(val) => {
                                const nextCols = [...(slide.columns ?? [])];
                                const nextItems = [...col.items];
                                nextItems[itemIdx] = val;
                                nextCols[colIdx] = { ...col, items: nextItems };
                                updateField('columns', nextCols);
                              }}
                              editable={editable}
                              className="text-[14px] leading-[1.45]"
                              style={{ color: theme.mutedHex }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {slide.layout === 'metrics' && (
                <div className="flex flex-col justify-between h-full gap-4">
                  <div
                    className={`grid gap-4 my-auto ${
                      (slide.metrics?.length ?? 3) >= 4 ? 'grid-cols-4' : 'grid-cols-3'
                    }`}
                  >
                    {(slide.metrics ?? []).slice(0, 4).map((m, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-lg border flex flex-col justify-between min-h-[185px]"
                        style={{
                          backgroundColor: theme.surfaceHex,
                          borderColor: theme.borderHex,
                        }}
                      >
                        <div>
                          <InlineText
                            value={m.value}
                            onChange={(val) => {
                              const next = [...(slide.metrics ?? [])];
                              next[idx] = { ...m, value: val };
                              updateField('metrics', next);
                            }}
                            editable={editable}
                            multiline={false}
                            className={`${titleFontClass} text-[32px] font-bold tracking-tight font-mono-tabular`}
                            style={{ color: theme.inkHex }}
                          />
                          <InlineText
                            value={m.label}
                            onChange={(val) => {
                              const next = [...(slide.metrics ?? [])];
                              next[idx] = { ...m, label: val };
                              updateField('metrics', next);
                            }}
                            editable={editable}
                            className="text-[13px] font-medium leading-snug mt-2"
                            style={{ color: theme.mutedHex }}
                          />
                        </div>
                        {(m.delta || editable) && (
                          <InlineText
                            value={m.delta ?? ''}
                            onChange={(val) => {
                              const next = [...(slide.metrics ?? [])];
                              next[idx] = { ...m, delta: val };
                              updateField('metrics', next);
                            }}
                            editable={editable}
                            multiline={false}
                            placeholder="Delta..."
                            className="text-[12px] font-mono-tabular font-semibold pt-3 border-t"
                            style={{ color: theme.accentHex, borderColor: theme.borderHex }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {(slide.callout || editable) && (
                    <div
                      className="px-4 py-2.5 rounded-lg border text-[12.5px] font-medium"
                      style={{
                        backgroundColor: theme.surfaceHex,
                        borderColor: theme.borderHex,
                        color: theme.mutedHex,
                      }}
                    >
                      <InlineText
                        value={slide.callout ?? ''}
                        onChange={(val) => updateField('callout', val)}
                        editable={editable}
                        placeholder="Add benchmark footnote..."
                        multiline={false}
                      />
                    </div>
                  )}
                </div>
              )}

              {slide.layout === 'process' && (
                <div
                  className={`grid gap-4 my-auto ${
                    (slide.steps?.length ?? 4) === 3 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}
                >
                  {(slide.steps ?? []).slice(0, 4).map((step, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-lg border flex flex-col gap-3 min-h-[235px]"
                      style={{
                        backgroundColor: theme.surfaceHex,
                        borderColor: theme.borderHex,
                      }}
                    >
                      <div
                        className="text-[13px] font-mono-tabular font-semibold pb-2 border-b"
                        style={{ color: theme.accentHex, borderColor: theme.borderHex }}
                      >
                        {step.number}
                      </div>
                      <InlineText
                        value={step.title}
                        onChange={(val) => {
                          const next = [...(slide.steps ?? [])];
                          next[idx] = { ...step, title: val };
                          updateField('steps', next);
                        }}
                        editable={editable}
                        className={`${titleFontClass} text-[16px] font-semibold leading-snug`}
                        style={{ color: theme.inkHex }}
                      />
                      <InlineText
                        value={step.description}
                        onChange={(val) => {
                          const next = [...(slide.steps ?? [])];
                          next[idx] = { ...step, description: val };
                          updateField('steps', next);
                        }}
                        editable={editable}
                        className="text-[13px] leading-[1.48]"
                        style={{ color: theme.mutedHex }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {slide.layout === 'table' && slide.table && (
                <div className="flex flex-col justify-between h-full gap-3">
                  <div
                    className="rounded-lg border overflow-hidden my-auto"
                    style={{ borderColor: theme.borderHex }}
                  >
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr style={{ backgroundColor: theme.surfaceHex }}>
                          {slide.table.headers.map((header, hIdx) => (
                            <th
                              key={hIdx}
                              className="px-4 py-3 text-[12.5px] font-semibold border-b"
                              style={{ color: theme.inkHex, borderColor: theme.borderHex }}
                            >
                              <InlineText
                                value={header}
                                onChange={(val) => {
                                  if (!slide.table) return;
                                  const headers = [...slide.table.headers];
                                  headers[hIdx] = val;
                                  updateField('table', { ...slide.table, headers });
                                }}
                                editable={editable}
                                multiline={false}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slide.table.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            style={{
                              borderBottom:
                                rIdx < (slide.table?.rows.length ?? 0) - 1
                                  ? `1px solid ${theme.borderHex}`
                                  : undefined,
                            }}
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`px-4 py-2.5 text-[12.5px] ${
                                  cIdx === 0 ? 'font-medium' : 'font-mono-tabular'
                                }`}
                                style={{ color: cIdx === 0 ? theme.inkHex : theme.mutedHex }}
                              >
                                <InlineText
                                  value={cell}
                                  onChange={(val) => {
                                    if (!slide.table) return;
                                    const rows = slide.table.rows.map((r) => [...r]);
                                    rows[rIdx][cIdx] = val;
                                    updateField('table', { ...slide.table, rows });
                                  }}
                                  editable={editable}
                                  multiline={false}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(slide.callout || editable) && (
                    <div
                      className="text-[12.5px] font-medium"
                      style={{ color: theme.accentHex }}
                    >
                      <InlineText
                        value={slide.callout ?? ''}
                        onChange={(val) => updateField('callout', val)}
                        editable={editable}
                        placeholder="Add table insight..."
                        multiline={false}
                      />
                    </div>
                  )}
                </div>
              )}

              {slide.layout === 'quote' && (
                <div className="my-auto max-w-[780px] px-4">
                  <div
                    className="text-[36px] leading-none font-serif mb-3 select-none"
                    style={{ color: theme.accentHex }}
                  >
                    “
                  </div>
                  <InlineText
                    value={slide.quote ?? slide.title}
                    onChange={(val) => updateField('quote', val)}
                    editable={editable}
                    className={`${titleFontClass} text-[26px] font-medium leading-[1.38] tracking-tight`}
                    style={{ color: theme.inkHex }}
                  />
                  {(slide.attribution || editable) && (
                    <div className="mt-6 pt-4 border-t" style={{ borderColor: theme.borderHex }}>
                      <InlineText
                        value={slide.attribution ?? ''}
                        onChange={(val) => updateField('attribution', val)}
                        editable={editable}
                        placeholder="Attribution or call to action..."
                        multiline={false}
                        className="text-[13.5px] font-medium"
                        style={{ color: theme.mutedHex }}
                      />
                    </div>
                  )}
                </div>
              )}

              {slide.layout === 'visual-split' && (
                <div className="grid grid-cols-12 gap-7 h-full items-stretch">
                  <div className="col-span-6 flex flex-col justify-center gap-3.5">
                    {(slide.bullets ?? []).map((bullet, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <span
                          className="text-[12.5px] font-mono-tabular font-semibold pt-0.5 shrink-0"
                          style={{ color: theme.accentHex }}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <InlineText
                          value={bullet}
                          onChange={(val) => {
                            const next = [...(slide.bullets ?? [])];
                            next[idx] = val;
                            updateField('bullets', next);
                          }}
                          editable={editable}
                          className="text-[14.5px] leading-[1.48]"
                          style={{ color: theme.inkHex }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="col-span-6 h-full min-h-[250px]">
                    {slide.chart ? (
                      <SlideChart chart={slide.chart} theme={theme} />
                    ) : (
                      <ResilientImage
                        src={slide.imageUrl}
                        alt={slide.title}
                        caption={slide.imageCaption}
                        theme={theme}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="pt-3 border-t flex items-center justify-between text-[11px]"
              style={{ borderColor: theme.borderHex, color: theme.mutedHex }}
            >
              <span className="truncate max-w-[520px]">{deckTitle}</span>
              <span className="font-mono-tabular shrink-0">{numLabel}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
