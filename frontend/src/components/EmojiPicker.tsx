import { useMemo, useState } from 'react';
import { Input, Popover, Tooltip } from 'antd';

/** 常用图标候选（按场景分组，方便用户挑选） */
const EMOJI_GROUPS: { name: string; items: string[] }[] = [
  {
    name: '常用',
    items: ['📌', '⭐', '🔥', '💡', '✅', '📝', '📖', '📚', '🗂', '📁', '🏷', '🔖'],
  },
  {
    name: '工作 / 项目',
    items: ['💼', '📊', '📈', '📉', '🧭', '🎯', '🚀', '🛠', '⚙️', '🧩', '🗓', '📅'],
  },
  {
    name: '思考 / 学习',
    items: ['🧠', '💭', '🔍', '🔬', '🧪', '🎓', '✍️', '📐', '📏', '🧮', '🗒', '📜'],
  },
  {
    name: '金融 / 投资',
    items: ['💰', '💵', '💎', '🏦', '📦', '🪙', '🧾', '📤', '📥', '🛒', '🏷', '⚖️'],
  },
  {
    name: '互联网 / 科技',
    items: ['💻', '🖥', '📱', '🌐', '🛰', '🤖', '🧬', '🔌', '🧲', '📡', '🪄', '⌨️'],
  },
  {
    name: '生活 / 情绪',
    items: ['🏠', '☕', '🍃', '🌙', '☀️', '🌊', '🔋', '🎨', '🎵', '🧘', '🏃', '❤️'],
  },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.items);

export interface EmojiPickerProps {
  value?: string | null;
  onChange?: (val: string) => void;
  placeholder?: string;
}

/**
 * Emoji 选择器：左侧固定按钮触发面板（带预设网格），右侧手动输入框。
 * 供 AntD Form.Item 透传 value/onChange 使用。
 */
export default function EmojiPicker({ value, onChange, placeholder }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const grid = useMemo(
    () => (
      <div style={{ width: 280, maxHeight: 320, overflowY: 'auto' }}>
        {EMOJI_GROUPS.map((g) => (
          <div key={g.name} style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--cy-text-dim, #888)',
                letterSpacing: '0.15em',
                marginBottom: 6,
                fontFamily: 'var(--cy-font-mono, monospace)',
                textTransform: 'uppercase',
              }}
            >
              {g.name}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 4,
              }}
            >
              {g.items.map((e) => {
                const active = e === value;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onChange?.(e);
                      setOpen(false);
                    }}
                    style={{
                      fontSize: 20,
                      lineHeight: '32px',
                      height: 36,
                      cursor: 'pointer',
                      border: active
                        ? '1px solid var(--cy-accent, #c084fc)'
                        : '1px solid transparent',
                      borderRadius: 6,
                      background: active
                        ? 'rgba(192,132,252,0.15)'
                        : 'rgba(255,255,255,0.03)',
                      transition: 'all .15s',
                    }}
                    onMouseEnter={(ev) => {
                      (ev.currentTarget as HTMLButtonElement).style.background =
                        'rgba(192,132,252,0.18)';
                    }}
                    onMouseLeave={(ev) => {
                      (ev.currentTarget as HTMLButtonElement).style.background = active
                        ? 'rgba(192,132,252,0.15)'
                        : 'rgba(255,255,255,0.03)';
                    }}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--cy-text-dim, #888)',
              fontFamily: 'var(--cy-font-mono, monospace)',
            }}
          >
            点击图标即选中
          </span>
          <a
            onClick={(e) => {
              e.preventDefault();
              onChange?.('');
              setOpen(false);
            }}
            style={{ fontSize: 12 }}
          >
            清除
          </a>
        </div>
      </div>
    ),
    [value, onChange],
  );

  return (
    <Input.Group compact style={{ display: 'flex' }}>
      <Popover
        content={grid}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement="bottomLeft"
        overlayInnerStyle={{ padding: 12 }}
      >
        <Tooltip title="从预设中挑选">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              width: 56,
              height: 32,
              fontSize: 18,
              cursor: 'pointer',
              border: '1px solid var(--cy-border, #5b21b6)',
              borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              background: 'rgba(91,33,182,0.18)',
              color: 'var(--cy-text, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <span>{value || '😀'}</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
          </button>
        </Tooltip>
      </Popover>
      <Input
        style={{ flex: 1 }}
        value={value || ''}
        onChange={(e) => {
          // 允许用户手动粘贴，但限制取首个 emoji（最多 4 字符）
          const v = e.target.value.slice(0, 4);
          onChange?.(v);
        }}
        placeholder={placeholder || '点左侧选择，或手动输入'}
        maxLength={4}
        allowClear
      />
    </Input.Group>
  );
}

export { ALL_EMOJIS };
