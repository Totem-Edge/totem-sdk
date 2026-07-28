import React, { useState, useEffect } from 'react';
import { DEFAULT_RPC_ENDPOINT } from '../../../constants';

export interface Announcement {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  priority: number;
  status: 'draft' | 'active' | 'archived';
  updated_at: string;
}

function resolveImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/objects/')) {
    return `${DEFAULT_RPC_ENDPOINT}${imageUrl}`;
  }
  return imageUrl;
}

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onDismiss: (id: number) => void;
  visible: boolean;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  announcements,
  onDismiss,
  visible
}) => {
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentAnnouncement = announcements[currentIndex];

  useEffect(() => {
    if (currentIndex >= announcements.length && announcements.length > 0) {
      setCurrentIndex(0);
    }
  }, [announcements.length, currentIndex]);

  if (!visible || !currentAnnouncement || announcements.length === 0) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsing(true);
    setTimeout(() => {
      onDismiss(currentAnnouncement.id);
      setIsCollapsing(false);
      if (currentIndex >= announcements.length - 1) {
        setCurrentIndex(0);
      }
    }, 200);
  };

  const handleClick = () => {
    if (currentAnnouncement.link_url) {
      window.open(currentAnnouncement.link_url, '_blank');
    }
  };

  return (
    <div
      style={{
        overflow: 'hidden',
        maxHeight: isCollapsing ? '0' : '120px',
        opacity: isCollapsing ? 0 : 1,
        transition: 'max-height 0.2s ease-out, opacity 0.15s ease-out',
        marginBottom: isCollapsing ? '0' : 'var(--space-2)',
      }}
    >
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          cursor: currentAnnouncement.link_url ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        {resolveImageUrl(currentAnnouncement.image_url) && (
          <div
            style={{
              width: '48px',
              height: '48px',
              flexShrink: 0,
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img
              src={resolveImageUrl(currentAnnouncement.image_url)!}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentAnnouncement.title}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.4,
            }}
          >
            {currentAnnouncement.description}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          style={{
            flexShrink: 0,
            width: '24px',
            height: '24px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            padding: 0,
          }}
          aria-label="Dismiss announcement"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1L13 13M1 13L13 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            />
          </svg>
        </button>

        {announcements.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '32px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--text-tertiary)',
            }}
          >
            {currentIndex + 1}/{announcements.length}
          </div>
        )}
      </div>
    </div>
  );
};
