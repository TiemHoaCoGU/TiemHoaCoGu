'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import Image from 'next/image';
import { ArrowRight, Check, Flower2, Minus, Plus, Shuffle, Trash2 } from 'lucide-react';
import { money } from '@/lib/catalog';
import { storeRequest } from '@/lib/browser-api';
import type { BouquetInput } from '@/lib/api/client';
import { useStore } from './store-provider';
import CustomForm from './custom-form';

const categories = { flowers: 'Hoa chính', greenery: 'Lá xanh', accents: 'Điểm nhấn' };
type Category = keyof typeof categories;
type Item = {
  id: string;
  name: string;
  category: Category;
  art: string;
  price: number;
  color?: string;
  swatch?: string;
};
type Catalog = {
  productId?: string;
  minFlowers: number;
  maxStems: number;
  laborPrice: number;
  items: Item[];
  wraps: { id: string; name: string; price: number }[];
};
export type BouquetSelection = {
  input: BouquetInput;
  productId?: string;
  labels: string[];
  wrap: string;
  estimate: number;
};

const draftKey = 'tiem-hoa-bouquet-draft';

function selectBouquet(
  catalog: Catalog,
  wrap: Catalog['wraps'][number],
  amounts: Record<string, number>,
): BouquetSelection {
  const items = catalog.items.filter((item) => amounts[item.id] > 0);
  return {
    productId: catalog.productId,
    input: {
      wrapId: wrap.id,
      lines: items.map((item) => ({ id: item.id, quantity: amounts[item.id] })),
    },
    labels: items.map(
      (item) => `${item.name}${item.color ? ` · ${item.color}` : ''} × ${amounts[item.id]}`,
    ),
    wrap: wrap.name,
    estimate:
      catalog.laborPrice +
      wrap.price +
      items.reduce((sum, item) => sum + item.price * amounts[item.id], 0),
  };
}

function readDraft(catalog: Catalog) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as Pick<
      BouquetSelection,
      'input' | 'productId'
    > | null;
    if (!stored || stored.productId !== catalog.productId) return;
    const wrap = catalog.wraps.find((item) => item.id === stored.input.wrapId);
    if (!wrap || !Array.isArray(stored.input.lines)) return;
    const quantities = new Map<string, number>();
    let count = 0;
    let flowers = 0;
    for (const { id, quantity } of stored.input.lines) {
      const item = catalog.items.find((entry) => entry.id === id);
      if (!item || quantities.has(id) || !Number.isInteger(quantity) || quantity < 1) return;
      quantities.set(id, quantity);
      count += quantity;
      if (item.category === 'flowers') flowers += quantity;
    }
    if (count > catalog.maxStems || flowers < catalog.minFlowers) return;
    return selectBouquet(catalog, wrap, Object.fromEntries(quantities));
  } catch {
    // Bộ phối vẫn dùng được khi trình duyệt chặn lưu bản nháp.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(draftKey);
  } catch {
    // Bộ phối vẫn dùng được khi trình duyệt chặn lưu bản nháp.
  }
}

const artNames = new Set([
  'rose',
  'rose-red',
  'rose-peach',
  'spray-rose',
  'gerbera',
  'gerbera-purple',
  'lily',
  'lily-pink',
  'sunflower',
  'hydrangea',
  'eucalyptus',
  'baby-breath',
]);
function artPath(item: Item) {
  const name = artNames.has(item.id) ? item.id : item.art;
  return artNames.has(name) ? `/images/bouquet-builder/${name}.webp` : undefined;
}
const sample: Catalog = {
  minFlowers: 7,
  maxStems: 25,
  laborPrice: 20000,
  items: [
    {
      id: 'gerbera-pink',
      name: 'Đồng tiền',
      color: 'Hồng',
      swatch: '#e789a4',
      price: 14000,
      category: 'flowers',
      art: 'gerbera',
    },
    {
      id: 'gerbera-purple',
      name: 'Đồng tiền',
      color: 'Tím',
      swatch: '#a684bd',
      price: 14000,
      category: 'flowers',
      art: 'gerbera',
    },
    {
      id: 'rose-pink',
      name: 'Hồng sáp',
      color: 'Hồng',
      swatch: '#df8e9d',
      price: 18000,
      category: 'flowers',
      art: 'rose',
    },
    {
      id: 'rose-red',
      name: 'Hồng sáp',
      color: 'Đỏ',
      swatch: '#bd4557',
      price: 18000,
      category: 'flowers',
      art: 'rose',
    },
    {
      id: 'rose-peach',
      name: 'Hồng sáp',
      color: 'Cam',
      swatch: '#e69b66',
      price: 18000,
      category: 'flowers',
      art: 'rose',
    },
    {
      id: 'lily-white',
      name: 'Hoa ly',
      color: 'Trắng',
      swatch: '#fffcf4',
      price: 22000,
      category: 'flowers',
      art: 'lily',
    },
    {
      id: 'lily-pink',
      name: 'Hoa ly',
      color: 'Hồng',
      swatch: '#e98da9',
      price: 22000,
      category: 'flowers',
      art: 'lily',
    },
    {
      id: 'sunflower',
      name: 'Hướng dương',
      color: 'Vàng',
      price: 20000,
      category: 'flowers',
      art: 'sunflower',
    },
    {
      id: 'hydrangea',
      name: 'Cẩm tú cầu',
      color: 'Xanh',
      price: 30000,
      category: 'flowers',
      art: 'hydrangea',
    },
    {
      id: 'spray-rose',
      name: 'Hồng chùm',
      color: 'Cam',
      price: 16000,
      category: 'flowers',
      art: 'rose',
    },
    { id: 'eucalyptus', name: 'Lá bạc', price: 7000, category: 'greenery', art: 'eucalyptus' },
    { id: 'baby-breath', name: 'Hoa baby', price: 8000, category: 'accents', art: 'baby-breath' },
  ],
  wraps: [
    { id: 'classic', name: 'Giấy gói cổ điển', price: 0 },
    { id: 'premium', name: 'Giấy gói cao cấp', price: 20000 },
  ],
};
const example = {
  'gerbera-pink': 1,
  'rose-pink': 1,
  'lily-white': 1,
  sunflower: 1,
  hydrangea: 1,
  'spray-rose': 1,
};
const poses = [
  [48, 68, -13, 51],
  [52, 72, 4, 48],
  [56, 70, 16, 50],
  [53, 65, 16, 55],
  [46, 67, -23, 44],
  [48, 62, -6, 48],
  [49, 73, -7, 39],
  [57, 74, 21, 42],
  [52, 72, 3, 35],
  [43, 72, -26, 38],
];

export default function BouquetOrder() {
  const [selection, setSelection] = useState<BouquetSelection | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const continueWith = useCallback((value: BouquetSelection) => {
    setSelection(value);
    if (!value.productId) return;
    try {
      // Chỉ lưu cấu hình hoa trong tab hiện tại, không lưu thông tin liên hệ.
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ productId: value.productId, input: value.input }),
      );
    } catch {
      // Bộ phối vẫn dùng được khi trình duyệt chặn lưu bản nháp.
    }
  }, []);

  useEffect(() => {
    const heading = title.current;
    if (!selection || !heading) return;
    // Bản nháp đã được chèn trên form, nên cuộn theo vị trí sau khi React cập nhật trang.
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [selection]);

  return (
    <>
      <BouquetBuilder onContinue={continueWith} />
      {selection && (
        <div className="bouquet-request" role="group" aria-label="Bó hoa đã chọn">
          <strong>Bó hoa đã chọn</strong>
          <ul>
            {selection.labels.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>
            {selection.wrap} · {money(selection.estimate)} dự kiến mỗi bó
          </p>
          <button
            type="button"
            className="x-textlink"
            onClick={() => {
              clearDraft();
              setSelection(null);
            }}
          >
            Bỏ cấu hình bó
          </button>
        </div>
      )}
      <h2 className="x-h2 bouquet-form-title" id="custom-request-form" ref={title} tabIndex={-1}>
        {selection ? (
          'Thông tin yêu cầu báo giá'
        ) : (
          <>
            Kể tiệm nghe <span className="x-serif">một chút.</span>
          </>
        )}
      </h2>
      <CustomForm
        key={selection?.productId ?? (selection ? 'preview-bouquet' : 'idea')}
        bouquet={selection}
        onSubmitted={clearDraft}
      />
    </>
  );
}

function BouquetBuilder({ onContinue }: { onContinue: (value: BouquetSelection) => void }) {
  const { mode } = useStore();
  const [remote, setRemote] = useState<{
    catalog?: Catalog;
    draft?: BouquetSelection;
    error?: string;
  }>({});
  useEffect(() => {
    if (mode !== 'connected') return;
    let active = true;
    storeRequest<Catalog>('custom-orders/bouquet-catalog').then(
      (catalog) => {
        if (!active) return;
        const draft = readDraft(catalog);
        setRemote({ catalog, draft });
        if (draft) onContinue(draft);
      },
      (error: unknown) => {
        if (active)
          setRemote({
            error: error instanceof Error ? error.message : 'Không tải được bộ phối hoa.',
          });
      },
    );
    return () => {
      active = false;
    };
  }, [mode, onContinue]);

  const catalog = mode === 'preview' ? sample : remote.catalog;
  if (!catalog)
    return (
      <p className="bouquet-unavailable" role="status">
        {mode === 'unavailable'
          ? 'Bộ phối hoa hiện chưa khả dụng.'
          : (remote.error ?? 'Đang tải bộ phối hoa…')}
      </p>
    );
  return (
    <BouquetStudio
      key={mode}
      catalog={catalog}
      preview={mode === 'preview'}
      draft={remote.draft}
      onContinue={onContinue}
    />
  );
}

function BouquetStudio({
  catalog,
  preview,
  draft,
  onContinue,
}: {
  catalog: Catalog;
  preview: boolean;
  draft?: BouquetSelection;
  onContinue: (value: BouquetSelection) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    draft
      ? Object.fromEntries(draft.input.lines.map(({ id, quantity }) => [id, quantity]))
      : preview
        ? example
        : {},
  );
  const [colors, setColors] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<Category>('flowers');
  const [wrapId, setWrapId] = useState(draft?.input.wrapId ?? catalog.wraps[0].id);
  const [layout, setLayout] = useState(0);
  const [offsets, setOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const drag = useRef<{ index: number; x: number; y: number } | null>(null);
  const wrap = catalog.wraps.find((item) => item.id === wrapId)!;
  const wrapImage = `/images/bouquet-builder/${wrapId === 'premium' ? 'wrap-premium' : 'wrap'}.webp`;
  const selected = catalog.items.filter((item) => amounts[item.id] > 0);
  const count = selected.reduce((sum, item) => sum + amounts[item.id], 0);
  const flowerCount = selected.reduce(
    (sum, item) => sum + (item.category === 'flowers' ? amounts[item.id] : 0),
    0,
  );
  // Giá dự kiến cho một bó. Backend định giá lại từ ID giấy gói và số lượng từng biến thể.
  const selection = selectBouquet(catalog, wrap, amounts);
  const { estimate } = selection;
  const stems = selected.flatMap((item) => Array<Item>(amounts[item.id]).fill(item));
  const groups = new Map<string, Item[]>();
  for (const item of catalog.items) {
    if (item.category !== category) continue;
    const group = groups.get(item.name);
    if (group) group.push(item);
    else groups.set(item.name, [item]);
  }

  function change(id: string, delta: number) {
    const next = (amounts[id] ?? 0) + delta;
    if (next < 0 || count + delta > catalog.maxStems) return;
    setAmounts({ ...amounts, [id]: next });
    setOffsets({});
  }

  function trySuggestedBouquet() {
    const flowers = new Map<string, Item>();
    for (const item of catalog.items) {
      if (item.category === 'flowers' && !flowers.has(item.name)) flowers.set(item.name, item);
    }
    const options = [...flowers.values()];
    if (!options.length) return;
    const suggested: Record<string, number> = {};
    for (let index = 0; index < catalog.minFlowers; index++) {
      const { id } = options[index % options.length];
      suggested[id] = (suggested[id] ?? 0) + 1;
    }
    setAmounts(suggested);
    setColors({});
    setCategory('flowers');
  }

  // Tọa độ chỉ đổi hình xem trước. Payload nghiệp vụ lấy từ amounts và wrapId.
  function dragStem(event: PointerEvent<HTMLButtonElement>, index: number) {
    const origin = drag.current;
    if (origin?.index !== index) return;
    const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
    setOffsets({
      ...offsets,
      [index]: {
        x: Math.min(19, Math.max(-19, ((event.clientX - origin.x) * 100) / bounds.width)),
        y: Math.min(20, Math.max(-20, ((event.clientY - origin.y) * 100) / bounds.height)),
      },
    });
  }

  return (
    <>
      <section className="bouquet" aria-labelledby="bouquet-title">
        <header className="bouquet-head">
          <div>
            <h2 id="bouquet-title">Bó hoa của bạn</h2>
            <p>Ít nhất {catalog.minFlowers} bông hoa chính</p>
          </div>
          <div className="bouquet-meter">
            <strong>
              {count} / {catalog.maxStems}
            </strong>
            <div
              role="progressbar"
              aria-label="Số cành và phụ kiện"
              aria-valuenow={count}
              aria-valuemax={catalog.maxStems}
            >
              <i style={{ width: `${(count / catalog.maxStems) * 100}%` }} />
            </div>
          </div>
        </header>
        <div className="bouquet-body">
          <div className="bouquet-stage">
            <div className="bouquet-tools">
              <button
                type="button"
                aria-label="Xáo vị trí hoa"
                title="Xáo vị trí hoa"
                disabled={count < 2}
                onClick={() => {
                  setLayout(layout + 1);
                  setOffsets({});
                }}
              >
                <Shuffle size={17} />
              </button>
              <button
                type="button"
                aria-label="Xóa bó hoa"
                title="Xóa bó hoa"
                disabled={!count}
                onClick={() => {
                  setAmounts({});
                  setColors({});
                  setOffsets({});
                  setLayout(0);
                  setWrapId(catalog.wraps[0].id);
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
            <label className="bouquet-wrap">
              <Image src={wrapImage} alt="" width={19} height={19} />
              <select
                aria-label="Chọn giấy gói"
                value={wrapId}
                onChange={(event) => setWrapId(event.target.value)}
              >
                {catalog.wraps.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.price > 0 ? ` (+${money(option.price)})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {count ? (
              <div className="bouquet-art" aria-label="Minh họa bó hoa">
                <Image
                  className="bouquet-paper bouquet-paper-back"
                  src={wrapImage}
                  alt=""
                  width={245}
                  height={290}
                />
                {stems.map((item, index) => {
                  const src = artPath(item);
                  if (!src) return null;
                  const [x, y, rotation, height] = poses[(index + layout) % poses.length];
                  const offset = offsets[index];
                  return (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      className="bouquet-stem"
                      title={`${item.name}${item.color ? ` · ${item.color}` : ''}`}
                      tabIndex={-1}
                      aria-hidden="true"
                      style={{
                        left: `${x + (offset?.x ?? 0) + (index >= poses.length ? ((index % 5) - 2) * 2 : 0)}%`,
                        top: `${y + (offset?.y ?? 0)}%`,
                        height: `${height}%`,
                        transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
                      }}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        drag.current = {
                          index,
                          x:
                            event.clientX -
                            ((offset?.x ?? 0) * event.currentTarget.parentElement!.clientWidth) /
                              100,
                          y:
                            event.clientY -
                            ((offset?.y ?? 0) * event.currentTarget.parentElement!.clientHeight) /
                              100,
                        };
                      }}
                      onPointerMove={(event) => dragStem(event, index)}
                      onLostPointerCapture={() => {
                        drag.current = null;
                      }}
                    >
                      <Image
                        src={src}
                        alt=""
                        width={245}
                        height={325}
                        loading="eager"
                        draggable={false}
                      />
                    </button>
                  );
                })}
                <Image
                  className="bouquet-paper bouquet-paper-front"
                  src={wrapImage}
                  alt=""
                  width={245}
                  height={290}
                />
              </div>
            ) : (
              <div className="bouquet-empty">
                <Flower2 size={28} aria-hidden="true" />
                <p>Chọn từng bông hoặc bắt đầu với một bó phối từ danh mục.</p>
                <button type="button" onClick={trySuggestedBouquet}>
                  Phối thử một bó
                </button>
              </div>
            )}
            <p className="bouquet-preview-note">
              {selected.some((item) => !artPath(item))
                ? 'Một số thành phần chưa có ảnh minh họa.'
                : 'Ảnh minh họa phối hoa sáp'}
            </p>
          </div>
          <div className="bouquet-palette">
            <h3>Chọn hoa cho bó</h3>
            <div className="bouquet-tabs" role="group" aria-label="Nhóm vật tư">
              {(Object.keys(categories) as Category[]).map((key) => (
                <button
                  type="button"
                  aria-pressed={key === category}
                  key={key}
                  onClick={() => setCategory(key)}
                >
                  {categories[key]}
                </button>
              ))}
            </div>
            <div className="bouquet-cards" key={category}>
              {[...groups].map(([name, variants]) => {
                const item = variants.find((value) => value.id === colors[name]) ?? variants[0];
                const src = artPath(item);
                const quantity = amounts[item.id] ?? 0;
                const total = variants.reduce((sum, value) => sum + (amounts[value.id] ?? 0), 0);
                const label = `${name}${item.color ? ` ${item.color}` : ''}`;
                return (
                  <article className="bouquet-card" data-active={total > 0} key={name}>
                    <div className="bouquet-card-head">
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={() => change(item.id, 1)}
                      >
                        {src ? (
                          <Image src={src} width={52} height={76} alt="" />
                        ) : (
                          <Flower2 size={23} />
                        )}
                      </button>
                      <div>
                        <h4>{name}</h4>
                        <p>
                          {money(item.price)} · mỗi {category === 'flowers' ? 'bông' : 'cành'}
                        </p>
                      </div>
                      {total > 0 && <span>{total}</span>}
                    </div>
                    {variants.length > 1 && (
                      <div className="bouquet-colors" role="group" aria-label={`Màu ${name}`}>
                        <span>{item.color}</span>
                        <div>
                          {variants.map((value) => (
                            <button
                              type="button"
                              key={value.id}
                              aria-label={`${name} ${value.color}`}
                              aria-pressed={item.id === value.id}
                              style={{ '--swatch': value.swatch ?? '#e6dfdf' } as CSSProperties}
                              onClick={() => setColors({ ...colors, [name]: value.id })}
                            >
                              {item.id === value.id && <Check size={12} />}
                              {amounts[value.id] > 0 && <small>{amounts[value.id]}</small>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bouquet-quantity">
                      <button
                        type="button"
                        aria-label={`Bớt ${label}`}
                        disabled={!quantity}
                        onClick={() => change(item.id, -1)}
                      >
                        <Minus size={15} />
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Thêm ${label}`}
                        disabled={count >= catalog.maxStems}
                        onClick={() => change(item.id, 1)}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
              {groups.size === 0 && <p>Tiệm chưa có lựa chọn trong nhóm này.</p>}
            </div>
          </div>
        </div>
        {selected.length > 0 && (
          <section className="bouquet-breakdown" role="group" aria-label="Chi tiết giá dự kiến">
            <h3>Thành phần và giá mỗi bó</h3>
            <dl>
              {selected.map((item) => (
                <div key={item.id}>
                  <dt>
                    {item.name}
                    {item.color ? ` · ${item.color}` : ''} × {amounts[item.id]}
                  </dt>
                  <dd>{money(item.price * amounts[item.id])}</dd>
                </div>
              ))}
              <div>
                <dt>Công bó</dt>
                <dd>{money(catalog.laborPrice)}</dd>
              </div>
              <div>
                <dt>{wrap.name}</dt>
                <dd>{money(wrap.price)}</dd>
              </div>
            </dl>
          </section>
        )}
        <footer className="bouquet-foot">
          <div className="bouquet-summary">
            <div>
              <strong>Còn chỗ cho {catalog.maxStems - count} cành hoặc phụ kiện</strong>
              <small>
                {flowerCount < catalog.minFlowers
                  ? `Chọn thêm ${catalog.minFlowers - flowerCount} bông hoa chính`
                  : `${count} cành và phụ kiện`}
              </small>
            </div>
            <div aria-live="polite">
              <strong>{money(count ? estimate : 0)}</strong>
              <small>
                {preview ? 'Giá minh họa mỗi bó' : 'Dự kiến mỗi bó · chưa gồm phí giao'}
              </small>
            </div>
          </div>
          <div className="bouquet-action">
            <button
              type="button"
              disabled={flowerCount < catalog.minFlowers}
              onClick={() => onContinue(selection)}
            >
              Tiếp tục với bó này <ArrowRight size={16} />
            </button>
          </div>
        </footer>
      </section>
      <p className="bouquet-tip">
        {preview
          ? 'Bản trải nghiệm dùng danh mục và giá minh họa.'
          : 'Tiệm sẽ xác nhận vật tư, phí giao và giá cuối khi báo giá.'}
      </p>
    </>
  );
}
