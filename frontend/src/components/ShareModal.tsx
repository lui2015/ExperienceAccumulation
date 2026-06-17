import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Tooltip, App as AntdApp } from 'antd';
import {
  WechatOutlined,
  QqOutlined,
  WeiboOutlined,
  TwitterOutlined,
  SendOutlined,
  MailOutlined,
  LinkOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import QRCode from 'qrcode';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  /** 分享的 URL（必须为完整 https URL，能被任意终端打开） */
  url: string;
  /** 分享标题，将拼到分享文案里 */
  title: string;
  /** 摘要 */
  summary?: string | null;
}

interface ChannelButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  description?: string;
}

function ChannelButton({ icon, label, color, onClick, description }: ChannelButtonProps) {
  return (
    <Tooltip title={description}>
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '12px 4px',
          width: '100%',
          minHeight: 86,
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--cy-text, #fff)',
          transition: 'all .15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = color;
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${color}55`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
        }}
      >
        <span style={{ fontSize: 26, color }}>{icon}</span>
        <span style={{ fontSize: 12, letterSpacing: '0.04em' }}>{label}</span>
      </button>
    </Tooltip>
  );
}

export default function ShareModal({ open, onClose, url, title, summary }: ShareModalProps) {
  const { message } = AntdApp.useApp();
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);

  const shareText = useMemo(() => {
    const s = summary?.trim();
    return s ? `${title} - ${s}` : title;
  }, [title, summary]);

  // 渲染二维码
  useEffect(() => {
    if (!open || !qrRef.current) return;
    setQrReady(false);
    QRCode.toCanvas(
      qrRef.current,
      url,
      {
        width: 196,
        margin: 1,
        color: {
          dark: '#0a0e1a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (!err) setQrReady(true);
      },
    );
  }, [open, url]);

  // 复制链接
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      message.success('链接已复制，可粘贴到微信/QQ 等聊天窗口');
    } catch {
      // 兜底：选中文本
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        message.success('链接已复制');
      } catch {
        message.error('复制失败，请手动选择链接');
      }
      document.body.removeChild(el);
    }
  };

  // 系统原生分享（移动端可调起微信/QQ 等）
  const hasNativeShare =
    typeof navigator !== 'undefined' && typeof (navigator as Navigator & { share?: unknown }).share === 'function';

  const nativeShare = async () => {
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
        title,
        text: shareText,
        url,
      });
    } catch {
      /* 用户取消或浏览器不支持 */
    }
  };

  // 各渠道
  const openWeibo = () => {
    const u = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(
      url,
    )}&title=${encodeURIComponent(shareText)}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };

  const openTwitter = () => {
    const u = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
      url,
    )}&text=${encodeURIComponent(shareText)}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };

  const openTelegram = () => {
    const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(
      shareText,
    )}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };

  const openQzone = () => {
    const u = `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(
      url,
    )}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(summary || '')}&summary=${encodeURIComponent(
      summary || '',
    )}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };

  const openMail = () => {
    const subject = encodeURIComponent(`分享：${title}`);
    const body = encodeURIComponent(`${shareText}\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      title={
        <span style={{ letterSpacing: '0.08em' }}>
          <ShareAltOutlined style={{ marginRight: 8, color: 'var(--cy-neon-cyan, #00e5ff)' }} />
          分享 / SHARE
        </span>
      }
      destroyOnClose
    >
      {/* 标题 + 链接 */}
      <div
        style={{
          padding: '10px 12px',
          marginBottom: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--cy-text, #fff)',
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--cy-font-mono, monospace)',
            color: 'var(--cy-text-dim, #888)',
            wordBreak: 'break-all',
          }}
        >
          {url}
        </div>
      </div>

      {/* 二维码 + 微信/QQ 提示 */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: 14,
          marginBottom: 16,
          border: '1px solid rgba(192,132,252,0.25)',
          borderRadius: 10,
          background: 'rgba(192,132,252,0.05)',
        }}
      >
        <div
          style={{
            width: 196,
            height: 196,
            background: '#fff',
            borderRadius: 6,
            padding: 4,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <canvas ref={qrRef} style={{ display: qrReady ? 'block' : 'none' }} />
          {!qrReady && (
            <span style={{ color: '#888', fontSize: 12 }}>生成中…</span>
          )}
        </div>
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.7, color: 'var(--cy-text-dim, #aaa)' }}>
          <div style={{ color: 'var(--cy-neon-pink, #ff2ec3)', fontWeight: 600, marginBottom: 6 }}>
            微信 / QQ 扫码分享
          </div>
          <div>1. 用微信或 QQ 扫一扫</div>
          <div>2. 在打开的页面里点右上角「···」</div>
          <div>3. 选择「发送给朋友」/「分享到朋友圈」/「分享到 QQ」</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cy-text-faint, #666)' }}>
            ※ 由于微信/QQ 限制，第三方网页无法直接拉起聊天窗口，扫码是最稳的姿势
          </div>
        </div>
      </div>

      {/* 通道按钮 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        <ChannelButton
          icon={<LinkOutlined />}
          label="复制链接"
          color="#00e5ff"
          onClick={copyLink}
          description="复制后粘贴到任意聊天窗口"
        />
        <ChannelButton
          icon={<WechatOutlined />}
          label="微信"
          color="#07c160"
          onClick={() => {
            void copyLink();
            message.info('链接已复制，请粘贴到微信聊天窗口；或扫上方二维码');
          }}
          description="复制链接 + 引导扫码"
        />
        <ChannelButton
          icon={<QqOutlined />}
          label="QQ 空间"
          color="#12b7f5"
          onClick={openQzone}
          description="跳转到 QQ 空间分享页"
        />
        <ChannelButton
          icon={<WeiboOutlined />}
          label="微博"
          color="#e6162d"
          onClick={openWeibo}
        />
        <ChannelButton
          icon={<TwitterOutlined />}
          label="Twitter"
          color="#1d9bf0"
          onClick={openTwitter}
        />
        <ChannelButton
          icon={<SendOutlined />}
          label="Telegram"
          color="#26a5e4"
          onClick={openTelegram}
        />
        <ChannelButton
          icon={<MailOutlined />}
          label="邮件"
          color="#ffb84d"
          onClick={openMail}
        />
        {hasNativeShare && (
          <ChannelButton
            icon={<ShareAltOutlined />}
            label="系统分享"
            color="#c084fc"
            onClick={nativeShare}
            description="调起手机系统分享面板（可直达微信/QQ）"
          />
        )}
      </div>
    </Modal>
  );
}
