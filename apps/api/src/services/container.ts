import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import type { Database } from '../db';
import { ActivityService, AuditService } from '../modules/activity/activity.service';
import { AdminInsightsService } from '../modules/admin/admin-insights.service';
import { AdminUserService } from '../modules/admin/admin-users.service';
import { EmailSettingsService } from '../modules/admin/email-settings.service';
import { PolicyService } from '../modules/admin/policy.service';
import { UsageService } from '../modules/admin/usage.service';
import { AuthService } from '../modules/auth/auth.service';
import { CommentService } from '../modules/docs/comment.service';
import { DocumentService } from '../modules/docs/document.service';
import { DriveService } from '../modules/drive/drive.service';
import { NativeResourceRegistry } from '../modules/drive/native-registry';
import { FileService } from '../modules/files/file.service';
import { FolderService } from '../modules/folders/folder.service';
import { FormService } from '../modules/forms/form.service';
import { OpsService } from '../modules/forms/ops.service';
import { VariableService } from '../modules/forms/variable.service';
import { LibraryService } from '../modules/library/library.service';
import { ResponseService } from '../modules/forms/response.service';
import { NotificationService } from '../modules/notifications/notification.service';
import { PermissionService } from '../modules/permissions/permission.service';
import { SearchService } from '../modules/search/search.service';
import { SpamService } from '../modules/spam/spam.service';
import { SpreadsheetService } from '../modules/sheets/spreadsheet.service';
import { PublicShareService } from '../modules/sharing/public-share.service';
import { SharingService } from '../modules/sharing/sharing.service';
import { DocRoomHub } from '../websocket/doc-rooms';
import { FormRoomHub } from '../websocket/form-rooms';
import { NotificationHub } from '../websocket/notification-hub';
import { SheetRoomHub } from '../websocket/sheet-rooms';
import { createMailer, type Mailer } from './mailer';
import { createStorageProvider, StorageService, type StorageProvider } from './storage';
import { ThumbnailService } from './thumbnails';
import { AIService } from './ai.service';

export interface ServiceOverrides {
  /** The server-default transport (what "Server default" sends with). */
  mailer?: Mailer;
  storageProvider?: StorageProvider;
  /** HTTP client for email provider APIs. */
  fetch?: typeof fetch;
}

/** Composition root: every service is constructed once here and shared through `app.services`. */
export function createServices(app: FastifyInstance, env: Env, db: Database, overrides: ServiceOverrides = {}) {
  const log = app.log;
  const storage = new StorageService(overrides.storageProvider ?? createStorageProvider(env), log);
  const thumbnails = new ThumbnailService(storage, log);
  const natives = new NativeResourceRegistry();

  const audit = new AuditService(db);
  // All app email goes through the provider chosen in the admin console, else the .env transport.
  const email = new EmailSettingsService(db, env, overrides.mailer ?? createMailer(env, log), audit, log, overrides.fetch);
  const mailer: Mailer = email;
  const activity = new ActivityService(db);
  const notifications = new NotificationService(db);
  const policies = new PolicyService(db, env, audit);
  const usage = new UsageService(db, policies);
  const permissions = new PermissionService(db, policies);
  const folders = new FolderService(db, permissions, activity, notifications, storage, natives);
  const files = new FileService(db, permissions, folders, storage, activity, notifications, natives, policies, usage);
  const drive = new DriveService(db, permissions, files, folders, storage, activity, notifications, usage, log);
  const search = new SearchService(db, permissions);
  const library = new LibraryService(db, drive);
  const spam = new SpamService(db, drive);
  const sharing = new SharingService(db, env, permissions, notifications, activity, audit, mailer, policies);
  const auth = new AuthService(app, db, env, mailer, audit, policies);
  const docs = new DocumentService(db, files, permissions, notifications, sharing, storage, natives, usage);
  const comments = new CommentService(db, docs, sharing, notifications, activity);
  const sheets = new SpreadsheetService(db, files, permissions, natives);
  const forms = new FormService(db, files, permissions, activity, natives);
  const variables = new VariableService(db, forms);
  const ops = new OpsService(db, forms, files, activity);
  const responses = new ResponseService(db, forms, storage, notifications, activity, policies, usage);
  const publicShare = new PublicShareService(app, db, permissions, sheets, activity, policies);
  const adminUsers = new AdminUserService(db, auth, audit, activity, policies, storage, natives, notifications);
  const adminInsights = new AdminInsightsService(db, env, policies, audit, activity, adminUsers);
    const ai = new AIService(env, log);

  const realtime = {
    docs: new DocRoomHub(docs, permissions, log),
    sheets: new SheetRoomHub(db, sheets, log),
    forms: new FormRoomHub(db, forms),
    notifications: new NotificationHub(notifications),
  };
  docs.attachRooms(realtime.docs);
  comments.attachBroadcaster(realtime.docs);
  sheets.attachBroadcaster(realtime.sheets);
  forms.attachBroadcaster(realtime.forms);
  responses.attachBroadcaster(realtime.forms);
  notifications.attachChannel(realtime.notifications);

  return {
    env,
    db,
    mailer,
    email,
    storage,
    thumbnails,
    natives,
    audit,
    activity,
    policies,
    usage,
    adminUsers,
    adminInsights,
      ai,
    notifications,
    permissions,
    folders,
    files,
    drive,
    search,
    library,
    spam,
    sharing,
    publicShare,
    auth,
    docs,
    comments,
    sheets,
    forms,
    variables,
    ops,
    responses,
    realtime,
    async shutdown() {
      await realtime.docs.closeAll();
      realtime.sheets.closeAll();
      realtime.forms.closeAll();
      realtime.notifications.closeAll();
      sheets.close();
    },
  };
}

export type Services = ReturnType<typeof createServices>;

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }
}
