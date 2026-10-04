import {
  ACTIVITY_ACTIONS,
  CELL_DATA_TYPES,
  FILE_TYPES,
  FORM_FIELD_TYPES,
  GENERAL_ACCESS,
  LOGIC_ACTIONS,
  LOGIC_OPERATORS,
  NOTIFICATION_TYPES,
  PLATFORM_ROLES,
  RESOURCE_TYPES,
  ROLES,
  USER_STATUSES,
} from '@qub/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const platformRoleEnum = pgEnum('platform_role', PLATFORM_ROLES);
export const fileTypeEnum = pgEnum('file_type', FILE_TYPES);
export const roleEnum = pgEnum('role', ROLES);
export const resourceTypeEnum = pgEnum('resource_type', RESOURCE_TYPES);
export const generalAccessEnum = pgEnum('general_access', GENERAL_ACCESS);
export const grantSourceEnum = pgEnum('grant_source', ['DIRECT', 'LINK']);
export const activityActionEnum = pgEnum('activity_action', ACTIVITY_ACTIONS);
export const notificationTypeEnum = pgEnum('notification_type', NOTIFICATION_TYPES);
export const formFieldTypeEnum = pgEnum('form_field_type', FORM_FIELD_TYPES);
export const logicOperatorEnum = pgEnum('logic_operator', LOGIC_OPERATORS);
export const logicActionEnum = pgEnum('logic_action', LOGIC_ACTIONS);
export const cellDataTypeEnum = pgEnum('cell_data_type', CELL_DATA_TYPES);
export const suggestionStatusEnum = pgEnum('suggestion_status', ['PENDING', 'ACCEPTED', 'REJECTED']);
