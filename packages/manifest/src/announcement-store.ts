import {
  rankAnnouncements,
  verifyAnnouncement,
  type AnnouncementCustodyMode,
  type AnnouncementEnvelope,
  type AnnouncementKind,
  type SignedAnnouncement,
} from './announcement.js';

export interface AnnouncementAcceptOptions {
  now?: number;
  verifySignature?: boolean;
  verifySource?: (
    announcement: AnnouncementEnvelope,
  ) => boolean | Promise<boolean>;
}

export interface AnnouncementAcceptResult {
  accepted: boolean;
  announcementId: string;
  reason?: string;
}

export interface AnnouncementQuery {
  kind?: AnnouncementKind;
  asset?: string;
  custody?: AnnouncementCustodyMode;
  publisher?: string;
  subjectId?: string;
  includeExpired?: boolean;
  now?: number;
}

export interface AnnouncementStoreOptions {
  now?: () => number;
}

/**
 * In-memory announcement index.
 *
 * A store is a discovery convenience, not a source of truth: it verifies the
 * envelope, enforces monotonic sequence per (publisher, subjectId), drops
 * expired records and returns ranked results. Durable/transport-backed stores
 * belong in the host/lookup layer.
 */
export class MemoryAnnouncementStore {
  private readonly items = new Map<string, SignedAnnouncement>();
  private readonly now: () => number;

  constructor(options: AnnouncementStoreOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async upsert(
    signed: SignedAnnouncement,
    options: AnnouncementAcceptOptions = {},
  ): Promise<AnnouncementAcceptResult> {
    const now = options.now ?? this.now();
    const id = signed.announcement?.announcementId ?? '';

    if ((options.verifySignature ?? true)) {
      const verification = verifyAnnouncement(signed, { now });
      if (!verification.valid) {
        return { accepted: false, announcementId: id, reason: verification.reason };
      }
    }

    if (signed.announcement.expiresAt <= now) {
      return { accepted: false, announcementId: id, reason: 'announcement has expired' };
    }

    if (options.verifySource && !(await options.verifySource(signed.announcement))) {
      return { accepted: false, announcementId: id, reason: 'source manifest does not match' };
    }

    const existing = this.items.get(id);
    if (existing && existing.announcement.sequence >= signed.announcement.sequence) {
      return {
        accepted: false,
        announcementId: id,
        reason: `stale sequence ${signed.announcement.sequence} (have ${existing.announcement.sequence})`,
      };
    }

    this.items.set(id, signed);
    return { accepted: true, announcementId: id };
  }

  list(query: AnnouncementQuery = {}): SignedAnnouncement[] {
    const now = query.now ?? this.now();
    const values = [...this.items.values()].filter((entry) => {
      const announcement = entry.announcement;
      if (!query.includeExpired && announcement.expiresAt <= now) return false;
      if (query.kind && announcement.kind !== query.kind) return false;
      if (query.asset && announcement.asset !== query.asset) return false;
      if (query.custody && (announcement.custody?.mode ?? 'unknown') !== query.custody) return false;
      if (query.publisher && announcement.publisher !== query.publisher) return false;
      if (query.subjectId && announcement.subjectId !== query.subjectId) return false;
      return true;
    });

    const byId = new Map(values.map((entry) => [entry.announcement.announcementId, entry]));
    return rankAnnouncements(values.map((entry) => entry.announcement)).map(
      (announcement) => byId.get(announcement.announcementId)!,
    );
  }

  get(announcementId: string): SignedAnnouncement | undefined {
    return this.items.get(announcementId);
  }

  removeExpired(now: number = this.now()): number {
    let removed = 0;
    for (const [id, entry] of this.items) {
      if (entry.announcement.expiresAt <= now) {
        this.items.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.items.clear();
  }

  get size(): number {
    return this.items.size;
  }
}
