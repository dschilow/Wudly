import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../config/configuration';

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string | null;
}

/**
 * Web Push delivery. Sends notifications to a user's subscribed devices so they
 * arrive even when the app is closed. No-ops gracefully until VAPID keys are set
 * (so the API boots fine without push configured) and prunes dead subscriptions.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;
  private readonly publicKey: string | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    const publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true });
    const subject = config.get('VAPID_SUBJECT', { infer: true });
    this.publicKey = publicKey ?? null;

    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.enabled = true;
        this.logger.log('Web Push enabled (VAPID configured).');
      } catch (err) {
        this.enabled = false;
        this.logger.warn(`Web Push disabled: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      this.enabled = false;
      this.logger.log('Web Push disabled (VAPID keys not set).');
    }
  }

  /** Public VAPID key for the client, or null when push isn't configured. */
  getPublicKey(): string | null {
    return this.enabled ? this.publicKey : null;
  }

  async subscribe(
    userId: string,
    input: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth },
      update: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth },
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /** Best-effort push to all of a user's devices; prunes 404/410 subscriptions. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? '',
      url: payload.url ?? '/',
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => undefined);
          } else {
            this.logger.warn(`Push send failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      }),
    );
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled || userIds.length === 0) return;
    await Promise.all(userIds.map((id) => this.sendToUser(id, payload)));
  }
}
