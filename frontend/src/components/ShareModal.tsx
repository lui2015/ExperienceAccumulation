import { useEffect, useMemo, useState } from 'react';
import { Modal, Tooltip, App as AntdApp, Spin } from 'antd';
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

import { experienceApi } from '@/api';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  experienceId: string;
  title: string;
  summary?: string | null;
}

interface ChannelButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  description?: string;
  compact?: boolean;
}

function ChannelButton({ icon, label, color, onClick, description, compact }: ChannelButtonProps) {
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
          gap: compact ? 4 : 6,
          padding: compact ? '8px 2px' : '12px 4px',
          width: '100%',
          minHeight: compact ? 64 : 86,
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
        <span style={{ fontSize: compact ? 22 : 26, color }}>{icon}</span>
        <span style={{ fontSize: compact ? 11 : 12, letterSpacing: '0.04em' }}>{label}</span>
      </button>
    </Tooltip>
  );
}

export default function ShareModal({
  open,
  onClose,
  experienceId,
  title,
  summary,
}: ShareModalProps) {
  const { message } = AntdApp.useApp();
  const isMobile = useIsMobile();
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const shareText = useMemo(() => {
    const s = summary?.trim();
    return s ? `${title} - ${s}` : title;
  }, [title, summary]);

  // 打开时：拉取长效分享 URL，并生成二维码（base64）
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setShareUrl('');
    setQrDataUrl('');
    (async () => {
      try {
        const tk = await experienceApi.getShareToken(experienceId);
        if (cancelled) return;
        setShareUrl(tk.url);
        const dataUrl = await QRCode.toDataURL(tk.url, {
          width: 220,
          margin: 1,
          color: { dark: '#0a0e1a', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) message.error('生成分享链接失败，请重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, experienceId, message]);

  // 复制链接
  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success('链接已复制，可粘贴到微信/QQ 等聊天窗口');
    } catch {
      const el = document.createElement('textarea');
      el.value = shareUrl;
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

  const hasNativeShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { share?: unknown }).share === 'function';

  const nativeShare = async () => {
    if (!shareUrl) return;
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
        title,
        text: shareText,
        url: shareUrl,
      });
    } catch {
      /* 用户取消或浏览器不支持 */
    }
  };

  const openWeibo = () => {
    if (!shareUrl) return;
    window.open(
      `https://service.weibo.com/share/share.php?url=${encodeURIComponent(
        shareUrl,
      )}&title=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const openTwitter = () => {
    if (!shareUrl) return;
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(
        shareUrl,
      )}&text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const openTelegram = () => {
    if (!shareUrl) return;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
        shareText,
      )}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const openQzone = () => {
    if (!shareUrl) return;
    window.open(
      `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(
        shareUrl,
      )}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(
        summary || '',
      )}&summary=${encodeURIComponent(summary || '')}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const openMail = () => {
    if (!shareUrl) return;
    const subject = encodeURIComponent(`分享：${title}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={isMobile ? '94vw' : 520}
      centered={isMobile}
      title={
        <span style={{ letterSpacing: '0.08em' }}>
          <ShareAltOutlined style={{ marginRight: 8, color: 'var(--cy-neon-cyan, #00e5ff)' }} />
          分享 / SHARE
        </span>
      }
      destroyOnClose
      styles={{ body: { maxHeight: isMobile ? '78vh' : 'unset', overflowY: 'auto' } }}
    >
      {/* 标题 + 链接 */}
      <div
        style={{
          padding: '10px 12px',
          marginBottom: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          minHeight: 60,
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
          {loading ? '生成中…' : shareUrl}
        </div>
      </div>

      {/* 二维码 + 微信/QQ 提示：移动端竖排，PC 横排 */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 16,
          alignItems: 'center',
          padding: isMobile ? 12 : 14,
          marginBottom: 14,
          border: '1px solid rgba(192,132,252,0.25)',
          borderRadius: 10,
          background: 'rgba(192,132,252,0.05)',
        }}
      >
        <div
          style={{
            width: isMobile ? 180 : 220,
            height: isMobile ? 180 : 220,
            background: '#fff',
            borderRadius: 6,
            padding: 4,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          ) : (
            <Spin />
          )}
        </div>
        <div
          style={{
            flex: 1,
            width: '100%',
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--cy-text-dim, #aaa)',
            textAlign: isMobile ? 'center' : 'left',
          }}
        >
          <div style={{ color: 'var(--cy-neon-pink, #ff2ec3)', fontWeight: 600, marginBottom: 6 }}>
            微信 / QQ 扫码即看
          </div>
          {isMobile ? (
            <div style={{ fontSize: 12 }}>
              扫码或复制链接转发，对方无需登录即可查看
            </div>
          ) : (
            <>
              <div>1. 用微信或 QQ 扫一扫</div>
              <div>2. 直接打开内容详情，无需登录</div>
              <div>3. 在打开页面右上角「···」可发送给朋友 / 朋友圈</div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cy-text-faint, #666)' }}>
                ※ 链接长期有效，分享给任何人都可以一键打开查看
              </div>
            </>
          )}
        </div>
      </div>

      {/* 通道按钮：移动端 4 列网格、按钮更紧凑 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: isMobile ? 8 : 10,
        }}
      >
        {[
          {
            icon: <LinkOutlined />,
            label: '复制链接',
            color: '#00e5ff',
            onClick: copyLink,
            description: '复制后粘贴到任意聊天窗口',
          },
          {
            icon: <WechatOutlined />,
            label: '微信',
            color: '#07c160',
            onClick: () => {
              void copyLink();
              message.info('链接已复制，请粘贴到微信聊天窗口；或扫上方二维码');
            },
            description: '复制链接 + 引导扫码',
          },
          {
            icon: <QqOutlined />,
            label: 'QQ 空间',
            color: '#12b7f5',
            onClick: openQzone,
            description: '跳转到 QQ 空间分享页',
          },
          {
            icon: <WeiboOutlined />,
            label: '微博',
            color: '#e6162d',
            onClick: openWeibo,
          },
          {
            icon: <TwitterOutlined />,
            label: 'Twitter',
            color: '#1d9bf0',
            onClick: openTwitter,
          },
          {
            icon: <SendOutlined />,
            label: 'Telegram',
            color: '#26a5e4',
            onClick: openTelegram,
          },
          {
            icon: <MailOutlined />,
            label: '邮件',
            color: '#ffb84d',
            onClick: openMail,
          },
          ...(hasNativeShare
            ? [
                {
                  icon: <ShareAltOutlined />,
                  label: '系统分享',
                  color: '#c084fc',
                  onClick: nativeShare,
                  description: '调起手机系统分享面板（可直达微信/QQ）',
                },
              ]
            : []),
        ].map((c) => (
          <ChannelButton key={c.label} {...c} compact={isMobile} />
        ))}
      </div>
    </Modal>
  );
}
